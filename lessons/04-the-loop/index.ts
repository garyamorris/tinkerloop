import { executeTool, readOnlyTools as tools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(async ({ connector, config, systemPrompt, signal }) => {
  const messages: Message[] = [
    {
      role: "user",
      content:
        config.prompt ||
        "List the files here, read README.md, and explain what this project teaches.",
    },
  ];

  // Compare this to lesson 3: a bounded for-loop is the main addition.
  for (let step = 0; step < config.maxSteps; step++) {
    signal.throwIfAborted();
    console.error(`Model request ${step + 1}/${config.maxSteps}`);
    const reply = await connector.complete({
      systemPrompt,
      messages,
      tools,
      signal,
    });
    if (reply.stopReason === "incomplete")
      throw new Error("The model response was incomplete.");
    messages.push(reply.message);
    if (reply.message.content) console.log(reply.message.content);
    if (!reply.message.toolCalls.length) {
      if (reply.stopReason !== "complete" || !reply.message.content.trim())
        throw new Error("The model returned no answer or tool calls.");
      return; // A normal answer ends this user turn.
    }
    for (const call of reply.message.toolCalls) {
      signal.throwIfAborted();
      console.error(`→ ${call.name}`);
      const result = await executeTool(
        call,
        { cwd: config.cwd, signal, approve: async () => false },
        tools,
      );
      messages.push(result);
    }
    // Next iteration sends the updated history, including the tool results.
  }
  throw new Error(
    `Stopped after ${config.maxSteps} requests; the task may be unfinished.`,
  );
});
