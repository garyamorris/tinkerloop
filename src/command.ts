import { spawn } from "node:child_process";
import { keyNames } from "./config.js";

export interface CommandOutput {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  cwd: string,
  signal?: AbortSignal,
  timeoutMs = 30_000,
): Promise<CommandOutput> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    // The command does not need our provider credentials. Other local access is
    // still possible: shell commands run with the person's normal permissions.
    for (const key of Object.values(keyNames)) delete env[key];
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = collector();
    const stderr = collector();
    let timedOut = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    child.stdout.setEncoding("utf8").on("data", stdout.add);
    child.stderr.setEncoding("utf8").on("data", stderr.add);

    function killTree(force = false): void {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { stdio: "ignore", windowsHide: true },
        );
        killer.on("error", () => {
          child.kill();
        });
      } else {
        try {
          process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill();
        }
      }
    }
    function stop(): void {
      killTree();
      forceKill ??= setTimeout(() => killTree(true), 500);
    }
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    signal?.addEventListener("abort", stop, { once: true });
    function cleanup(): void {
      clearTimeout(timer);
      if (forceKill) clearTimeout(forceKill);
      signal?.removeEventListener("abort", stop);
    }
    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("close", (exitCode, exitSignal) => {
      cleanup();
      if (signal?.aborted) reject(signal.reason);
      else
        resolve({
          exitCode,
          signal: exitSignal,
          timedOut,
          stdout: stdout.text(),
          stderr: stderr.text(),
        });
    });
  });
}

// Errors and test summaries usually come last, so long output keeps its start
// and its end. The marker in the middle says how much was left out.
function omission(count: number): string {
  return `\n[… ${count.toLocaleString("en-US")} characters omitted …]\n`;
}

const omissionPattern = /\n\[… ([\d,]+) characters omitted …\]\n/g;

// Shorten text to at most max characters by removing its middle.
export function elide(text: string, max: number): string {
  if (text.length <= max) return text;
  const keep = Math.max(0, max - omission(text.length).length);
  const head = text.slice(0, Math.floor(keep / 2));
  const tail = text.slice(text.length - Math.ceil(keep / 2));
  // A marker inside the removed part already stands for more characters.
  const removed = text.slice(head.length, text.length - tail.length);
  let count = removed.length;
  for (const match of removed.matchAll(omissionPattern))
    count += Number(match[1]!.replaceAll(",", "")) - match[0].length;
  return keep ? head + omission(count) + tail : omission(count).trim();
}

// Hold on to the start and the end of a stream as it arrives. A command that
// prints gigabytes still uses a bounded amount of memory.
function collector(limit = 1_000_000) {
  let head = "";
  let tail = "";
  let omitted = 0;
  return {
    add(chunk: string): void {
      const room = limit / 2 - head.length;
      if (room > 0) {
        head += chunk.slice(0, room);
        chunk = chunk.slice(room);
      }
      tail += chunk;
      if (tail.length > limit / 2) {
        omitted += tail.length - limit / 2;
        tail = tail.slice(-limit / 2);
      }
    },
    text(): string {
      return omitted ? head + omission(omitted) + tail : head + tail;
    },
  };
}
