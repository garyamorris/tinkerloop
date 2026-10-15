import { createInterface } from "node:readline/promises";
import { literalText } from "./render.js";
import type { Screen } from "./screen.js";

interface TerminalView {
  approval(preview: string): void;
  note(text: string): void;
  approvalPrompt: string;
}

export function createTerminal(
  cancel: () => void,
  view?: TerminalView,
  screen?: Screen,
) {
  const interactive = Boolean(process.stdin.isTTY);
  const reader =
    interactive && !screen
      ? createInterface({ input: process.stdin, output: process.stderr })
      : undefined;
  let closed = false;
  reader?.on("close", () => {
    closed = true;
  });
  reader?.on("SIGINT", cancel);
  return {
    interactive,
    setView(next: TerminalView) {
      view = next;
    },
    async choose(
      title: string,
      choices: string[],
      signal: AbortSignal,
    ): Promise<number> {
      if (screen) return screen.choose(title, choices, signal);
      process.stderr.write(
        `\n${title}\n${choices.map((choice, index) => `  ${index + 1}. ${choice}`).join("\n")}\n`,
      );
      while (true) {
        const answer = await this.read(`Choose 1–${choices.length}: `, signal);
        if (answer === undefined)
          throw new Error(
            "Setup needs terminal input. Set --provider and --model instead.",
          );
        if (/^[1-9]$/.test(answer.trim()) && Number(answer) <= choices.length)
          return Number(answer) - 1;
        process.stderr.write("Enter one of the listed numbers.\n");
      }
    },
    async ask(
      title: string,
      description: string,
      defaultValue: string,
      signal: AbortSignal,
      secret = false,
    ): Promise<string> {
      if (screen)
        return screen.ask(title, description, defaultValue, signal, secret);
      if (secret) {
        // Plain readline echoes input. Never invite readers to paste a secret there.
        if (title.includes("optional")) return "";
        throw new Error(
          `Set ${title} in your environment or .env.local, then run again. Full-screen mode also accepts a hidden session key.`,
        );
      }
      process.stderr.write(`\n${title}\n${description}\n`);
      const answer = await this.read(
        defaultValue ? `Value [${defaultValue}]: ` : "Value: ",
        signal,
      );
      if (answer === undefined)
        throw new Error("Setup ended before configuration was complete.");
      return answer || defaultValue;
    },
    async read(
      prompt: string,
      signal: AbortSignal,
      label?: string,
    ): Promise<string | undefined> {
      if (screen) return screen.read(signal, label);
      if (!reader || closed) return undefined;
      let onClose = () => {};
      const endOfInput = new Promise<undefined>((resolve) => {
        onClose = () => resolve(undefined);
        reader.once("close", onClose);
      });
      try {
        return await Promise.race([
          reader.question(prompt, { signal }),
          endOfInput,
        ]);
      } catch (error) {
        if (signal.aborted) throw error;
        if (closed) return undefined;
        throw error;
      } finally {
        reader.removeListener("close", onClose);
      }
    },
    async approve(preview: string, signal: AbortSignal): Promise<boolean> {
      if (screen) return screen.confirm(preview, signal);
      if (view) view.approval(preview);
      else process.stderr.write(`\n${literalText(preview)}\n\n`);
      if (!reader || closed) {
        process.stderr.write("Denied: approval requires a terminal.\n");
        return false;
      }
      const answer = await this.read(
        view?.approvalPrompt ?? "Allow this action? [y/N] ",
        signal,
      );
      return (
        answer?.trim().toLowerCase() === "y" ||
        answer?.trim().toLowerCase() === "yes"
      );
    },
    close() {
      reader?.close();
    },
  };
}
