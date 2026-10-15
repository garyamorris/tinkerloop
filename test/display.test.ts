import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { createDisplay } from "../src/display.js";
import { cleanText, renderMarkdown } from "../src/render.js";
import type { ModelReply } from "../src/types.js";

function screen(tty: boolean, env: NodeJS.ProcessEnv = {}) {
  let out = "";
  let err = "";
  const display = createDisplay(
    {
      provider: "openai",
      model: "test-model",
      cwd: "/practice",
      contextWindow: 1000,
    },
    {
      stdout: {
        isTTY: tty,
        columns: 60,
        write: (text) => {
          out += text;
        },
      },
      stderr: {
        isTTY: tty,
        columns: 60,
        write: (text) => {
          err += text;
        },
      },
      env,
    },
  );
  return { display, stdout: () => out, stderr: () => err };
}

const reply: ModelReply = {
  stopReason: "complete",
  message: {
    role: "assistant",
    content: "# Result\n\nA **small** app.\n\n```ts\n  const x = 1;\n```",
    toolCalls: [],
  },
  usage: { inputTokens: 250, outputTokens: 20, cacheReadTokens: 0 },
};

test("interactive output renders Markdown and preserves code indentation", () => {
  const terminal = screen(true);
  terminal.display.banner();
  terminal.display.request(1, 10);
  terminal.display.reply(reply);
  const text = stripVTControlCharacters(terminal.stdout());
  assert.match(text, /tinkerloop/);
  assert.match(text, /A small app/);
  assert.match(text, /      const x = 1;/);
  assert.doesNotMatch(text, /\*\*|```|# Result/);
  assert.match(terminal.stderr(), /Tinkerloop/);
  assert.match(stripVTControlCharacters(terminal.stderr()), /cache read 0/);
});

test("redirected stdout preserves plain model text and keeps stats on stderr", () => {
  const terminal = screen(false);
  terminal.display.banner();
  terminal.display.request(1, 10);
  terminal.display.reply(reply);
  terminal.display.finish([], 4);
  assert.equal(terminal.stdout(), reply.message.content + "\n");
  assert.doesNotMatch(terminal.stdout() + terminal.stderr(), /\x1b/);
  assert.match(terminal.stderr(), /in 250/);
  assert.match(terminal.stderr(), /25\.0%\s+of configured window/);
});

test("NO_COLOR disables styles while retaining readable terminal formatting", () => {
  const terminal = screen(true, { NO_COLOR: "" });
  terminal.display.banner();
  terminal.display.reply(reply);
  assert.doesNotMatch(terminal.stdout() + terminal.stderr(), /\x1b/);
  assert.doesNotMatch(terminal.stdout(), /\*\*/);
});

test("model output cannot inject terminal escapes or carriage-return overwrites", () => {
  const malicious = "hello\x1b[2J\x1b]52;c;clipboard\x07\rworld\b!";
  assert.equal(cleanText(malicious), "helloworld!");
  const terminal = screen(false);
  terminal.display.reply({
    ...reply,
    message: { ...reply.message, content: malicious },
  });
  assert.equal(terminal.stdout(), "helloworld!\n");
});

test("clearing context retains session usage and unknown counters stay unknown", () => {
  const terminal = screen(false);
  terminal.display.request(1, 10);
  terminal.display.reply(reply);
  terminal.display.request(1, 10);
  terminal.display.reply({ ...reply, usage: undefined });
  terminal.display.clearContext();
  terminal.display.usage();
  terminal.display.context([], 4);
  const text = terminal.stderr();
  assert.match(text, /Input: 250 \(1\/2 requests reported\)/);
  assert.match(text, /Cache write: not reported/);
  assert.match(text, /last response input: not reported/);
  assert.match(text, /0 history messages/);
});

test("narrow paragraphs wrap and code blocks keep their exact contents", () => {
  const rendered = renderMarkdown(
    "This is a deliberately long paragraph that should wrap across several lines.\n\n```js\n    nested();\n```",
    30,
  );
  const paragraphs = rendered
    .split("\n")
    .filter((line) => !line.includes("nested") && !line.includes("──"));
  assert.ok(paragraphs.every((line) => line.length <= 30));
  assert.match(rendered, /        nested\(\);/);
});

test("tool failures and approval previews remain visible without execution", () => {
  const terminal = screen(false);
  const call = {
    id: "a",
    name: "write_file",
    arguments: { path: "app.ts", content: "hello" },
  };
  terminal.display.tool(call);
  terminal.display.approval("Replace app.ts:\nhello");
  terminal.display.toolResult(
    {
      role: "tool",
      callId: "a",
      name: "write_file",
      isError: true,
      content: "User denied this file change.",
    },
    call,
    10,
  );
  assert.match(terminal.stderr(), /Approval required/);
  assert.match(terminal.stderr(), /User denied/);
  assert.match(terminal.stderr(), /app.ts/);
});

test("approval previews reveal hidden controls instead of hiding proposed bytes", () => {
  const terminal = screen(false);
  terminal.display.approval("safe\rhidden\x1b[2J");
  assert.match(terminal.stderr(), /safe\\u000dhidden\\u001b\[2J/);
  assert.doesNotMatch(terminal.stderr(), /\x1b|\r/);
});

test("the full-screen view keeps live usage in its footer and retains totals after clearing", () => {
  let transcript = "";
  let header: string[] = [];
  let footer: string[] = [];
  let status = "";
  const display = createDisplay(
    {
      provider: "openai",
      model: "test-model",
      cwd: "/practice",
      contextWindow: 1000,
    },
    {
      env: { NO_COLOR: "" },
      screen: {
        write(text) {
          transcript += text;
        },
        setHeader(lines) {
          header = lines;
        },
        setFooter(lines) {
          footer = lines;
        },
        setStatus(text) {
          status = text;
        },
      },
    },
  );
  display.banner();
  assert.match(header.join(" "), /Tinkerloop.*test-model.*practice/);
  display.request(1, 10, [{ role: "user", content: "Hello" }]);
  assert.match(status, /Thinking.*1\/10/);
  display.reply(reply);
  display.finish([{ role: "user", content: "Hello" }, reply.message], 4);
  assert.match(footer.join("\n"), /in 250 · out 20 · cache read 0/);
  assert.match(footer.join("\n"), /25.0% of 1,000 · 2 messages/);
  assert.doesNotMatch(transcript, /cache read|Context ·/);
  display.clearContext();
  assert.match(footer.join("\n"), /Context · not reported · 0 messages/);
  assert.match(footer.join("\n"), /Session · 1 request · in 250 · out 20/);
});
