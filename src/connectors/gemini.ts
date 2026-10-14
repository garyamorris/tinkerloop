import type { ModelConnector } from "../types.js";
import { array, object, postJson, string, type Fetch } from "./http.js";

export function createGeminiConnector(
  apiKey: string,
  model: string,
  fetchImpl?: Fetch,
): ModelConnector {
  return {
    async complete({ systemPrompt, messages, tools, signal }) {
      const input = messages.flatMap((message): unknown[] => {
        if (message.role === "user") {
          return [
            {
              type: "user_input",
              content: [{ type: "text", text: message.content }],
            },
          ];
        }
        if (message.role === "assistant") return array(message.providerData);
        return [
          {
            type: "function_result",
            name: message.name,
            call_id: message.callId,
            result: [
              {
                type: "text",
                text: message.isError
                  ? `Tool error: ${message.content}`
                  : message.content,
              },
            ],
          },
        ];
      });

      const response = await postJson(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          "x-goog-api-key": apiKey,
        },
        {
          model,
          system_instruction: systemPrompt,
          input,
          store: false,
          tools: tools.map((tool) => ({ type: "function", ...tool })),
        },
        signal,
        fetchImpl,
      );

      // Keep every step, including opaque thought signatures, exactly as received.
      const steps = array(response.steps);
      const toolCalls = steps
        .map(object)
        .filter((step) => step.type === "function_call")
        .map((step) => ({
          id: string(step.id),
          name: string(step.name),
          arguments: step.arguments,
        }));
      const content = steps
        .map(object)
        .filter((step) => step.type === "model_output")
        .flatMap((step) => array(step.content).map(object))
        .filter((part) => part.type === "text")
        .map((part) => string(part.text))
        .join("\n");
      return {
        message: { role: "assistant", content, toolCalls, providerData: steps },
        stopReason:
          response.status === "requires_action" && toolCalls.length
            ? "tool_calls"
            : response.status === "completed"
              ? toolCalls.length
                ? "tool_calls"
                : "complete"
              : "incomplete",
      };
    },
  };
}
