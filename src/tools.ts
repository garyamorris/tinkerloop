import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { runCommand } from "./command.js";
import type { ToolCall, ToolDefinition, ToolResult } from "./types.js";

export const MAX_OUTPUT = 20_000;
const MAX_FILE_BYTES = 20_000;

function definition(
  name: string,
  description: string,
  fields: Record<string, string>,
): ToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(fields).map(([key, description]) => [
          key,
          { type: "string" as const, description },
        ]),
      ),
      required: Object.keys(fields),
      additionalProperties: false,
    },
  };
}

export const tools: ToolDefinition[] = [
  definition(
    "list_files",
    "List immediate children of a directory, excluding dependency, Git, and environment files.",
    { path: "Directory path relative to the workspace. Use . for its root." },
  ),
  definition(
    "read_file",
    "Read a UTF-8 text file of at most 20,000 bytes in the workspace.",
    { path: "File path relative to the workspace." },
  ),
  definition(
    "write_file",
    "Create or replace an entire UTF-8 file after user approval. At most 20,000 bytes.",
    {
      path: "File path relative to the workspace.",
      content: "The complete new file contents, not a patch.",
    },
  ),
  definition(
    "run_command",
    "Run a shell command after user approval. Runs in the workspace, with a 30-second timeout.",
    {
      command:
        "The exact shell command to run. Use commands appropriate for this operating system.",
    },
  ),
];

export const readOnlyTools = tools.filter(
  (tool) => tool.name === "list_files" || tool.name === "read_file",
);

export interface ToolContext {
  cwd: string;
  approve(preview: string): Promise<boolean>;
  signal?: AbortSignal;
  // Tests can use a short timeout without making a test suite wait 30 seconds.
  commandTimeoutMs?: number;
}

export function bounded(text: string): string {
  const notice = "\n[Output truncated at 20,000 characters.]";
  return text.length > MAX_OUTPUT
    ? text.slice(0, MAX_OUTPUT - notice.length) + notice
    : text;
}

function blockedName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === ".git" ||
    lower === "node_modules" ||
    ((lower === ".env" || lower.startsWith(".env.")) &&
      lower !== ".env.example")
  );
}

export async function workspaceRoot(path: string): Promise<string> {
  const root = await realpath(path);
  if (!(await stat(root)).isDirectory())
    throw new Error("The working directory must be a directory.");
  return root;
}

// Check every path component. Reject symlinks entirely to keep this rule legible.
// These checks prevent ordinary path escapes; they are not an OS sandbox.
export async function workspacePath(
  root: string,
  path: string,
): Promise<string> {
  const target = resolve(root, path);
  const local = relative(root, target);
  if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    throw new Error("File paths must stay inside the working directory.");
  }
  let current = root;
  for (const part of local.split(sep).filter(Boolean)) {
    if (blockedName(part))
      throw new Error(
        "File tools exclude .git, node_modules, and .env files (except .env.example).",
      );
    current = resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error("File tools do not follow symbolic links.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

function argumentsFor(
  call: ToolCall,
  tool: ToolDefinition,
): Record<string, string> {
  const input = call.arguments;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Tool arguments must be a JSON object.");
  const values = input as Record<string, unknown>;
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(tool.parameters.properties, key))
      throw new Error(`Unexpected argument: ${key}.`);
  }
  for (const key of tool.parameters.required) {
    if (typeof values[key] !== "string")
      throw new Error(`Argument ${key} must be a string.`);
    if (key !== "content" && !values[key].trim())
      throw new Error(`Argument ${key} must not be empty.`);
  }
  return values as Record<string, string>;
}

export async function executeTool(
  call: ToolCall,
  context: ToolContext,
  allowedTools = tools,
): Promise<ToolResult> {
  const result: ToolResult = {
    role: "tool",
    callId: call.id,
    name: call.name,
    content: "",
    isError: false,
  };
  try {
    context.signal?.throwIfAborted();
    const tool = allowedTools.find((entry) => entry.name === call.name);
    if (!tool) throw new Error(`Unknown or unavailable tool: ${call.name}.`);
    const args = argumentsFor(call, tool);
    const root = await workspaceRoot(context.cwd);

    if (call.name === "run_command") {
      const command = args.command!;
      if (!(await context.approve(`Run in ${root}:\n\n${command}`)))
        throw new Error(
          "User denied this command. Do not retry it without a new user request.",
        );
      context.signal?.throwIfAborted();
      const output = await runCommand(
        command,
        root,
        context.signal,
        context.commandTimeoutMs,
      );
      result.content = bounded(JSON.stringify(output, null, 2));
      result.isError = output.exitCode !== 0 || output.timedOut;
    } else {
      const path = await workspacePath(root, args.path!);
      if (call.name === "list_files") {
        const entries = (await readdir(path, { withFileTypes: true }))
          .filter(
            (entry) => !blockedName(entry.name) && !entry.isSymbolicLink(),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((entry) => entry.name + (entry.isDirectory() ? "/" : ""));
        result.content = bounded(entries.join("\n") || "(empty directory)");
      } else if (call.name === "read_file") {
        const info = await stat(path);
        if (!info.isFile())
          throw new Error("read_file expects a regular file.");
        if (info.size > MAX_FILE_BYTES)
          throw new Error(
            "File exceeds 20,000 bytes. Use an approved command to inspect a smaller section.",
          );
        const content = await readFile(path, "utf8");
        if (content.includes("\0"))
          throw new Error("read_file expects a text file, not a binary file.");
        result.content = bounded(content);
      } else if (call.name === "write_file") {
        const content = args.content!;
        if (Buffer.byteLength(content) > MAX_FILE_BYTES)
          throw new Error("New file contents exceed 20,000 bytes.");
        const preview = `Create or replace ${path} with these complete contents:\n\n--- begin file ---\n${content}\n--- end file ---`;
        if (!(await context.approve(preview)))
          throw new Error(
            "User denied this file change. Do not retry it without a new user request.",
          );
        context.signal?.throwIfAborted();
        // Recheck after the person has finished reviewing the proposal.
        await workspacePath(root, args.path!);
        await mkdir(dirname(path), { recursive: true });
        await workspacePath(root, args.path!);
        const file = await open(
          path,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_TRUNC |
            (constants.O_NOFOLLOW ?? 0),
          0o644,
        );
        try {
          await file.writeFile(content, "utf8");
        } finally {
          await file.close();
        }
        result.content = `Wrote ${Buffer.byteLength(content)} bytes to ${args.path}.`;
      }
    }
  } catch (error) {
    result.isError = true;
    result.content = bounded(
      error instanceof Error ? error.message : String(error),
    );
  }
  return result;
}
