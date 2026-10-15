import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

export type Provider = "openai" | "anthropic" | "gemini" | "compatible";
export interface Config {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl: string;
  cwd: string;
  maxSteps: number;
  contextWindow?: number;
  plain?: boolean;
  prompt: string;
}

export const help = `Tinkerloop — a tiny coding harness, explained from the ground up.

Usage: tinkerloop [options] ["task"]

No task starts a chat. /help, /usage, /context, /clear, /exit.
In a terminal, missing provider/model settings are requested during setup.

  --provider <name>  openai, anthropic, gemini, compatible (scripts default to openai)
  --model <id>       Model ID, or set TINKERLOOP_MODEL (prompted in a terminal)
  --cwd <path>       Working directory (default: current directory)
  --max-steps <n>    Model requests per user turn (default: 10)
  --context-window <n>  Optional model context limit, in tokens
  --plain           Use a scrolling transcript instead of the full-screen view
  --help            Show this help without credentials

Environment: TINKERLOOP_PROVIDER, TINKERLOOP_MODEL, TINKERLOOP_BASE_URL,
TINKERLOOP_CONTEXT_WINDOW,
OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_COMPATIBLE_API_KEY.
Optional .env.local is loaded from the directory where you launch the CLI.
Reads run automatically. Each write and shell command requires approval.
Shell commands have your machine's permissions; this is not a sandbox.
`;

export function loadLocalEnv(): void {
  const path = resolve(".env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}

export function parseOptions(args = process.argv.slice(2)) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      provider: { type: "string" },
      model: { type: "string" },
      cwd: { type: "string" },
      "max-steps": { type: "string" },
      "context-window": { type: "string" },
      plain: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
}

export function readConfig(
  args = process.argv.slice(2),
  env = process.env,
): Config | undefined {
  const { values, positionals } = parseOptions(args);
  if (values.help) return undefined;
  const provider =
    values.provider ?? (env.TINKERLOOP_PROVIDER?.trim() || "openai");
  if (!["openai", "anthropic", "gemini", "compatible"].includes(provider)) {
    throw new Error(
      `Unknown provider "${provider}". Choose openai, anthropic, gemini, or compatible.`,
    );
  }
  const model = (values.model ?? env.TINKERLOOP_MODEL ?? "").trim();
  if (!model)
    throw new Error(
      "Choose a model with --model <id> or TINKERLOOP_MODEL. See docs/providers.md.",
    );
  const keyNames = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    compatible: "OPENAI_COMPATIBLE_API_KEY",
  };
  const keyName = keyNames[provider as Provider];
  const apiKey = (env[keyName] ?? "").trim();
  if (!apiKey && provider !== "compatible")
    throw new Error(`Set ${keyName} in your environment or .env.local.`);
  const baseUrl = (env.TINKERLOOP_BASE_URL ?? "").trim();
  if (provider === "compatible") {
    if (!baseUrl)
      throw new Error(
        "Set TINKERLOOP_BASE_URL to your compatible API prefix, such as http://localhost:11434/v1.",
      );
    const url = new URL(baseUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "The base URL must use HTTPS (or local HTTP), without credentials, query parameters, or a fragment.",
      );
    }
  }
  const maxSteps = Number(values["max-steps"] ?? "10");
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1)
    throw new Error("--max-steps must be a positive whole number.");
  const contextValue =
    values["context-window"] ?? env.TINKERLOOP_CONTEXT_WINDOW;
  const contextWindow = contextValue?.trim() ? Number(contextValue) : undefined;
  if (
    contextWindow !== undefined &&
    (!Number.isSafeInteger(contextWindow) || contextWindow < 1)
  )
    throw new Error("--context-window must be a positive whole number.");
  return {
    provider: provider as Provider,
    model,
    apiKey,
    baseUrl,
    cwd: resolve(values.cwd ?? "."),
    maxSteps,
    contextWindow,
    plain: Boolean(values.plain),
    prompt: positionals.join(" ").trim(),
  };
}
