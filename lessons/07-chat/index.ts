import { runAgent } from "../../src/agent.js";
import { executeTool, tools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

// New in this lesson: an outer loop. Each message you type starts a turn, and
// each turn runs lesson 6's inner model/tool loop over the same history.
await lesson(
  {
    number: 7,
    title: "Wrap the loop in a chat",
    goal: "Each message you type starts a turn of the inner model/tool loop.",
    workspace: "examples/tiny-project",
    chat: true,
  },
  async ({
    connector,
    config,
    systemPrompt,
    signal,
    display,
    approve,
    read,
  }) => {
    const messages: Message[] = [];
    display.note("Type a task. /clear forgets the conversation; /exit quits.");
    let prompt: string | undefined = config.prompt;
    if (prompt) display.user(prompt);
    else prompt = await read();

    while (prompt !== undefined && prompt.trim() !== "/exit") {
      const text = prompt.trim();
      if (text === "/clear") {
        // Forgetting is just emptying the array. The model never remembered.
        messages.length = 0;
        display.clearContext();
        display.note("History cleared.");
      } else if (text) {
        messages.push({ role: "user", content: text });
        const status = await runAgent({
          connector,
          systemPrompt,
          messages,
          tools,
          maxSteps: config.maxSteps,
          signal,
          execute: (call) =>
            executeTool(call, { cwd: config.cwd, signal, approve }),
          onRequest: (step) => display.request(step, config.maxSteps, messages),
          onReply: (reply) => display.reply(reply),
          onTool: (call) => display.tool(call),
          onToolResult: (result, call, duration) =>
            display.toolResult(result, call, duration),
        });
        if (status !== "complete")
          display.note("This turn stopped early. Ask the model to continue.");
        display.finish(messages, tools.length);
      }
      prompt = await read();
    }
  },
);
