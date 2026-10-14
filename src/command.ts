import { spawn } from "node:child_process";

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
    for (const key of [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GEMINI_API_KEY",
      "OPENAI_COMPATIBLE_API_KEY",
    ])
      delete env[key];
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const capture = (previous: string, chunk: string) => {
      const limit = 20_000;
      if (previous.endsWith("\n[truncated]")) return previous;
      const next = previous + chunk;
      return next.length > limit
        ? next.slice(0, limit) + "\n[truncated]"
        : next;
    };
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout = capture(stdout, chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = capture(stderr, chunk);
    });

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
      else resolve({ exitCode, signal: exitSignal, timedOut, stdout, stderr });
    });
  });
}
