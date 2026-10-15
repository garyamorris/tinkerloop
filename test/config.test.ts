import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadLocalEnv, readConfig } from "../src/config.js";
import { createTerminal } from "../src/terminal.js";

const env = { TINKERLOOP_MODEL: "test-model", OPENAI_API_KEY: "test-key" };

test("flags override environment, task words join, and sensible defaults apply", () => {
  const config = readConfig(
    ["--model", "other-model", "--max-steps", "3", "fix", "this"],
    env,
  )!;
  assert.equal(config.provider, "openai");
  assert.equal(config.model, "other-model");
  assert.equal(config.maxSteps, 3);
  assert.equal(config.prompt, "fix this");
  assert.equal(readConfig([], env)!.maxSteps, 10);
  assert.equal(readConfig([], env)!.trace, undefined);
  assert.equal(
    readConfig(["--trace", "traces"], env)!.trace,
    resolve("traces"),
  );
});

test("help needs no key or model and invalid configuration fails clearly", () => {
  assert.equal(readConfig(["--help"], {}), undefined);
  for (const args of [
    ["--provider", "unknown"],
    ["--max-steps", "0"],
    ["--max-steps", "1.5"],
    ["--unknown"],
  ]) {
    assert.throws(() => readConfig(args, env));
  }
  assert.throws(() => readConfig([], {}), /Choose a model/);
  assert.throws(
    () => readConfig([], { TINKERLOOP_MODEL: "model" }),
    /OPENAI_API_KEY/,
  );
});

test("context limits are optional, validated, and overridden by flags", () => {
  assert.equal(readConfig([], env)!.contextWindow, undefined);
  assert.equal(
    readConfig([], { ...env, TINKERLOOP_CONTEXT_WINDOW: "1000" })!
      .contextWindow,
    1000,
  );
  assert.equal(
    readConfig(["--context-window", "2000"], {
      ...env,
      TINKERLOOP_CONTEXT_WINDOW: "1000",
    })!.contextWindow,
    2000,
  );
  for (const value of ["0", "-1", "1.5", "not-a-number"]) {
    assert.throws(
      () => readConfig([`--context-window=${value}`], env),
      /positive whole/,
    );
  }
});

test("the human provider needs no key and ignores a configured model ID", () => {
  const config = readConfig(["--provider", "human"], {
    TINKERLOOP_MODEL: "some-real-model",
    OPENAI_API_KEY: "test-key",
  })!;
  assert.equal(config.provider, "human");
  assert.equal(config.model, "you");
  assert.equal(config.apiKey, "");
  assert.equal(readConfig(["--provider", "human"], {})!.apiKey, "");
});

test("native provider credentials never become compatible endpoint credentials", () => {
  const config = readConfig(["--provider", "compatible"], {
    ...env,
    TINKERLOOP_BASE_URL: "http://localhost:11434/v1",
  })!;
  assert.equal(config.apiKey, "");
  for (const baseUrl of [
    "http://remote.example/v1",
    "https://user:secret@example.com/v1",
    "https://example.com/v1?key=secret",
    "file:///tmp/api",
  ]) {
    assert.throws(() =>
      readConfig(["--provider", "compatible"], {
        ...env,
        TINKERLOOP_BASE_URL: baseUrl,
      }),
    );
  }
});

test("a non-terminal cannot approve a proposed action", async (t) => {
  if (process.stdin.isTTY) {
    t.skip("This assertion exercises a non-terminal input stream.");
    return;
  }
  const terminal = createTerminal(() => {});
  try {
    assert.equal(
      await terminal.approve("A test action", new AbortController().signal),
      false,
    );
  } finally {
    terminal.close();
  }
});

test("the CLI shows help and fails with a useful configuration error", async () => {
  const exec = promisify(execFile);
  const cleanEnv = { ...process.env, TINKERLOOP_MODEL: "", OPENAI_API_KEY: "" };
  const help = await exec(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", "--help"],
    { env: cleanEnv },
  );
  assert.match(help.stdout, /Tinkerloop/);
  await assert.rejects(
    exec(process.execPath, ["--import", "tsx", "src/cli.ts", "task"], {
      env: cleanEnv,
    }),
    (error: unknown) => {
      assert.match(String(error), /Choose a model/);
      return true;
    },
  );
});

test("optional env files load without overwriting existing environment variables", async () => {
  const folder = await mkdtemp(join(tmpdir(), "tinkerloop-env-"));
  const previousCwd = process.cwd();
  const previous = process.env.TINKERLOOP_TEST_SETTING;
  try {
    process.chdir(folder);
    loadLocalEnv(); // An absent file is fine.
    await writeFile(
      join(folder, ".env.local"),
      "TINKERLOOP_TEST_SETTING=from-file\n",
    );
    delete process.env.TINKERLOOP_TEST_SETTING;
    loadLocalEnv();
    assert.equal(process.env.TINKERLOOP_TEST_SETTING, "from-file");
    process.env.TINKERLOOP_TEST_SETTING = "existing-value";
    loadLocalEnv();
    assert.equal(process.env.TINKERLOOP_TEST_SETTING, "existing-value");
  } finally {
    process.chdir(previousCwd);
    if (previous === undefined) delete process.env.TINKERLOOP_TEST_SETTING;
    else process.env.TINKERLOOP_TEST_SETTING = previous;
    await rm(folder, { recursive: true, force: true });
  }
});

test("help works independently of a launch directory's env configuration", async () => {
  const folder = await mkdtemp(join(tmpdir(), "tinkerloop-help-"));
  const entry = resolve("src/cli.ts");
  const tsx = resolve("node_modules/tsx/dist/cli.mjs");
  try {
    await writeFile(
      join(folder, ".env.local"),
      "TINKERLOOP_PROVIDER=invalid\nTINKERLOOP_MODEL=\n",
    );
    const result = await promisify(execFile)(
      process.execPath,
      [tsx, entry, "--help"],
      { cwd: folder },
    );
    assert.match(result.stdout, /Tinkerloop/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
