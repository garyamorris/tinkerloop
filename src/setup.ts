import {
  parseOptions,
  readConfig,
  type Config,
  type Provider,
} from "./config.js";

// Startup is separate from configuration parsing so scripts never get stuck at a prompt.
export interface SetupPrompts {
  choose(
    title: string,
    choices: string[],
    signal: AbortSignal,
  ): Promise<number>;
  ask(
    title: string,
    description: string,
    defaultValue: string,
    signal: AbortSignal,
    secret?: boolean,
  ): Promise<string>;
}

const providers: Provider[] = ["openai", "anthropic", "gemini", "compatible"];
export const keyNames: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  compatible: "OPENAI_COMPATIBLE_API_KEY",
};

export async function configure(
  args: string[],
  signal: AbortSignal,
  prompts?: SetupPrompts,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Config | undefined> {
  const { values } = parseOptions(args);
  if (values.help || !prompts) return readConfig(args, env);
  // Answers (including a pasted API key) stay in this session, never in a file.
  const settings = { ...env };
  let provider = values.provider ?? settings.TINKERLOOP_PROVIDER?.trim();
  if (!provider) {
    const selected = await prompts.choose(
      "Welcome to Tinkerloop",
      [
        "OpenAI · Responses API",
        "Anthropic · Messages API",
        "Gemini · Interactions API",
        "OpenAI-compatible · local or hosted endpoint",
      ],
      signal,
    );
    provider = providers[selected];
    settings.TINKERLOOP_PROVIDER = provider;
  }
  if (!providers.includes(provider as Provider)) {
    throw new Error(
      `Unknown provider "${provider}". Choose openai, anthropic, gemini, or compatible.`,
    );
  }
  async function required(
    title: string,
    description: string,
    suggestion = "",
    secret = false,
  ): Promise<string> {
    let answer = "";
    while (!answer) {
      signal.throwIfAborted();
      answer = (
        await prompts!.ask(title, description, suggestion, signal, secret)
      ).trim();
      if (!answer)
        description =
          "A value is required. " +
          description.replace(/^A value is required\. /, "");
    }
    return answer;
  }
  if (!(values.model ?? settings.TINKERLOOP_MODEL)?.trim()) {
    settings.TINKERLOOP_MODEL = await required(
      "Choose a model",
      `Enter a model ID available to your ${provider} account or endpoint.\nThis is the API identifier, not a display name. API calls may cost money.\nYou can skip this question next time with --model or TINKERLOOP_MODEL.`,
      provider === "openai" ? "gpt-5.4-mini" : "",
    );
  }
  if (provider === "compatible" && !settings.TINKERLOOP_BASE_URL?.trim()) {
    settings.TINKERLOOP_BASE_URL = await required(
      "Compatible API endpoint",
      "Enter the API prefix, including /v1 when needed. HTTPS or local HTTP only.\nFor example: http://localhost:11434/v1",
    );
  }
  const keyName = keyNames[provider as Provider];
  if (!settings[keyName]?.trim()) {
    if (provider === "compatible") {
      settings[keyName] = (
        await prompts.ask(
          "Endpoint API key (optional)",
          "Leave empty for a local server that needs no key.\nThe key is hidden and used only for this session.",
          "",
          signal,
          true,
        )
      ).trim();
    } else {
      settings[keyName] = await required(
        keyName,
        "Paste your provider API key. Input is hidden and used only for this session.\nTo skip this question next time, set it in your environment or .env.local.",
        "",
        true,
      );
    }
  }
  // Flags still take precedence; all answers go through the same validation.
  return readConfig(args, settings);
}
