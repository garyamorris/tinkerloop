// These are our application's types. Each connector translates them to its API.
export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown; // Model output is untrusted until the tool validates it.
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: "string"; description: string }>;
    required: string[];
    additionalProperties: false;
  };
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls: ToolCall[];
  // Keep the original response blocks: reasoning metadata must survive a round trip.
  providerData?: unknown;
}

export interface ToolResult {
  role: "tool";
  callId: string;
  name: string;
  content: string;
  isError: boolean;
}

export type Message =
  | { role: "user"; content: string }
  | AssistantMessage
  | ToolResult;

export interface ModelRequest {
  systemPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ModelReply {
  message: AssistantMessage;
  stopReason: "complete" | "tool_calls" | "incomplete";
  usage?: TokenUsage;
}

// Cache reads/writes are parts of input, not extra tokens to add to it.
// Missing fields mean "not reported"; a reported zero is still useful data.
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

export interface ModelConnector {
  complete(request: ModelRequest): Promise<ModelReply>;
}
