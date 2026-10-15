import type {
  AssistantMessage,
  Message,
  ModelConnector,
  ToolCall,
  ToolDefinition,
} from "../types.js";
import { parseArguments } from "./http.js";

// The terminal pieces this connector needs. It never reads files or runs tools.
export interface HumanConsole {
  show(text: string): void;
  read(signal?: AbortSignal): Promise<string | undefined>;
}

// You play the model. Each request shows what a provider's API would receive,
// and you reply with text (an answer) or tool requests. The harness then does
// exactly what it does for a real model. There is no network, key, or cost.
export function createHumanConnector(io: HumanConsole): ModelConnector {
  let requests = 0;
  let calls = 0;
  let lastSystem: string | undefined;
  let lastTools: string | undefined;
  return {
    async complete({ systemPrompt, messages, tools, signal }) {
      signal?.throwIfAborted();
      requests++;
      const out = [`━━ Request ${requests} · you are the model ━━`, ""];
      // An API has no memory: everything below arrives again on every request.
      const toolText = tools.length ? tools.map(describeTool).join("\n") : "";
      out.push(
        systemPrompt === lastSystem
          ? "System prompt: unchanged, sent again"
          : `System prompt:\n${indent(systemPrompt)}`,
        tools.length === 0
          ? "Tools: none"
          : toolText === lastTools
            ? `Tools: ${tools.length} unchanged, sent again`
            : `Tools:\n${indent(toolText)}`,
        "",
      );
      lastSystem = systemPrompt;
      lastTools = toolText;

      const lastReply = messages.findLastIndex(
        (message) => message.role === "assistant",
      );
      if (lastReply >= 0) {
        out.push("Messages you have already seen:");
        messages
          .slice(0, lastReply + 1)
          .forEach((message, index) =>
            out.push(`  ${index + 1}. ${summary(message)}`),
          );
        out.push("", "New since your last reply:");
      } else out.push(`Messages (${messages.length}):`);
      messages.slice(lastReply + 1).forEach((message, index) => {
        out.push(`  ${lastReply + index + 2}. ${heading(message)}`);
        out.push(indent(message.content.trimEnd() || "(empty)", "     "));
      });
      out.push("", instructions(tools));
      io.show(out.join("\n"));

      let reply = await io.read(signal);
      while (!reply?.trim()) {
        if (reply === undefined)
          throw new Error("Input ended before the human model replied.");
        io.show("A model always replies. Type an answer or a tool request.");
        reply = await io.read(signal);
      }
      const message = parseReply(reply, tools, () => `call_${++calls}`);
      return {
        message,
        stopReason: message.toolCalls.length ? "tool_calls" : "complete",
      };
    },
  };
}

// "name {json}" requests a tool. Several requests may go on separate lines.
// Anything else is an answer. Invalid JSON is passed on unchanged, so the tool
// validator reports the mistake just as it would for a real model.
export function parseReply(
  text: string,
  tools: ToolDefinition[],
  nextId: () => string,
): AssistantMessage {
  const answer: AssistantMessage = {
    role: "assistant",
    content: text.trim(),
    toolCalls: [],
  };
  // With no tools offered, a provider would return only text.
  if (!tools.length) return answer;
  const pattern = /^([A-Za-z_][\w-]*)\s*(\{[\s\S]*\})$/;
  const lines = answer.content.split("\n").filter((line) => line.trim());
  const perLine = lines.map((line) => pattern.exec(line.trim()));
  const requests = perLine.every(
    (match) => match && validObject(parseArguments(match[2])),
  )
    ? perLine
    : [pattern.exec(answer.content)];
  if (!requests.every(Boolean)) return answer;
  const toolCalls: ToolCall[] = requests.map((match) => ({
    id: nextId(),
    name: match![1]!,
    arguments: parseArguments(match![2]),
  }));
  return { role: "assistant", content: "", toolCalls };
}

function validObject(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeTool(tool: ToolDefinition): string {
  const fields = Object.entries(tool.parameters.properties);
  return [
    `${tool.name} {${fields.map(([name]) => `"${name}": "…"`).join(", ")}}`,
    `  ${tool.description}`,
    ...fields.map(([name, field]) => `  ${name}: ${field.description}`),
  ].join("\n");
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? flat.slice(0, 89) + "…" : flat;
}

function summary(message: Message): string {
  if (message.role === "assistant") {
    const requests = message.toolCalls.map(
      (call) => `→ ${call.name} ${JSON.stringify(call.arguments)}`,
    );
    return `you: ${oneLine([message.content, ...requests].filter(Boolean).join(" "))}`;
  }
  return `${heading(message)}: ${oneLine(message.content)}`;
}

function heading(message: Message): string {
  if (message.role !== "tool") return message.role;
  return `tool result · ${message.name} · ${message.callId}${message.isError ? " · error" : ""}`;
}

function indent(text: string, prefix = "  "): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function instructions(tools: ToolDefinition[]): string {
  if (!tools.length) return "Type your answer. No tools were offered.";
  const tool = tools[0]!;
  const example = `${tool.name} {${Object.keys(tool.parameters.properties)
    .map((name) => `"${name}": "…"`)
    .join(", ")}}`;
  return [
    "Type an answer, or request a tool as its name and a JSON object:",
    `  ${example}`,
    "Put several requests on separate lines. Inside JSON, write a line break as \\n.",
  ].join("\n");
}
