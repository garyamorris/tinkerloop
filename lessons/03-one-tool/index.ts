import { executeTool, readOnlyTools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(async ({ connector, config, systemPrompt, signal, display }) => {
  const tools = readOnlyTools.filter((tool) => tool.name === "read_file");
  const messages: Message[] = [
    {
      role: "user",
      content:
        config.prompt ||
        "Read README.md with read_file, then summarize it in two sentences.",
    },
  ];
  const request = {
    systemPrompt: `${systemPrompt} Use one round of tool calls, then explain the results.`,
    messages,
    tools,
    signal,
  };

  display.user(messages[0]!.content);
  display.request(1, 2, messages);
  const first = await connector.complete(request);
  display.reply(first);
  if (first.stopReason === "incomplete")
    throw new Error("The model response was incomplete.");
  messages.push(first.message);
  if (!first.message.toolCalls.length) {
    display.note("No tool requested. Try asking explicitly to read a file.");
    display.finish(messages, tools.length);
    return;
  }
  // The MODEL returns a request. OUR CODE validates and executes it locally.
  for (const call of first.message.toolCalls) {
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

  // A second API call lets the model interpret the local tool's result.
  display.request(2, 2, messages);
  const final = await connector.complete(request);
  display.reply(final);
  display.finish([...messages, final.message], tools.length);
  if (final.stopReason !== "complete" || final.message.toolCalls.length) {
    throw new Error(
      "The model wants another step. Lesson 4 adds the loop for that.",
    );
  }
});
