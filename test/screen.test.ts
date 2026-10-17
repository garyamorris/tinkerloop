import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { setImmediate } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";
import { createScreen, fitScreenLine, wrapScreenLine } from "../src/screen.js";

function terminal() {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(value: boolean) {
      this.isRaw = value;
      return this;
    },
  });
  const output = Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 80,
    rows: 24,
  });
  let text = "";
  let cancelled = 0;
  output.on("data", (chunk) => {
    text += String(chunk);
  });
  const screen = createScreen(
    () => {
      cancelled++;
    },
    {
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
      env: { NO_COLOR: "" },
    },
  );
  return {
    input,
    output,
    screen,
    text: () => text,
    cancelled: () => cancelled,
  };
}
const signal = new AbortController().signal;

test("screen lines preserve generated styles, bound width, and handle wide characters", () => {
  assert.equal(
    stripVTControlCharacters(fitScreenLine("\x1b[36m你好x\x1b[0m", 4)),
    "你好",
  );
  assert.equal(fitScreenLine("abc", 5), "abc  ");
  assert.deepEqual(wrapScreenLine("你好abc", 4), ["你好", "abc"]);
  assert.deepEqual(wrapScreenLine("  code stays indented", 10), [
    "  code sta",
    "ys indente",
    "d",
  ]);
});

test("full-screen setup masks keys and restores terminal modes on close", async () => {
  const ui = terminal();
  try {
    const answer = ui.screen.ask("API key", "Hidden input", "", signal, true);
    ui.input.write("fixture-secret");
    await setImmediate();
    assert.doesNotMatch(ui.text(), /fixture-secret/);
    assert.match(ui.text(), /••••/);
    ui.input.write("\r");
    assert.equal(await answer, "fixture-secret");
    assert.equal(ui.input.isRaw, true);
  } finally {
    ui.screen.close();
  }
  assert.equal(ui.input.isRaw, false);
  assert.match(ui.text(), /\x1b\[\?1049h/);
  assert.match(ui.text(), /\x1b\[\?1049l/);
  assert.match(ui.text(), /\x1b\[\?2004l/);
});

test("closing leaves the transcript in normal scrollback, but never a typed key", async () => {
  const ui = terminal();
  const key = ui.screen.ask("API key", "Hidden input", "", signal, true);
  ui.input.write("fixture-secret\r");
  await key;
  ui.screen.write("  model\n  The answer.\n");
  ui.screen.close();
  const after = ui.text().split("\x1b[?1049l")[1]!;
  assert.match(after, /model\n {2}The answer\./);
  assert.doesNotMatch(ui.text(), /fixture-secret/);
});

test("full-screen approvals default to denial and pasted text cannot approve", async () => {
  const ui = terminal();
  try {
    const denied = ui.screen.confirm("Replace app.ts:\nhello\x1b[2J", signal);
    await setImmediate();
    assert.match(ui.text(), /hello\\u001b\[2J/);
    ui.input.write("\r");
    assert.equal(await denied, false);
    let resolved = false;
    const approval = ui.screen
      .confirm("Run an exact command", signal)
      .then((value) => {
        resolved = true;
        return value;
      });
    ui.input.write("\x1b[200~y\r\x1b[201~");
    await setImmediate();
    assert.equal(resolved, false);
    ui.input.write("y");
    assert.equal(await approval, true);
  } finally {
    ui.screen.close();
  }
});

test("chat paste waits for Enter, history works, and provider arrows select", async () => {
  const ui = terminal();
  try {
    let sent = false;
    const message = ui.screen.read(signal).then((value) => {
      sent = true;
      return value;
    });
    ui.input.write("\x1b[200~line one\nline two\x1b[201~");
    await setImmediate();
    assert.equal(sent, false);
    ui.input.write("\r");
    assert.equal(await message, "line one\nline two");
    const recall = ui.screen.read(signal);
    ui.input.write("\x1b[A\r");
    assert.equal(await recall, "line one\nline two");
    const provider = ui.screen.choose("Provider", ["one", "two"], signal);
    ui.input.write("\x1b[B\r");
    assert.equal(await provider, 1);
  } finally {
    ui.screen.close();
  }
});

test("cancellation clears a pending question and tiny terminals remain usable after resize", async () => {
  const ui = terminal();
  const controller = new AbortController();
  try {
    const answer = ui.screen.read(controller.signal);
    const rejected = assert.rejects(answer, /Cancelled/);
    ui.output.columns = 20;
    ui.output.rows = 5;
    ui.output.emit("resize");
    await setImmediate();
    assert.match(ui.text(), /Enlarge terminal/);
    ui.input.write("\x03");
    assert.equal(ui.cancelled(), 1);
    controller.abort(new Error("Cancelled"));
    await rejected;
    ui.output.columns = 100;
    ui.output.rows = 30;
    ui.output.emit("resize");
    const again = ui.screen.read(signal);
    ui.input.write("/exit\r");
    assert.equal(await again, "/exit");
  } finally {
    ui.screen.close();
  }
});
