import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAnthropicConnector } from "../src/connectors/anthropic.js";
import { createCompatibleConnector } from "../src/connectors/compatible.js";
import { createGeminiConnector } from "../src/connectors/gemini.js";
import { createOpenAIConnector } from "../src/connectors/openai.js";
import { array, object, postJson, type Fetch } from "../src/connectors/http.js";
import { readOnlyTools } from "../src/tools.js";
import type { Message, ModelConnector, ModelReply } from "../src/types.js";

// These synthetic HTTP fixtures exercise protocol shape, not model intelligence.
// They are test doubles only; the application has no simulated model mode.
function httpFixture(replies: unknown[]) {
  const requests: {
    url: string;
    body: Record<string, unknown>;
    headers: Headers;
    signal?: AbortSignal | null;
  }[] = [];
  const fetchImpl: Fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: object(JSON.parse(String(init?.body))),
      headers: new Headers(init?.headers),
      signal: init?.signal,
    });
    assert.equal(init?.redirect, "error");
    assert.ok(replies.length, "Unexpected additional HTTP request");
    return Response.json(replies.shift());
  };
  return { requests, fetchImpl };
}

async function fixture(name: string): Promise<unknown[]> {
  return array(
    JSON.parse(
      await readFile(
        new URL(`./fixtures/${name}.json`, import.meta.url),
        "utf8",
      ),
    ),
  );
}

async function roundTrip(connector: ModelConnector): Promise<ModelReply> {
  const messages: Message[] = [{ role: "user", content: "Read README.md" }];
  const request = { systemPrompt: "Tutor", messages, tools: readOnlyTools };
  const reply = await connector.complete(request);
  assert.equal(reply.stopReason, "tool_calls");
  assert.equal(reply.usage?.outputTokens, 80);
  assert.equal(reply.usage?.cacheReadTokens, 1000);
  assert.deepEqual(reply.message.toolCalls[0], {
    id: "call_1",
    name: "read_file",
    arguments: { path: "README.md" },
  });
  messages.push(reply.message);
  for (const call of reply.message.toolCalls) {
    messages.push({
      role: "tool",
      callId: call.id,
      name: call.name,
      content: call.id === "call_2" ? "Not found" : "# Tinkerloop",
      isError: call.id === "call_2",
    });
  }
  const final = await connector.complete(request);
  assert.equal(final.usage?.inputTokens, 1500);
  assert.equal(final.stopReason, "complete");
  assert.equal(final.message.content, "A tiny harness.");
  return reply;
}

test("OpenAI sends strict function schemas, results, and unchanged reasoning items", async () => {
  const responses = await fixture("openai");
  const original = structuredClone(responses);
  const http = httpFixture(responses);
  await roundTrip(
    createOpenAIConnector("test-openai-key", "test-model", http.fetchImpl),
  );
  assert.equal(http.requests[0]!.url, "https://api.openai.com/v1/responses");
  assert.equal(http.requests[0]!.body.store, false);
  assert.deepEqual(http.requests[0]!.body.include, [
    "reasoning.encrypted_content",
  ]);
  assert.equal(object(array(http.requests[0]!.body.tools)[0]).strict, true);
  const input = array(http.requests[1]!.body.input);
  assert.deepEqual(input.slice(1, 3), object(original[0]).output);
  assert.deepEqual(input[3], {
    type: "function_call_output",
    call_id: "call_1",
    output: "# Tinkerloop",
  });
});

test("Anthropic groups all tool results and retains signed content blocks", async () => {
  const http = httpFixture(await fixture("anthropic"));
  await roundTrip(
    createAnthropicConnector(
      "test-anthropic-key",
      "test-model",
      http.fetchImpl,
    ),
  );
  assert.equal(
    http.requests[0]!.headers.get("anthropic-version"),
    "2023-06-01",
  );
  assert.equal(http.requests[0]!.body.max_tokens, 8192);
  const history = array(http.requests[1]!.body.messages).map(object);
  assert.equal(history.length, 3);
  assert.equal(
    object(array(history[1]!.content)[0]).signature,
    "opaque-signature",
  );
  const results = array(history[2]!.content).map(object);
  assert.deepEqual(
    results.map((item) => [item.tool_use_id, item.is_error]),
    [
      ["call_1", false],
      ["call_2", true],
    ],
  );
});

test("Gemini uses stateless Interactions and preserves all signed steps", async () => {
  const responses = await fixture("gemini");
  const original = structuredClone(responses);
  const http = httpFixture(responses);
  await roundTrip(
    createGeminiConnector("test-gemini-key", "test-model", http.fetchImpl),
  );
  assert.equal(
    http.requests[0]!.url,
    "https://generativelanguage.googleapis.com/v1beta/interactions",
  );
  assert.equal(http.requests[0]!.body.store, false);
  const input = array(http.requests[1]!.body.input);
  assert.deepEqual(input.slice(1, 3), object(original[0]).steps);
  assert.deepEqual(input[3], {
    type: "function_result",
    name: "read_file",
    call_id: "call_1",
    result: [{ type: "text", text: "# Tinkerloop" }],
  });
});

test("compatible endpoints receive Chat Completions messages and their own key", async () => {
  const http = httpFixture(await fixture("compatible"));
  await roundTrip(
    createCompatibleConnector(
      "http://localhost:1234/v1/",
      "test-compatible-key",
      "test-model",
      http.fetchImpl,
    ),
  );
  assert.equal(
    http.requests[0]!.url,
    "http://localhost:1234/v1/chat/completions",
  );
  assert.equal(
    http.requests[0]!.headers.get("authorization"),
    "Bearer test-compatible-key",
  );
  const history = array(http.requests[1]!.body.messages).map(object);
  assert.equal(history[2]!.reasoning_content, "opaque-provider-metadata");
  assert.deepEqual(history[3], {
    role: "tool",
    tool_call_id: "call_1",
    content: "# Tinkerloop",
  });
});

test("keyless compatible endpoints send no Authorization header and no empty tools field", async () => {
  const responses = await fixture("compatible");
  const http = httpFixture([responses[1]]);
  await createCompatibleConnector(
    "http://localhost/v1",
    "",
    "test-model",
    http.fetchImpl,
  ).complete({ systemPrompt: "", messages: [], tools: [] });
  assert.equal(http.requests[0]!.headers.has("authorization"), false);
  assert.equal(Object.hasOwn(http.requests[0]!.body, "tools"), false);
});

test("each connector reports truncated model output as incomplete", async () => {
  const cases: [unknown, (fetch: Fetch) => ModelConnector][] = [
    [
      { status: "incomplete", output: [] },
      (fetch) => createOpenAIConnector("test-key", "model", fetch),
    ],
    [
      { stop_reason: "max_tokens", content: [] },
      (fetch) => createAnthropicConnector("test-key", "model", fetch),
    ],
    [
      { status: "failed", steps: [] },
      (fetch) => createGeminiConnector("test-key", "model", fetch),
    ],
    [
      {
        choices: [
          {
            finish_reason: "length",
            message: { role: "assistant", content: "partial" },
          },
        ],
      },
      (fetch) =>
        createCompatibleConnector("http://localhost/v1", "", "model", fetch),
    ],
  ];
  for (const [response, create] of cases) {
    const http = httpFixture([response]);
    assert.equal(
      (
        await create(http.fetchImpl).complete({
          systemPrompt: "",
          messages: [],
          tools: [],
        })
      ).stopReason,
      "incomplete",
    );
  }
});

test("HTTP failures redact credentials and malformed provider bodies fail clearly", async () => {
  const secret = "synthetic-secret-key";
  const failure: Fetch = async () =>
    new Response(`bad key ${secret}`, { status: 401 });
  await assert.rejects(
    postJson(
      "https://example.invalid",
      { Authorization: `Bearer ${secret}` },
      {},
      undefined,
      failure,
    ),
    (error: unknown) => {
      assert.match(String(error), /HTTP 401/);
      assert.doesNotMatch(String(error), new RegExp(secret));
      return true;
    },
  );
  const http = httpFixture([{ output: "not an array" }]);
  await assert.rejects(
    createOpenAIConnector("key", "model", http.fetchImpl).complete({
      systemPrompt: "",
      messages: [],
      tools: [],
    }),
    /unexpected JSON array/,
  );
});

test("request cancellation reaches HTTP fetch", async () => {
  const controller = new AbortController();
  const fetchImpl: Fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init!.signal!.addEventListener(
        "abort",
        () => reject(new Error("aborted HTTP")),
        { once: true },
      );
    });
  const pending = createOpenAIConnector("key", "model", fetchImpl).complete({
    systemPrompt: "",
    messages: [],
    tools: [],
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, /aborted HTTP/);
});
