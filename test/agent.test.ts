import assert from "node:assert/strict";
import test from "node:test";
import { runAgent } from "../src/agent.js";
import type {
  Message,
  ModelConnector,
  ModelReply,
  ToolCall,
  ToolResult,
} from "../src/types.js";

const call = (id: string): ToolCall => ({
  id,
  name: "read_file",
  arguments: { path: id },
});
const result = (request: ToolCall): ToolResult => ({
  role: "tool",
  callId: request.id,
  name: request.name,
  content: "file contents",
  isError: false,
});
const answer = (content = "Done"): ModelReply => ({
  message: { role: "assistant", content, toolCalls: [] },
  stopReason: "complete",
});
const requestTools = (...ids: string[]): ModelReply => ({
  message: { role: "assistant", content: "", toolCalls: ids.map(call) },
  stopReason: "tool_calls",
});

test("the loop sends full history, executes multiple tools sequentially, and ends on an answer", async () => {
  const history: Message[] = [{ role: "user", content: "Inspect the files" }];
  const snapshots: Message[][] = [];
  const replies = [requestTools("one", "two"), answer()];
  const connector: ModelConnector = {
    async complete(request) {
      snapshots.push(structuredClone(request.messages));
      return replies.shift()!;
    },
  };
  const execution: string[] = [];
  const status = await runAgent({
    connector,
    systemPrompt: "Tutor",
    messages: history,
    tools: [],
    maxSteps: 10,
    execute: async (request) => {
      execution.push(request.id);
      return result(request);
    },
  });
  assert.equal(status, "complete");
  assert.deepEqual(execution, ["one", "two"]);
  assert.deepEqual(
    snapshots[1]?.map((message) => message.role),
    ["user", "assistant", "tool", "tool"],
  );
  assert.equal(history.length, 5);
});

test("tool exceptions and mismatched results become paired errors the model can inspect", async () => {
  const replies = [requestTools("one", "two"), answer()];
  const messages: Message[] = [];
  await runAgent({
    connector: { complete: async () => replies.shift()! },
    systemPrompt: "",
    messages,
    tools: [],
    maxSteps: 2,
    execute: async (request) => {
      if (request.id === "one") throw new Error("Denied");
      return { ...result(request), callId: "wrong" };
    },
  });
  const results = messages.filter((message) => message.role === "tool");
  assert.deepEqual(
    results.map((entry) => [entry.callId, entry.isError]),
    [
      ["one", true],
      ["two", true],
    ],
  );
  assert.match(results[1]!.content, /did not match/);
});

test("a model that keeps asking for tools stops at the limit", async () => {
  let requests = 0;
  const status = await runAgent({
    connector: {
      complete: async () => {
        requests++;
        return requestTools(String(requests));
      },
    },
    systemPrompt: "",
    messages: [],
    tools: [],
    maxSteps: 3,
    execute: async (request) => result(request),
  });
  assert.equal(status, "limit");
  assert.equal(requests, 3);
});

test("partial or empty responses never execute tools or enter history", async () => {
  for (const reply of [
    { ...requestTools("one"), stopReason: "incomplete" as const },
    answer(""),
    { ...answer(""), stopReason: "tool_calls" as const },
  ]) {
    const messages: Message[] = [];
    const status = await runAgent({
      connector: { complete: async () => reply },
      systemPrompt: "",
      messages,
      tools: [],
      maxSteps: 2,
      execute: async () => {
        throw new Error("Must not execute");
      },
    });
    assert.equal(status, "incomplete");
    assert.deepEqual(messages, []);
  }
});

test("cancellation stops the next tool and leaves a result for every request", async () => {
  const controller = new AbortController();
  const messages: Message[] = [];
  const executed: string[] = [];
  await assert.rejects(
    runAgent({
      connector: { complete: async () => requestTools("one", "two") },
      systemPrompt: "",
      messages,
      tools: [],
      maxSteps: 2,
      signal: controller.signal,
      execute: async (request) => {
        executed.push(request.id);
        controller.abort(new Error("Cancelled"));
        return result(request);
      },
    }),
    /Cancelled/,
  );
  assert.deepEqual(executed, ["one"]);
  assert.deepEqual(
    messages.map((message) => message.role),
    ["assistant", "tool", "tool"],
  );
});

test("a provider failure does not cause another request or execute tools", async () => {
  await assert.rejects(
    runAgent({
      connector: {
        complete: async () => {
          throw new Error("HTTP 429");
        },
      },
      systemPrompt: "",
      messages: [],
      tools: [],
      maxSteps: 10,
      execute: async () => {
        throw new Error("Unexpected tool");
      },
    }),
    /HTTP 429/,
  );
});
