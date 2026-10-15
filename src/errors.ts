import { keyNames } from "./config.js";
import { cleanText } from "./render.js";

export function errorMessage(error: unknown, sessionKey = ""): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [
    sessionKey,
    ...Object.values(keyNames).map((name) => process.env[name]),
  ]) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return cleanText(message);
}
