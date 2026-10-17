import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

await lesson(
  {
    number: 2,
    title: "Remember a conversation",
    goal: "Memory is an array of messages, sent again with every request.",
  },
  async ({ connector, config, systemPrompt, signal, display }) => {
    // Memory is an array, not a special ability of the model.
    const messages: Message[] = [
      {
        role: "user",
        content:
          config.prompt || "My project is called Acorn. Remember that name.",
      },
    ];
    display.user(messages[0]!.content);
    display.request(1, 2, messages);
    const first = await connector.complete({
      systemPrompt,
      messages,
      tools: [],
      signal,
    });
    if (first.stopReason !== "complete")
      throw new Error("The first response was incomplete.");
    display.reply(first);
    messages.push(first.message);
    messages.push({ role: "user", content: "What did I just tell you?" });
    display.user("What did I just tell you?");
    display.request(2, 2, messages);

    // Sending all three messages lets the model answer using the earlier exchange.
    const second = await connector.complete({
      systemPrompt,
      messages,
      tools: [],
      signal,
    });
    display.reply(second);
    messages.push(second.message);
    display.finish(messages, 0);
    if (second.stopReason !== "complete")
      throw new Error("The follow-up response was incomplete.");
  },
);
