import { stripVTControlCharacters } from "node:util";

// Model output and filenames must not be able to send terminal control codes.
export function cleanText(text: string): string {
  return stripVTControlCharacters(text.replace(/\r\n/g, "\n")).replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,
    "",
  );
}

// Approval must reveal hidden bytes instead of silently removing them: the
// person is deciding whether to execute these exact contents or this command.
export function literalText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(
      /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

export function paint(text: string, code: string, color: boolean): string {
  return color ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export function wrapText(
  text: string,
  width: number,
  prefix = "",
  continuation = prefix,
): string {
  const lines: string[] = [];
  let line = prefix;
  let currentPrefix = prefix;
  const visible = (value: string) =>
    Array.from(stripVTControlCharacters(value)).length;
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    const separator = line === currentPrefix ? "" : " ";
    if (line !== currentPrefix && visible(line + separator + word) > width) {
      lines.push(line);
      currentPrefix = continuation;
      line = continuation + word;
    } else line += separator + word;
  }
  lines.push(line);
  return lines.join("\n");
}

function inline(text: string, color: boolean): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/`([^`]+)`/g, (_match, code: string) => paint(code, "36", color))
    .replace(/\*\*([^*]+)\*\*/g, (_match, bold: string) =>
      paint(bold, "1", color),
    );
}

// A deliberately small Markdown subset: paragraphs, headings, lists, quotes,
// links, bold text, and fenced code. No parser or UI framework is needed.
export function renderMarkdown(
  text: string,
  width = 80,
  color = false,
): string {
  const output: string[] = [];
  let paragraph: string[] = [];
  let fence: string | undefined;
  function flush(): void {
    if (!paragraph.length) return;
    output.push(wrapText(inline(paragraph.join(" "), color), width, "  "));
    paragraph = [];
  }
  for (const line of cleanText(text).split("\n")) {
    const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (
        marker &&
        marker[1]![0] === fence[0] &&
        marker[1]!.length >= fence.length &&
        !marker[2]!.trim()
      ) {
        fence = undefined;
        output.push("");
      } else output.push(paint(`    ${line}`, "36", color));
      continue;
    }
    if (marker) {
      flush();
      fence = marker[1]!;
      output.push(paint(`  ── ${marker[2]!.trim() || "code"} ──`, "90", color));
    } else if (!line.trim()) {
      flush();
      if (output.at(-1) !== "") output.push("");
    } else if (/^#{1,6}\s+/.test(line)) {
      flush();
      output.push(
        paint(
          wrapText(line.replace(/^#{1,6}\s+/, ""), width, "  "),
          "1;36",
          color,
        ),
      );
    } else if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
      flush();
      const list = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line)!;
      const indent = "  " + list[1]!.replace(/\t/g, "  ");
      const bullet = /^\d/.test(list[2]!) ? list[2]! : "•";
      output.push(
        wrapText(
          inline(list[3]!, color),
          width,
          `${indent}${bullet} `,
          indent + " ".repeat(bullet.length + 1),
        ),
      );
    } else if (/^>\s?/.test(line)) {
      flush();
      output.push(
        paint(
          wrapText(inline(line.replace(/^>\s?/, ""), false), width, "  │ "),
          "90",
          color,
        ),
      );
    } else if (/^(?:---+|\*\*\*+)\s*$/.test(line)) {
      flush();
      output.push(
        paint(`  ${"─".repeat(Math.max(4, width - 4))}`, "90", color),
      );
    } else paragraph.push(line.trim());
  }
  flush();
  return output.join("\n").trimEnd();
}
