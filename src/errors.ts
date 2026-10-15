import { cleanText } from "./render.js";

export function errorMessage(error: unknown, sessionKey = ""): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [
    sessionKey,
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.OPENAI_COMPATIBLE_API_KEY,
  ]) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return cleanText(message);
}
