import type { ModelConnector } from "../types.js";
import {
  array,
  object,
  parseArguments,
  postJson,
  string,
  type Fetch,
} from "./http.js";

// "Compatible" here means Chat Completions with function tools. Not every server
// or model implements that protocol, even if it offers a /chat/completions URL.
export function createCompatibleConnector(
  baseUrl: string,
  apiKey: string,
  model: string,
  fetchImpl?: Fetch,
): ModelConnector {
  return {
    async complete({ systemPrompt, messages, tools, signal }) {
      const history: unknown[] = [{ role: "system", content: systemPrompt }];
      for (const message of messages) {
        if (message.role === "user")
          history.push({ role: "user", content: message.content });
        else if (message.role === "assistant")
          history.push(message.providerData);
        else
          history.push({
            role: "tool",
            tool_call_id: message.callId,
            content: message.content,
          });
      }

      const response = await postJson(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        {
          model,
          messages: history,
          ...(tools.length
            ? {
                tools: tools.map((tool) => ({
                  type: "function",
                  function: tool,
                })),
              }
            : {}),
        },
        signal,
        fetchImpl,
      );

      const choice = object(array(response.choices)[0]);
      const message = object(choice.message);
      const toolCalls = array(message.tool_calls ?? [])
        .map(object)
        .map((call) => {
          const fn = object(call.function);
          return {
            id: string(call.id),
            name: string(fn.name),
            arguments: parseArguments(fn.arguments),
          };
        });
      return {
        message: {
          role: "assistant",
          content: message.content == null ? "" : string(message.content),
          toolCalls,
          providerData: message,
        },
        stopReason:
          choice.finish_reason === "tool_calls"
            ? "tool_calls"
            : choice.finish_reason === "stop"
              ? "complete"
              : "incomplete",
      };
    },
  };
}
