import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createInterrupts } from "../src/main.js";

test("the real CLI renders usage on stderr and keeps piped stdout clean", async () => {
  const server = createServer(async (request, response) => {
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.headers.authorization, undefined);
    for await (const _chunk of request) {
      /* consume the request body */
    }
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "# Result\n\nA **small** app.",
            },
          },
        ],
        usage: {
          prompt_tokens: 250,
          completion_tokens: 20,
          prompt_tokens_details: { cached_tokens: 100 },
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const cwd = await mkdtemp(join(tmpdir(), "tinkerloop-cli-"));
  try {
    const result = await promisify(execFile)(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        resolve("src/cli.ts"),
        "--provider",
        "compatible",
        "--model",
        "test-model",
        "--context-window",
        "1000",
        "Build an app",
      ],
      {
        cwd,
        env: {
          ...process.env,
          TINKERLOOP_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
          OPENAI_COMPATIBLE_API_KEY: "",
        },
      },
    );
    assert.equal(result.stdout, "# Result\n\nA **small** app.\n");
    assert.match(result.stderr, /Tinkerloop/);
    assert.match(result.stderr, /in 250 · out 20 · cache read 100/);
    assert.match(result.stderr, /25.0% of configured window/);
    assert.doesNotMatch(result.stderr + result.stdout, /\x1b/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Ctrl+C stops the active chat turn first, and ends the session otherwise", () => {
  const interrupts = createInterrupts();
  const first = interrupts.startTurn();
  interrupts.cancel();
  assert.equal(first.aborted, true);
  assert.equal(interrupts.session.aborted, false);
  assert.equal(interrupts.endTurn(), true);

  const second = interrupts.startTurn();
  assert.equal(second.aborted, false);
  assert.equal(interrupts.endTurn(), false); // A finished turn was not cancelled.

  interrupts.startTurn();
  interrupts.cancel();
  interrupts.cancel(); // A second press while the turn is still stopping.
  assert.equal(interrupts.session.aborted, true);

  const idle = createInterrupts();
  idle.cancel(); // Ctrl+C at the prompt.
  assert.equal(idle.session.aborted, true);
});
