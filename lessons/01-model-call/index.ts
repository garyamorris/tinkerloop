import { lesson } from "../shared.js";

await lesson(async ({ connector, config, systemPrompt, signal }) => {
  // One user message goes in. One assistant response comes out.
  const reply = await connector.complete({
    systemPrompt,
    messages: [
      {
        role: "user",
        content:
          config.prompt ||
          "What is a coding-agent harness around a language model? Explain its model connection, tools, and execution loop in three sentences.",
      },
    ],
    tools: [],
    signal,
  });
  console.log(reply.message.content);
  if (reply.stopReason !== "complete")
    throw new Error("The model did not finish its response.");
});
