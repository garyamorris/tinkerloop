import { homedir } from "node:os";
import type { Config } from "./config.js";
import type {
  Message,
  ModelReply,
  TokenUsage,
  ToolCall,
  ToolResult,
} from "./types.js";
import {
  cleanText,
  literalText,
  paint,
  renderMarkdown,
  wrapText,
} from "./render.js";
import { summarizeUsage, tokenText, usageFields } from "./usage.js";
import type { Screen } from "./screen.js";

interface Output {
  write(text: string): unknown;
  isTTY?: boolean;
  columns?: number;
}

const labels: Record<keyof TokenUsage, string> = {
  inputTokens: "Input",
  outputTokens: "Output",
  cacheReadTokens: "Cache read",
  cacheWriteTokens: "Cache write",
  reasoningTokens: "Reasoning (included in output)",
};

function counted(value: number, word: string): string {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

export const chatHelp = `Chat commands
  /help     Show these commands
  /usage    Show session token totals and reporting coverage
  /context  Inspect conversation size and the last reported input
  /clear    Clear conversation context; keep session usage totals
  /exit     Quit
`;

function toolTarget(call: ToolCall): string {
  if (!call.arguments || typeof call.arguments !== "object") return "";
  const args = call.arguments as Record<string, unknown>;
  const target = args.path ?? args.command;
  return typeof target === "string"
    ? cleanText(target).split("\n")[0]!.slice(0, 100)
    : "";
}

// Presentation observes the harness. It never owns the agent loop or tools.
// Separate stdout/stderr options also let tests inspect real output behavior.
export function createDisplay(
  config: Pick<Config, "provider" | "model" | "cwd" | "contextWindow">,
  options: {
    stdout?: Output;
    stderr?: Output;
    env?: NodeJS.ProcessEnv;
    screen?: Pick<Screen, "write" | "setHeader" | "setFooter" | "setStatus">;
  } = {},
) {
  const screen = options.screen;
  const stdout: Output = screen
    ? {
        write: screen.write,
        isTTY: true,
        get columns() {
          return process.stdout.columns;
        },
      }
    : (options.stdout ?? process.stdout);
  const stderr = screen ? stdout : (options.stderr ?? process.stderr);
  const env = options.env ?? process.env;
  const styled = Boolean(stdout.isTTY && stderr.isTTY && env.TERM !== "dumb");
  const color = styled && !Object.hasOwn(env, "NO_COLOR");
  const width = () =>
    Math.max(24, Math.min(100, stdout.columns ?? stderr.columns ?? 80));
  const muted = (text: string) => paint(text, "90", color);
  const accent = (text: string) => paint(text, "1;36", color);
  const samples: (TokenUsage | undefined)[] = [];
  let lastUsage: TokenUsage | undefined;
  let requests = 0;
  let requestStarted = performance.now();
  const started = performance.now();
  let historySize = 0;
  let toolsInHistory = 0;
  const log = (text: string) => stderr.write(`${cleanText(text)}\n`);
  // Only our own style codes reach output. Untrusted values are cleaned first.
  const status = (text: string) =>
    stderr.write(`${muted(wrapText(cleanText(text), width(), "  "))}\n`);

  function usageLine(usage: TokenUsage | undefined): string {
    const short = (value: number | undefined) =>
      value === undefined ? "—" : tokenText(value);
    return `in ${short(usage?.inputTokens)} · out ${short(usage?.outputTokens)} · cache read ${short(usage?.cacheReadTokens)} · write ${short(usage?.cacheWriteTokens)}`;
  }

  function updateFooter(): void {
    if (!screen) return;
    const { totals, reports } = summarizeUsage(samples);
    const input = lastUsage?.inputTokens;
    const measured =
      input === undefined ? "not reported" : `${tokenText(input)} tokens`;
    const window =
      input !== undefined && config.contextWindow
        ? ` · ${((100 * input) / config.contextWindow).toFixed(1)}% of ${tokenText(config.contextWindow)}`
        : "";
    const partial =
      (reports.inputTokens ?? 0) < requests ||
      (reports.outputTokens ?? 0) < requests;
    screen.setFooter([
      `Last · ${usageLine(lastUsage)}`,
      `Context · ${measured}${window} · ${counted(historySize, "message")}`,
      `Session · ${counted(requests, "request")} · in ${tokenText(totals.inputTokens)} · out ${tokenText(totals.outputTokens)}${partial ? " · partial" : ""}`,
    ]);
  }

  function context(messages: Message[], toolCount: number): void {
    const input = lastUsage?.inputTokens;
    let measured = tokenText(input);
    if (input !== undefined) measured += " tokens";
    if (input !== undefined && config.contextWindow) {
      measured += ` / ${tokenText(config.contextWindow)} (${((100 * input) / config.contextWindow).toFixed(1)}% of configured window)`;
    }
    status(`Context · last response input: ${measured}`);
    status(
      `${counted(messages.length, "history message")} · ${counted(messages.filter((message) => message.role === "tool").length, "tool result")} · ${toolCount} available tools`,
    );
    if (!config.contextWindow)
      status("Window size unset · set --context-window to show a percentage");
  }

  return {
    prompt: styled ? `\n${accent("  you › ")}` : "\nYou > ",
    approvalPrompt: styled
      ? `${accent("  Allow this action?")} [y/N] `
      : "Allow this action? [y/N] ",
    banner(title?: string): void {
      const home = homedir();
      const workspace =
        config.cwd.startsWith(home + "/") || config.cwd.startsWith(home + "\\")
          ? "~" + config.cwd.slice(home.length)
          : config.cwd;
      if (screen) {
        screen.setHeader([
          `<> Tinkerloop${title ? ` / ${title}` : ""} · ${config.provider} · ${config.model}`,
          workspace,
        ]);
        screen.write(
          `\n${accent("  A tiny coding harness, explained from the ground up.")}\n\n`,
        );
        this.note(
          title
            ? "Follow the lesson below. Token usage appears in the footer."
            : "Describe a task to get started. /help lists chat commands.",
        );
        screen.write("\n");
        updateFooter();
        return;
      }
      stderr.write(
        `\n${accent("  <> Tinkerloop")}${title ? muted(` / ${cleanText(title)}`) : ""}\n`,
      );
      status("A tiny coding harness, explained from the ground up.");
      status(`${config.provider} · ${config.model}`);
      status(workspace);
      status(
        title
          ? "Token usage follows each response · --help for options"
          : "/help · /usage · /context · /clear · /exit",
      );
      stderr.write("\n");
    },
    user(text: string): void {
      stderr.write(
        `${paint("  you", "1;32", color)}\n${wrapText(cleanText(text), width(), "  ")}\n\n`,
      );
    },
    request(step: number, limit: number, messages?: Message[]): void {
      if (messages) historySize = messages.length;
      requests++;
      requestStarted = performance.now();
      if (screen) {
        screen.setStatus(`Thinking · request ${step}/${limit} · Ctrl+C cancel`);
        updateFooter();
        return;
      }
      status(`thinking · request ${step}/${limit}`);
    },
    reply(reply: ModelReply): void {
      samples.push(reply.usage);
      lastUsage = reply.usage;
      if (reply.message.content) {
        if (styled)
          stdout.write(
            `\n${accent("  tinkerloop")}\n${renderMarkdown(reply.message.content, width(), color)}\n\n`,
          );
        else stdout.write(`${cleanText(reply.message.content)}\n`);
      }
      if (screen) {
        screen.setStatus(
          `Response · ${((performance.now() - requestStarted) / 1000).toFixed(1)}s${reply.stopReason === "incomplete" ? " · incomplete" : ""}`,
        );
        updateFooter();
        return;
      }
      status(
        `tokens · ${usageLine(reply.usage)} · ${((performance.now() - requestStarted) / 1000).toFixed(1)}s${reply.stopReason === "incomplete" ? " · incomplete" : ""}`,
      );
      if (!reply.usage)
        status("Token usage was not reported by this provider.");
    },
    tool(call: ToolCall): void {
      status(`→ ${call.name} ${toolTarget(call)}`.trimEnd());
      screen?.setStatus(`Running ${call.name} · Ctrl+C cancel`);
    },
    toolResult(result: ToolResult, call: ToolCall, durationMs: number): void {
      const name = `${call.name} ${toolTarget(call)}`.trimEnd();
      stderr.write(
        `${paint(`  ${result.isError ? "✗" : "✓"} ${cleanText(name)}`, result.isError ? "31" : "32", color)}${muted(` · ${Math.round(durationMs)} ms`)}\n`,
      );
      if (
        call.name === "run_command" &&
        (!result.isError || result.content.startsWith("{"))
      ) {
        try {
          const command = JSON.parse(result.content) as {
            stdout?: unknown;
            stderr?: unknown;
            exitCode?: unknown;
            timedOut?: unknown;
          };
          status(
            `exit ${String(command.exitCode)}${command.timedOut ? " · timed out" : ""}`,
          );
          const output = [command.stdout, command.stderr]
            .filter((value): value is string => typeof value === "string")
            .join("\n")
            .trim();
          if (output)
            this.note(
              output.split("\n").slice(0, 8).join("\n") +
                (output.split("\n").length > 8
                  ? "\n… more output sent to the model"
                  : ""),
            );
          return;
        } catch {
          /* Truncated JSON is still useful as a short text preview. */
        }
      }
      if (result.isError || call.name === "write_file")
        this.note(result.content.split("\n").slice(0, 4).join("\n"));
    },
    approval(preview: string): void {
      stderr.write(`\n${accent("  Approval required")}\n`);
      for (const line of literalText(preview).split("\n"))
        stderr.write(`  ${line}\n`);
      stderr.write("\n");
    },
    note(text: string): void {
      for (const line of cleanText(text).split("\n"))
        log(wrapText(line, width(), "  "));
    },
    usage(): void {
      const { totals, reports } = summarizeUsage(samples);
      this.note(
        `Session usage · ${counted(requests, "request")} · ${((performance.now() - started) / 1000).toFixed(1)}s elapsed`,
      );
      for (const field of usageFields) {
        const coverage = reports[field];
        this.note(
          `${labels[field]}: ${tokenText(totals[field])}${coverage ? ` (${coverage}/${requests} ${requests === 1 ? "request" : "requests"} reported)` : ""}`,
        );
      }
      this.note(
        "Cache counts are included in input. Totals count every request, including resent history.",
      );
    },
    context,
    finish(messages: Message[], toolCount: number): void {
      historySize = messages.length;
      toolsInHistory = messages.filter(
        (message) => message.role === "tool",
      ).length;
      if (screen) {
        screen.setStatus(
          `Ready · ${counted(toolsInHistory, "tool result")} · ${toolCount} tools available`,
        );
        updateFooter();
        return;
      }
      const { totals, reports } = summarizeUsage(samples);
      const complete =
        (reports.inputTokens ?? 0) === requests &&
        (reports.outputTokens ?? 0) === requests;
      status(
        `session · ${counted(requests, "request")} · ${usageLine(totals)}${complete ? "" : " · partial usage"}`,
      );
      context(messages, toolCount);
      stderr.write("\n");
    },
    clearContext(): void {
      lastUsage = undefined;
      historySize = 0;
      toolsInHistory = 0;
      updateFooter();
    },
  };
}
