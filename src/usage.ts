import type { Provider } from "./config.js";
import type { TokenUsage } from "./types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

// Providers name and account for tokens differently. Normalize at the boundary
// so the terminal can stay independent of a particular API.
export function readUsage(
  provider: Provider,
  value: unknown,
): TokenUsage | undefined {
  const usage = record(value);
  let result: TokenUsage;
  if (provider === "anthropic") {
    const fresh = count(usage.input_tokens);
    const read = count(usage.cache_read_input_tokens);
    const written = count(usage.cache_creation_input_tokens);
    result = {
      // Anthropic's input_tokens excludes cache reads and cache creation.
      inputTokens:
        fresh === undefined ? undefined : fresh + (read ?? 0) + (written ?? 0),
      outputTokens: count(usage.output_tokens),
      cacheReadTokens: read,
      cacheWriteTokens: written,
    };
  } else if (provider === "gemini") {
    const output = count(usage.total_output_tokens);
    const thought = count(usage.total_thought_tokens);
    result = {
      inputTokens: count(usage.total_input_tokens),
      // Gemini reports thoughts separately. Include them in generated output,
      // as OpenAI and Anthropic do, and retain the breakdown when available.
      outputTokens: output === undefined ? undefined : output + (thought ?? 0),
      reasoningTokens: thought,
      cacheReadTokens: count(usage.total_cached_tokens),
    };
  } else {
    const input = record(
      provider === "openai"
        ? usage.input_tokens_details
        : usage.prompt_tokens_details,
    );
    const output = record(
      provider === "openai"
        ? usage.output_tokens_details
        : usage.completion_tokens_details,
    );
    result = {
      inputTokens: count(
        provider === "openai" ? usage.input_tokens : usage.prompt_tokens,
      ),
      outputTokens: count(
        provider === "openai" ? usage.output_tokens : usage.completion_tokens,
      ),
      cacheReadTokens: count(input.cached_tokens),
      cacheWriteTokens:
        provider === "openai" ? count(input.cache_write_tokens) : undefined,
      reasoningTokens: count(output.reasoning_tokens),
    };
  }
  for (const key of usageFields) result[key] = count(result[key]);
  return Object.values(result).some((value) => value !== undefined)
    ? result
    : undefined;
}

export const usageFields = [
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
] as const;

export function summarizeUsage(samples: (TokenUsage | undefined)[]) {
  const totals: TokenUsage = {};
  const reports: Partial<Record<keyof TokenUsage, number>> = {};
  for (const sample of samples) {
    for (const key of usageFields) {
      const value = sample?.[key];
      if (value === undefined) continue;
      totals[key] = (totals[key] ?? 0) + value;
      reports[key] = (reports[key] ?? 0) + 1;
    }
  }
  return { totals, reports };
}

export function tokenText(value: number | undefined): string {
  return value === undefined ? "not reported" : value.toLocaleString("en-US");
}
