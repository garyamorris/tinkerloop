import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runCommand } from "../src/command.js";
import { keyNames } from "../src/config.js";
import { errorMessage } from "../src/errors.js";
import {
  bounded,
  executeTool,
  MAX_OUTPUT,
  readOnlyTools,
  workspacePath,
  workspaceRoot,
} from "../src/tools.js";

async function workspace(t: { after(fn: () => Promise<void>): void }) {
  const folder = await mkdtemp(join(tmpdir(), "tinkerloop-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return workspaceRoot(folder);
}

test("file reads and listings work without asking for approval and hide environment files", async (t) => {
  const cwd = await workspace(t);
  await writeFile(join(cwd, "hello.txt"), "hello");
  await writeFile(join(cwd, ".env.local"), "secret");
  await writeFile(join(cwd, ".env.example"), "KEY=");
  const context = {
    cwd,
    approve: async () => {
      throw new Error("Read must not ask");
    },
  };
  const read = await executeTool(
    { id: "1", name: "read_file", arguments: { path: "hello.txt" } },
    context,
  );
  assert.equal(read.content, "hello");
  const list = await executeTool(
    { id: "2", name: "list_files", arguments: { path: "." } },
    context,
  );
  assert.match(list.content, /hello.txt/);
  assert.match(list.content, /\.env.example/);
  assert.doesNotMatch(list.content, /\.env.local/);
});

test("writes wait for approval, show complete contents, then create parents", async (t) => {
  const cwd = await workspace(t);
  const call = {
    id: "write",
    name: "write_file",
    arguments: { path: "nested/file.txt", content: "full replacement\n" },
  };
  let reviewed = false;
  const result = await executeTool(call, {
    cwd,
    approve: async (preview) => {
      await assert.rejects(readFile(join(cwd, "nested/file.txt")), {
        code: "ENOENT",
      });
      assert.match(preview, /full replacement/);
      reviewed = true;
      return true;
    },
  });
  assert.equal(reviewed, true);
  assert.equal(result.isError, false);
  assert.equal(
    await readFile(join(cwd, "nested/file.txt"), "utf8"),
    "full replacement\n",
  );
});

test("denied writes and commands never mutate the workspace", async (t) => {
  const cwd = await workspace(t);
  const context = { cwd, approve: async () => false };
  const write = await executeTool(
    {
      id: "1",
      name: "write_file",
      arguments: { path: "denied.txt", content: "no" },
    },
    context,
  );
  const command = await executeTool(
    {
      id: "2",
      name: "run_command",
      arguments: {
        command: `node -e "require('fs').writeFileSync('denied.txt','no')"`,
      },
    },
    context,
  );
  assert.equal(write.isError, true);
  assert.equal(command.isError, true);
  await assert.rejects(readFile(join(cwd, "denied.txt")), { code: "ENOENT" });
});

test("traversal, sibling prefixes, blocked files, and symlinks are rejected", async (t) => {
  const cwd = await workspace(t);
  for (const path of [
    "../escape",
    `${cwd}-sibling/file`,
    ".git/config",
    ".env.local",
    "node_modules/code.js",
  ]) {
    await assert.rejects(workspacePath(cwd, path));
  }
  const outside = await workspace(t);
  await symlink(
    outside,
    join(cwd, "link"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(workspacePath(cwd, "link/escape.txt"), /symbolic/);
  const result = await executeTool(
    {
      id: "1",
      name: "write_file",
      arguments: { path: "link/escape.txt", content: "no" },
    },
    { cwd, approve: async () => true },
  );
  assert.equal(result.isError, true);
  await assert.rejects(readFile(join(outside, "escape.txt")), {
    code: "ENOENT",
  });
});

test("a path replaced with a symlink during review is checked again", async (t) => {
  const cwd = await workspace(t);
  const outside = await workspace(t);
  const result = await executeTool(
    {
      id: "1",
      name: "write_file",
      arguments: { path: "new/file.txt", content: "no" },
    },
    {
      cwd,
      approve: async () => {
        await symlink(
          outside,
          join(cwd, "new"),
          process.platform === "win32" ? "junction" : "dir",
        );
        return true;
      },
    },
  );
  assert.equal(result.isError, true);
  await assert.rejects(readFile(join(outside, "file.txt")), { code: "ENOENT" });
});

test("invalid arguments, unknown tools, and read-only tool restrictions return errors", async (t) => {
  const cwd = await workspace(t);
  const context = {
    cwd,
    approve: async () => {
      throw new Error("Must not ask");
    },
  };
  for (const input of [
    null,
    "{bad",
    { path: 7 },
    { path: "" },
    { path: "x", toString: "unexpected" },
  ]) {
    assert.equal(
      (
        await executeTool(
          { id: "1", name: "read_file", arguments: input },
          context,
        )
      ).isError,
      true,
    );
  }
  assert.equal(
    (await executeTool({ id: "2", name: "unknown", arguments: {} }, context))
      .isError,
    true,
  );
  assert.equal(
    (
      await executeTool(
        { id: "3", name: "write_file", arguments: { path: "x", content: "x" } },
        context,
        readOnlyTools,
      )
    ).isError,
    true,
  );
});

test("large or binary files fail clearly, and text output is bounded", async (t) => {
  const cwd = await workspace(t);
  const context = { cwd, approve: async () => true };
  await writeFile(join(cwd, "large"), "x".repeat(20_001));
  await writeFile(join(cwd, "binary"), Buffer.from([0, 1, 2]));
  for (const path of ["large", "binary"])
    assert.equal(
      (
        await executeTool(
          { id: path, name: "read_file", arguments: { path } },
          context,
        )
      ).isError,
      true,
    );
  assert.equal(
    (
      await executeTool(
        {
          id: "large-write",
          name: "write_file",
          arguments: { path: "new", content: "x".repeat(20_001) },
        },
        context,
      )
    ).isError,
    true,
  );
  assert.equal(bounded("x".repeat(100_000)).length, MAX_OUTPUT);
  assert.match(bounded("x".repeat(100_000)), /truncated/);
});

test("approved commands return stdout, stderr, exit status, and bounded output", async (t) => {
  const cwd = await workspace(t);
  const context = {
    cwd,
    approve: async (preview: string) => {
      assert.match(preview, /node -e/);
      return true;
    },
  };
  const result = await executeTool(
    {
      id: "1",
      name: "run_command",
      arguments: {
        command: `node -e "console.log('hello'); console.error('problem'); process.exitCode=7"`,
      },
    },
    context,
  );
  assert.equal(result.isError, true);
  const output = JSON.parse(result.content) as {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  assert.match(output.stdout, /hello/);
  assert.match(output.stderr, /problem/);
  assert.equal(output.exitCode, 7);
  const large = await executeTool(
    {
      id: "2",
      name: "run_command",
      arguments: { command: `node -e "console.log('x'.repeat(100000))"` },
    },
    context,
  );
  assert.ok(large.content.length <= MAX_OUTPUT);
  assert.match(large.content, /truncated/);
});

test("commands time out and cancellation terminates a running command", async (t) => {
  const cwd = await workspace(t);
  const command = `node -e "setInterval(()=>{},1000)"`;
  const timeout = await runCommand(command, cwd, undefined, 100);
  assert.equal(timeout.timedOut, true);
  const controller = new AbortController();
  const pending = runCommand(command, cwd, controller.signal);
  setTimeout(() => controller.abort(new Error("Cancelled test command")), 100);
  await assert.rejects(pending, /Cancelled test/);
});

test("a pre-cancelled request cannot write a file", async (t) => {
  const cwd = await workspace(t);
  const controller = new AbortController();
  controller.abort(new Error("Cancelled"));
  const result = await executeTool(
    { id: "1", name: "write_file", arguments: { path: "x", content: "x" } },
    {
      cwd,
      signal: controller.signal,
      approve: async () => {
        throw new Error("Must not ask");
      },
    },
  );
  assert.equal(result.isError, true);
  await assert.rejects(readFile(join(cwd, "x")), { code: "ENOENT" });
});

test("commands never inherit provider keys, and errors redact them", async (t) => {
  const cwd = await workspace(t);
  const saved = Object.values(keyNames).map((name) => [name, process.env[name]]);
  t.after(() => {
    for (const [name, value] of saved)
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
  });
  for (const name of Object.values(keyNames))
    process.env[name] = `secret-value-for-${name}`;
  const output = await runCommand(
    `node -e "console.log(Object.keys(process.env).join(' '))"`,
    cwd,
  );
  for (const name of Object.values(keyNames))
    assert.doesNotMatch(output.stdout, new RegExp(`\\b${name}\\b`));
  for (const name of Object.values(keyNames))
    assert.equal(
      errorMessage(new Error(`failed with secret-value-for-${name}`)),
      "failed with [redacted]",
    );
});
