import { executeTool, readOnlyTools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(async ({ connector, config, systemPrompt, signal }) => {
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

  const first = await connector.complete(request);
  if (first.stopReason === "incomplete")
    throw new Error("The model response was incomplete.");
  messages.push(first.message);
  if (!first.message.toolCalls.length) {
    console.log(first.message.content);
    console.error("No tool requested. Try asking explicitly to read a file.");
    return;
  }
  // The MODEL returns a request. OUR CODE validates and executes it locally.
  for (const call of first.message.toolCalls) {
    console.error(
      `Tool request: ${call.name} ${JSON.stringify(call.arguments)}`,
    );
    const result = await executeTool(
      call,
      { cwd: config.cwd, signal, approve: async () => false },
      tools,
    );
    console.error(`Tool result: ${result.isError ? "error" : "success"}`);
    messages.push(result);
  }

  // A second API call lets the model interpret the local tool's result.
  const final = await connector.complete(request);
  console.log(final.message.content);
  if (final.stopReason !== "complete" || final.message.toolCalls.length) {
    throw new Error(
      "The model wants another step. Lesson 4 adds the loop for that.",
    );
  }
});
