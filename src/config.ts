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
  prompt: string;
}

export const help = `Tinkerloop — a tiny coding harness, explained from the ground up.

Usage: tinkerloop [options] ["task"]

No task starts a chat. /clear resets history; /exit quits.

  --provider <name>  openai (default), anthropic, gemini, compatible
  --model <id>       Required, or set TINKERLOOP_MODEL
  --cwd <path>       Working directory (default: current directory)
  --max-steps <n>    Model requests per user turn (default: 10)
  --help            Show this help without credentials

Environment: TINKERLOOP_PROVIDER, TINKERLOOP_MODEL, TINKERLOOP_BASE_URL,
OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_COMPATIBLE_API_KEY.
Optional .env.local is loaded from the directory where you launch the CLI.
Reads run automatically. Each write and shell command requires approval.
Shell commands have your machine's permissions; this is not a sandbox.
`;

export function loadLocalEnv(): void {
  const path = resolve(".env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}

export function readConfig(
  args = process.argv.slice(2),
  env = process.env,
): Config | undefined {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      provider: { type: "string" },
      model: { type: "string" },
      cwd: { type: "string" },
      "max-steps": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) return undefined;
  const provider = values.provider ?? env.TINKERLOOP_PROVIDER ?? "openai";
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
  return {
    provider: provider as Provider,
    model,
    apiKey,
    baseUrl,
    cwd: resolve(values.cwd ?? "."),
    maxSteps,
    prompt: positionals.join(" ").trim(),
  };
}
