import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAgent } from "../src/agent.js";
import { createHumanConnector, parseReply } from "../src/connectors/human.js";
import { executeTool, readOnlyTools, workspaceRoot } from "../src/tools.js";
import type { Message } from "../src/types.js";

// A scripted person: each read returns the next typed reply.
function person(replies: (string | undefined)[]) {
  const shown: string[] = [];
  return {
    shown,
    io: {
      show: (text: string) => shown.push(text),
      read: async () => replies.shift(),
    },
  };
}

test("a typed reply becomes an answer or tool requests, never anything hidden", () => {
  let id = 0;
  const next = () => `call_${++id}`;
  const read = readOnlyTools.filter((tool) => tool.name === "read_file");

  assert.deepEqual(parseReply("  It adds numbers. ", read, next), {
    role: "assistant",
    content: "It adds numbers.",
    toolCalls: [],
  });
  // Without offered tools, a provider would return only text.
  assert.equal(
    parseReply('read_file {"path": "a"}', [], next).toolCalls.length,
    0,
  );
  assert.deepEqual(
    parseReply('read_file {"path": "a"}', read, next).toolCalls,
    [{ id: "call_1", name: "read_file", arguments: { path: "a" } }],
  );
  assert.deepEqual(
    parseReply('read_file {"path": "a"}\nlist_files {"path": "."}', read, next)
      .toolCalls,
    [
      { id: "call_2", name: "read_file", arguments: { path: "a" } },
      { id: "call_3", name: "list_files", arguments: { path: "." } },
    ],
  );
  assert.deepEqual(
    parseReply('read_file {\n  "path": "a"\n}', read, next).toolCalls,
    [{ id: "call_4", name: "read_file", arguments: { path: "a" } }],
  );
  // Broken JSON reaches the tool validator, as a real model's mistake would.
  assert.deepEqual(parseReply("read_file {path: a}", read, next).toolCalls, [
    { id: "call_5", name: "read_file", arguments: "{path: a}" },
  ]);
});

test("each request shows what an API receives, including resent history", async () => {
  const typed = person(["", "My answer", "Second answer"]);
  const connector = createHumanConnector(typed.io);
  const messages: Message[] = [{ role: "user", content: "First question" }];
  const first = await connector.complete({
    systemPrompt: "Be brief.",
    messages,
    tools: [],
  });
  assert.equal(first.stopReason, "complete");
  assert.equal(first.message.content, "My answer");
  assert.match(typed.shown[0]!, /You are the model · request 1 this session/);
  assert.match(typed.shown[0]!, /System prompt:\n {2}Be brief\./);
  assert.match(typed.shown[0]!, /1\. user\n {5}First question/);
  assert.match(typed.shown[1]!, /always replies/); // The empty reply was refused.

  messages.push(first.message, { role: "user", content: "Follow-up" });
  await connector.complete({ systemPrompt: "Be brief.", messages, tools: [] });
  const second = typed.shown[2]!;
  assert.match(second, /System prompt: unchanged, sent again/);
  assert.match(
    second,
    /already seen:\n {2}1\. user: First question\n {2}2\. you: My answer/,
  );
  assert.match(
    second,
    /New since your last reply:\n {2}3\. user\n {5}Follow-up/,
  );

  await assert.rejects(
    connector.complete({ systemPrompt: "", messages, tools: [] }),
    /Input ended/,
  );
});

test("the harness runs a human model's tool request exactly like a real one", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "tinkerloop-human-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await writeFile(join(folder, "note.txt"), "hello from disk");
  const cwd = await workspaceRoot(folder);
  const typed = person(['read_file {"path": "note.txt"}', "It says hello."]);
  const messages: Message[] = [{ role: "user", content: "Read note.txt" }];
  const status = await runAgent({
    connector: createHumanConnector(typed.io),
    systemPrompt: "Tutor",
    messages,
    tools: readOnlyTools,
    maxSteps: 3,
    execute: (call) =>
      executeTool(call, { cwd, approve: async () => false }, readOnlyTools),
  });
  assert.equal(status, "complete");
  assert.deepEqual(
    messages.map((message) => message.role),
    ["user", "assistant", "tool", "assistant"],
  );
  assert.equal(messages[2]?.content, "hello from disk");
  // The second request showed the person the tool result they asked for.
  assert.match(
    typed.shown[1]!,
    /tool result · read_file · call_1\n {5}hello from disk/,
  );
});
