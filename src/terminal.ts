import { createInterface } from "node:readline/promises";

export function createTerminal(cancel: () => void) {
  const interactive = Boolean(process.stdin.isTTY);
  const reader = interactive
    ? createInterface({ input: process.stdin, output: process.stderr })
    : undefined;
  let closed = false;
  reader?.on("close", () => {
    closed = true;
  });
  reader?.on("SIGINT", cancel);
  return {
    interactive,
    async read(
      prompt: string,
      signal: AbortSignal,
    ): Promise<string | undefined> {
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
      process.stderr.write(`\n${preview}\n\n`);
      if (!reader || closed) {
        process.stderr.write("Denied: approval requires a terminal.\n");
        return false;
      }
      const answer = await this.read("Allow this action? [y/N] ", signal);
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
