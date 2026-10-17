import { homedir } from "node:os";
import { tagline, type Config } from "./config.js";
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
  mark,
  paint,
  palette,
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

// Shown under the banner, so the first transcript explains how to read itself.
const legend = `${mark} model request · ↳ its reply · → a tool your code runs`;

function traceNote(folder: string): string {
  return `Tracing · request and response bodies go to ${folder}`;
}

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
  config: Pick<
    Config,
    "provider" | "model" | "cwd" | "contextWindow" | "trace"
  >,
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
  const muted = (text: string) => paint(text, palette.muted, color);
  const accent = (text: string) => paint(text, palette.harness, color);
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
  // One line per step of the loop: the symbol in the harness colour, details in grey.
  const step = (symbol: string, text: string) =>
    stderr.write(`  ${accent(symbol)} ${muted(cleanText(text))}\n`);

  function usageLine(usage: TokenUsage | undefined): string {
    const short = (value: number | undefined) =>
      value === undefined ? "—" : tokenText(value);
    return `in ${short(usage?.inputTokens)} · out ${short(usage?.outputTokens)} · cache read ${short(usage?.cacheReadTokens)} · write ${short(usage?.cacheWriteTokens)}`;
  }

  function updateFooter(): void {
    if (!screen) return;
    if (config.provider === "human") {
      screen.setFooter([
        "No token counts: you are the model, so no API reports usage",
        `Context · ${counted(historySize, "message")}`,
        `Session · ${counted(requests, "request")}`,
      ]);
      return;
    }
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
      `${counted(messages.length, "history message")} · ${counted(messages.filter((message) => message.role === "tool").length, "tool result")} · ${counted(toolCount, "available tool")}`,
    );
    if (!config.contextWindow)
      status("Window size unset · set --context-window to show a percentage");
  }

  return {
    prompt: styled ? `\n${paint("  you › ", palette.you, color)}` : "\nYou > ",
    modelPrompt: styled
      ? `\n${paint("  model › ", palette.model, color)}`
      : "\nModel > ",
    approvalPrompt: styled
      ? `${accent("  Allow this action?")} [y/N] `
      : "Allow this action? [y/N] ",
    // A lesson names itself and says what it adds; the CLI shows the tagline.
    banner(lesson?: { title: string; goal: string }): void {
      const home = homedir();
      const workspace =
        config.cwd.startsWith(home + "/") || config.cwd.startsWith(home + "\\")
          ? "~" + config.cwd.slice(home.length)
          : config.cwd;
      const name = `${mark} Tinkerloop${lesson ? ` · ${lesson.title}` : ""}`;
      const model =
        config.provider === "human"
          ? "you are the model"
          : `${config.provider} · ${config.model}`;
      const where = `${model} · ${workspace}`;
      const intro = lesson?.goal ?? tagline;
      if (screen) {
        screen.setHeader([name, where]);
        screen.write(
          `\n${wrapText(cleanText(intro), width(), "  ").split("\n").map(accent).join("\n")}\n\n`,
        );
        this.note(legend);
        if (!lesson)
          this.note("Describe a task to start. /help lists commands.");
        if (config.trace) this.note(traceNote(config.trace));
        screen.write("\n");
        updateFooter();
        return;
      }
      stderr.write(`\n${accent(`  ${cleanText(name)}`)}\n`);
      status(intro);
      status(where);
      if (config.trace) status(traceNote(config.trace));
      status(legend);
      if (!lesson) status("/help · /usage · /context · /clear · /exit");
      stderr.write("\n");
    },
    user(text: string): void {
      stderr.write(
        `${paint("  you", palette.you, color)}\n${wrapText(cleanText(text), width(), "  ")}\n\n`,
      );
    },
    // Each model request is one trip around the loop, and the whole history
    // goes with it every time, so the line says how many messages were sent.
    request(stepNumber: number, limit: number, messages?: Message[]): void {
      if (messages) historySize = messages.length;
      requests++;
      requestStarted = performance.now();
      const sent = messages
        ? ` · ${counted(messages.length, "message")} sent`
        : "";
      step(mark, `request ${stepNumber}/${limit}${sent}`);
      if (screen) {
        screen.setStatus(
          `Waiting for the model · request ${stepNumber}/${limit} · Ctrl+C cancels`,
        );
        updateFooter();
      }
    },
    reply(reply: ModelReply): void {
      samples.push(reply.usage);
      lastUsage = reply.usage;
      const calls = reply.message.toolCalls.length;
      const kind =
        reply.stopReason === "incomplete"
          ? "incomplete"
          : calls
            ? counted(calls, "tool call")
            : "answer";
      const seconds = `${((performance.now() - requestStarted) / 1000).toFixed(1)}s`;
      // Full-screen mode keeps token counts in its footer. You report none.
      const tokens =
        screen || config.provider === "human"
          ? ""
          : reply.usage
            ? ` · ${usageLine(reply.usage)}`
            : " · usage not reported";
      step("↳", `reply · ${kind} · ${seconds}${tokens}`);
      if (reply.message.content) {
        // Label the text as the model's: the harness only carries it.
        if (styled)
          stdout.write(
            `\n${paint("  model", palette.model, color)}\n${renderMarkdown(reply.message.content, width(), color)}\n\n`,
          );
        else stdout.write(`${cleanText(reply.message.content)}\n`);
      }
      if (screen) {
        screen.setStatus(`Reply · ${kind} · ${seconds}`);
        updateFooter();
      }
    },
    tool(call: ToolCall): void {
      step("→", `${call.name} ${toolTarget(call)}`.trimEnd());
      screen?.setStatus(`Running ${call.name} · Ctrl+C cancels`);
    },
    toolResult(result: ToolResult, call: ToolCall, durationMs: number): void {
      const name = `${call.name} ${toolTarget(call)}`.trimEnd();
      stderr.write(
        `${paint(`  ${result.isError ? "✗" : "✓"} ${cleanText(name)}`, result.isError ? palette.error : palette.ok, color)}${muted(` · ${Math.round(durationMs)} ms`)}\n`,
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
    // Verbatim text, such as what the human provider receives. Indentation
    // matters here, so this skips the wrapping and Markdown used elsewhere.
    block(text: string): void {
      stderr.write(
        `\n${cleanText(text)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")}\n`,
      );
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
          `Ready · ${counted(toolsInHistory, "tool result")} · ${counted(toolCount, "tool")} available`,
        );
        updateFooter();
        return;
      }
      // A short summary per turn; /usage and /context have the details.
      status(
        `turn finished · ${counted(messages.length, "message")} in history · ${counted(toolsInHistory, "tool result")}`,
      );
      const { totals, reports } = summarizeUsage(samples);
      if (reports.inputTokens || reports.outputTokens) {
        const complete =
          (reports.inputTokens ?? 0) === requests &&
          (reports.outputTokens ?? 0) === requests;
        status(
          `session · ${counted(requests, "request")} · ${usageLine(totals)}${complete ? "" : " · partial usage"}`,
        );
      }
      const input = lastUsage?.inputTokens;
      if (input !== undefined && config.contextWindow)
        status(
          `context · ${tokenText(input)} tokens · ${((100 * input) / config.contextWindow).toFixed(1)}% of configured window`,
        );
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
