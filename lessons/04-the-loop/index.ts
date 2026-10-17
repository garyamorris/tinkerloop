import { executeTool, readOnlyTools as tools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(
  {
    number: 4,
    title: "Build the loop",
    goal: "Repeat requests until the model answers instead of asking for a tool.",
  },
  async ({ connector, config, systemPrompt, signal, display }) => {
    const messages: Message[] = [
      {
        role: "user",
        content:
          config.prompt ||
          "List the files here, read README.md, and explain what this project teaches.",
      },
    ];

    display.user(messages[0]!.content);
    // Compare this to lesson 3: a bounded for-loop is the main addition.
    for (let step = 0; step < config.maxSteps; step++) {
      signal.throwIfAborted();
      display.request(step + 1, config.maxSteps, messages);
      const reply = await connector.complete({
        systemPrompt,
        messages,
        tools,
        signal,
      });
      display.reply(reply);
      if (reply.stopReason === "incomplete")
        throw new Error("The model response was incomplete.");
      messages.push(reply.message);
      if (!reply.message.toolCalls.length) {
        if (reply.stopReason !== "complete" || !reply.message.content.trim())
          throw new Error("The model returned no answer or tool calls.");
        display.finish(messages, tools.length);
        return; // A normal answer ends this user turn.
      }
      for (const call of reply.message.toolCalls) {
        signal.throwIfAborted();
        display.tool(call);
        const started = performance.now();
        const result = await executeTool(
          call,
          { cwd: config.cwd, signal, approve: async () => false },
          tools,
        );
        display.toolResult(result, call, performance.now() - started);
        messages.push(result);
      }
      // Next iteration sends the updated history, including the tool results.
    }
    display.finish(messages, tools.length);
    throw new Error(
      `Stopped after ${config.maxSteps} requests; the task may be unfinished.`,
    );
  },
);
