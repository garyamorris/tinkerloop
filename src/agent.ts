import type {
  AssistantMessage,
  Message,
  ModelConnector,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./types.js";

export interface AgentOptions {
  connector: ModelConnector;
  systemPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  execute(call: ToolCall): Promise<ToolResult>;
  maxSteps: number;
  signal?: AbortSignal;
  onMessage?(message: AssistantMessage): void;
  onTool?(call: ToolCall): void;
}

// This is the harness. The model proposes actions; this program runs them.
// The mutable messages array makes conversation memory visible to the caller.
export async function runAgent(
  options: AgentOptions,
): Promise<"complete" | "limit" | "incomplete"> {
  const {
    connector,
    systemPrompt,
    messages,
    tools,
    execute,
    maxSteps,
    signal,
  } = options;
  for (let step = 0; step < maxSteps; step++) {
    signal?.throwIfAborted();
    const reply = await connector.complete({
      systemPrompt,
      messages,
      tools,
      signal,
    });
    signal?.throwIfAborted();
    options.onMessage?.(reply.message);
    // A partial tool call cannot safely be executed or added to later history.
    if (reply.stopReason === "incomplete") return "incomplete";
    const calls = reply.message.toolCalls;
    if (reply.stopReason === "tool_calls" && calls.length === 0)
      return "incomplete";
    if (!calls.length && !reply.message.content.trim()) return "incomplete";
    messages.push(reply.message);
    if (!calls.length) return "complete";

    for (const call of calls) {
      if (signal?.aborted) {
        messages.push({
          role: "tool",
          callId: call.id,
          name: call.name,
          content: "Cancelled; tool was not executed.",
          isError: true,
        });
        continue;
      }
      options.onTool?.(call);
      // Pair every request with a result, including failed or denied requests.
      try {
        const result = await execute(call);
        if (result.callId !== call.id || result.name !== call.name)
          throw new Error("Tool result did not match its request.");
        messages.push(result);
      } catch (error) {
        messages.push({
          role: "tool",
          callId: call.id,
          name: call.name,
          content: error instanceof Error ? error.message : String(error),
          isError: true,
        });
      }
    }
    signal?.throwIfAborted();
  }
  return "limit";
}
