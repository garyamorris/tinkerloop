import { lesson } from "../shared.js";
import type { Message } from "../../src/types.js";

await lesson(async ({ connector, config, systemPrompt, signal, display }) => {
  // One user message goes in. One assistant response comes out.
  const messages: Message[] = [
    {
      role: "user",
      content:
        config.prompt ||
        "What is a coding-agent harness around a language model? Explain its model connection, tools, and execution loop in three sentences.",
    },
  ];
  // The display only prints. It does not call the model or execute tools.
  display.user(messages[0]!.content);
  display.request(1, 1, messages);
  const reply = await connector.complete({
    systemPrompt,
    messages,
    tools: [],
    signal,
  });
  display.reply(reply);
  display.finish([...messages, reply.message], 0);
  if (reply.stopReason !== "complete")
    throw new Error("The model did not finish its response.");
});
