import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Fetch } from "./http.js";

// --trace saves the exact JSON each connector sends and receives, numbered in
// order, so you can read the wire format instead of imagining it. Headers are
// not saved because they carry the API key. Bodies still contain your prompts,
// file contents, and command output: keep trace folders private.
export function traceFetch(base: string, fetchImpl: Fetch = fetch): Fetch {
  // One folder per run keeps separate sessions from overwriting each other.
  const folder = join(base, new Date().toISOString().replace(/[:.]/g, "-"));
  let count = 0;
  return async (input, init) => {
    const step = String(++count).padStart(3, "0");
    await mkdir(folder, { recursive: true, mode: 0o700 });
    // Write the request first, so a cancelled or failed call is still recorded.
    await save(join(folder, `${step}-request.json`), init?.body);
    const response = await fetchImpl(input, init);
    await save(
      join(folder, `${step}-response.json`),
      await response.clone().text(),
    );
    return response;
  };
}

async function save(path: string, body: unknown): Promise<void> {
  let text = typeof body === "string" ? body : "";
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Keep a non-JSON body, such as an HTML error page, exactly as received.
  }
  await writeFile(path, text + "\n", { mode: 0o600 });
}
