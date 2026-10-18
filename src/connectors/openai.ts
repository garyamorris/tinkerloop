import type { ReasoningEffort } from "../config.js";
import type { ModelConnector } from "../types.js";
import { readUsage } from "../usage.js";
import {
  array,
  object,
  parseArguments,
  postJson,
  string,
  type Fetch,
} from "./http.js";

export function createOpenAIConnector(
  apiKey: string,
  model: string,
  fetchImpl?: Fetch,
  reasoningEffort?: ReasoningEffort,
): ModelConnector {
  return {
    async complete({ systemPrompt, messages, tools, signal }) {
      const input = messages.flatMap((message): unknown[] => {
        if (message.role === "user")
          return [{ role: "user", content: message.content }];
        if (message.role === "assistant") return array(message.providerData);
        return [
          {
            type: "function_call_output",
            call_id: message.callId,
            output: message.content,
          },
        ];
      });

      const response = await postJson(
        "https://api.openai.com/v1/responses",
        {
          Authorization: `Bearer ${apiKey}`,
        },
        {
          model,
          instructions: systemPrompt,
          input,
          tools: tools.map((tool) => ({
            type: "function",
            ...tool,
            strict: true,
          })),
          store: false,
          include: ["reasoning.encrypted_content"],
          // Without a level, each model uses its default, which may be no reasoning.
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          // Reasoning counts toward this limit, and write_file sends a whole file.
          max_output_tokens: 16_000,
        },
        signal,
        fetchImpl,
      );

      const output = array(response.output);
      const toolCalls = output
        .map(object)
        .filter((item) => item.type === "function_call")
        .map((item) => ({
          id: string(item.call_id),
          name: string(item.name),
          arguments: parseArguments(item.arguments),
        }));
      const content = output
        .map(object)
        .filter((item) => item.type === "message")
        .flatMap((item) => array(item.content).map(object))
        .map((part) =>
          part.type === "output_text"
            ? string(part.text)
            : part.type === "refusal"
              ? string(part.refusal)
              : "",
        )
        .join("\n");

      return {
        usage: readUsage("openai", response.usage),
        message: {
          role: "assistant",
          content,
          toolCalls,
          providerData: output,
        },
        stopReason:
          response.status !== "completed"
            ? "incomplete"
            : toolCalls.length
              ? "tool_calls"
              : "complete",
      };
    },
  };
}
