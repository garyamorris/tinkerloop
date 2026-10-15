import type { ModelConnector } from "../types.js";
import { readUsage } from "../usage.js";
import { array, object, postJson, string, type Fetch } from "./http.js";

export function createAnthropicConnector(
  apiKey: string,
  model: string,
  fetchImpl?: Fetch,
): ModelConnector {
  return {
    async complete({ systemPrompt, messages, tools, signal }) {
      const history: { role: string; content: unknown[] }[] = [];
      for (const message of messages) {
        if (message.role === "user") {
          history.push({
            role: "user",
            content: [{ type: "text", text: message.content }],
          });
        } else if (message.role === "assistant") {
          history.push({
            role: "assistant",
            content: array(message.providerData),
          });
        } else {
          const result = {
            type: "tool_result",
            tool_use_id: message.callId,
            content: message.content,
            is_error: message.isError,
          };
          // All results for one assistant turn belong in the same user message.
          const last = history.at(-1);
          if (last?.role === "user") last.content.push(result);
          else history.push({ role: "user", content: [result] });
        }
      }

      const response = await postJson(
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model,
          // Every loop step resends the same prefix: tools, system prompt, and
          // history. Anthropic caches only when asked; this caches up to the
          // last block, so the next step reads that prefix at a lower price.
          cache_control: { type: "ephemeral" },
          system: systemPrompt,
          messages: history,
          // Reasoning counts toward this limit, and write_file sends a whole file.
          max_tokens: 16_000,
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters,
          })),
        },
        signal,
        fetchImpl,
      );

      const blocks = array(response.content);
      const toolCalls = blocks
        .map(object)
        .filter((part) => part.type === "tool_use")
        .map((part) => ({
          id: string(part.id),
          name: string(part.name),
          arguments: part.input,
        }));
      const content = blocks
        .map(object)
        .filter((part) => part.type === "text")
        .map((part) => string(part.text))
        .join("\n");
      const complete = ["end_turn", "stop_sequence", "refusal"].includes(
        String(response.stop_reason),
      );
      return {
        usage: readUsage("anthropic", response.usage),
        message: {
          role: "assistant",
          content,
          toolCalls,
          providerData: blocks,
        },
        stopReason:
          response.stop_reason === "tool_use"
            ? "tool_calls"
            : complete
              ? "complete"
              : "incomplete",
      };
    },
  };
}
