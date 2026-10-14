import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(async ({ connector, config, systemPrompt, signal }) => {
  // Memory is an array, not a special ability of the model.
  const messages: Message[] = [
    {
      role: "user",
      content:
        config.prompt || "My project is called Acorn. Remember that name.",
    },
  ];
  const first = await connector.complete({
    systemPrompt,
    messages,
    tools: [],
    signal,
  });
  if (first.stopReason !== "complete")
    throw new Error("The first response was incomplete.");
  console.log(`First reply: ${first.message.content}`);
  messages.push(first.message);
  messages.push({ role: "user", content: "What did I just tell you?" });

  // Sending all three messages lets the model answer using the earlier exchange.
  const second = await connector.complete({
    systemPrompt,
    messages,
    tools: [],
    signal,
  });
  console.log(`Follow-up: ${second.message.content}`);
  if (second.stopReason !== "complete")
    throw new Error("The follow-up response was incomplete.");
});
