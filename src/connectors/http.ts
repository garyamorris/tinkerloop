// A tiny HTTP helper, not an agent framework. You can inspect every request body.
export type Fetch = typeof globalThis.fetch;

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The provider returned an unexpected JSON object.");
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error("The provider returned an unexpected JSON array.");
  return value;
}

export function string(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("The provider returned an unexpected text field.");
  return value;
}

export function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    // Return invalid input to the tool validator, so the model can see its mistake.
    return value;
  }
}

// All four APIs wrap failures as {"error": {"message": ...}}, with a code
// (OpenAI), status (Gemini), or type (Anthropic). Show those, not raw JSON.
// Anything else, such as an HTML error page, is shown as received.
function errorDetail(body: string): string {
  try {
    const error = object(object(JSON.parse(body)).error);
    const message = string(error.message);
    const label = [error.code, error.status, error.type].find(
      (value) => typeof value === "string" && value,
    );
    return label ? `${label}: ${message}` : message;
  } catch {
    return body;
  }
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
  fetchImpl: Fetch = fetch,
): Promise<Record<string, unknown>> {
  // Long enough for a large file rewrite; Ctrl+C still cancels sooner.
  const timeout = AbortSignal.timeout(300_000);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "error", // Do not forward a credential to a redirected destination.
  });
  if (!response.ok) {
    let detail = errorDetail(await response.text());
    for (const secret of Object.values(headers)) {
      if (secret.length > 8)
        detail = detail.replaceAll(
          secret.replace(/^Bearer /, ""),
          "[redacted]",
        );
    }
    throw new Error(
      `Model API returned HTTP ${response.status}: ${detail.slice(0, 1_000)}`,
    );
  }
  return object(await response.json());
}
