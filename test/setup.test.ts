import assert from "node:assert/strict";
import test from "node:test";
import { configure, type SetupPrompts } from "../src/setup.js";

function prompts(answers: string[], provider = 0) {
  const questions: { title: string; secret: boolean }[] = [];
  let selections = 0;
  const ui: SetupPrompts = {
    async choose(_title, choices) {
      assert.equal(choices.length, 4);
      selections++;
      return provider;
    },
    async ask(title, _description, suggestion, _signal, secret = false) {
      questions.push({ title, secret });
      assert.ok(answers.length, `Unexpected question: ${title}`);
      return answers.shift()! || suggestion;
    },
  };
  return { ui, questions, selections: () => selections };
}
const signal = new AbortController().signal;

test("guided startup asks for missing provider, model, and a hidden session key", async () => {
  const env = {};
  const input = prompts(["my-model", "session-test-key"]);
  const config = await configure([], signal, input.ui, env);
  assert.equal(config?.provider, "openai");
  assert.equal(config?.model, "my-model");
  assert.equal(config?.apiKey, "session-test-key");
  assert.equal(input.selections(), 1);
  assert.deepEqual(
    input.questions.map((question) => question.secret),
    [false, true],
  );
  assert.deepEqual(env, {}); // A pasted key never becomes persistent configuration.
});

test("explicit flags and environment settings skip the corresponding questions", async () => {
  const input = prompts([]);
  const config = await configure(
    ["--provider", "anthropic", "--model", "chosen", "--plain"],
    signal,
    input.ui,
    {
      TINKERLOOP_PROVIDER: "openai",
      TINKERLOOP_MODEL: "other",
      ANTHROPIC_API_KEY: "test-key",
    },
  );
  assert.equal(config?.model, "chosen");
  assert.equal(config?.provider, "anthropic");
  assert.equal(config?.plain, true);
  assert.equal(input.selections(), 0);
  assert.deepEqual(input.questions, []);
});

test("a model alone still prompts for the provider, while an existing key is reused", async () => {
  const input = prompts([], 2);
  const config = await configure(
    ["--model", "gemini-model"],
    signal,
    input.ui,
    { GEMINI_API_KEY: "test-key" },
  );
  assert.equal(config?.provider, "gemini");
  assert.equal(input.selections(), 1);
  assert.deepEqual(input.questions, []);
});

test("compatible setup asks for endpoint and permits an empty API key", async () => {
  const input = prompts(["local-model", "http://localhost:11434/v1", ""], 3);
  const config = await configure([], signal, input.ui, {});
  assert.equal(config?.baseUrl, "http://localhost:11434/v1");
  assert.equal(config?.apiKey, "");
  assert.equal(input.questions[2]?.secret, true);
});

test("required setup answers retry, and final answers still get URL validation", async () => {
  const input = prompts(["", " ", "anthropic-model"]);
  const config = await configure(
    ["--provider", "anthropic"],
    signal,
    input.ui,
    { ANTHROPIC_API_KEY: "test-key" },
  );
  assert.equal(config?.model, "anthropic-model");
  assert.equal(input.questions.length, 3);
  const invalid = prompts(["http://remote.example/v1", ""]);
  await assert.rejects(
    configure(
      ["--provider", "compatible", "--model", "local-model"],
      signal,
      invalid.ui,
      {},
    ),
    /HTTPS/,
  );
});

test("headless startup never prompts, help needs no credentials, and cancellation stops setup", async () => {
  await assert.rejects(configure([], signal, undefined, {}), /Choose a model/);
  const input = prompts([]);
  assert.equal(await configure(["--help"], signal, input.ui, {}), undefined);
  const controller = new AbortController();
  controller.abort(new Error("Cancelled setup"));
  await assert.rejects(
    configure(["--provider", "openai"], controller.signal, input.ui, {}),
    /Cancelled setup/,
  );
  assert.deepEqual(input.questions, []);
});
