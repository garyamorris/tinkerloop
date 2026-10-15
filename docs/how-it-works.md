# How the harness works

A coding harness is the program around a language model. It supplies context,
describes available tools, executes approved requests, and sends the results
back. The model itself does not have access to your filesystem through a plain
HTTP call.

## 1. Configuration selects a connector

[`config.ts`](../src/config.ts) reads flags and environment variables.
[`setup.ts`](../src/setup.ts) asks for missing settings when terminal input is
available, then uses the same configuration validation. Answers stay in memory.
[`connectors/index.ts`](../src/connectors/index.ts) selects one implementation
of `ModelConnector`. The loop uses the same interface for every provider:

```ts
interface ModelConnector {
  complete(request: ModelRequest): Promise<ModelReply>;
}
```

`ModelRequest` contains instructions, messages, tool descriptions, and an abort
signal. `ModelReply` contains an assistant message and a stop reason. The
connectors expose the actual HTTP bodies; no SDK owns the execution loop.
Run with `--trace <dir>` to save each body the connector sends and receives as
numbered JSON files. [`trace.ts`](../src/connectors/trace.ts) does this by
wrapping `fetch`, so the connectors themselves do not change.
The [human connector](../src/connectors/human.ts) implements the same interface
by showing you the request and returning what you type, which makes the point
plainly: the loop only needs something that turns a request into a reply.
An optional `usage` field carries token counts separately from conversation
messages. [`usage.ts`](../src/usage.ts) normalizes provider accounting; missing
metrics remain unknown.

## 2. Messages are memory

`main.ts` owns a `Message[]`. It appends each user prompt before calling
[`runAgent`](../src/agent.ts). The inner loop appends assistant replies and tool
results. A subsequent user turn reuses the same array.

The provider formats differ. OpenAI uses `function_call` and
`function_call_output`; Anthropic embeds `tool_use` and `tool_result` in
messages; Gemini Interactions uses `function_call` and `function_result` steps.
The compatible connector uses Chat Completions `tool_calls` and tool messages.

We normalize text and tool requests, while preserving the original assistant
blocks in `providerData`. Some APIs require opaque reasoning metadata or signed
thought blocks on subsequent requests. Discarding these just because we only
want text can break a tool round trip. The harness neither interprets nor prints
the opaque data. A conversation stays with its selected provider and model.

OpenAI and Gemini requests set `store: false` and send the history explicitly.
This avoids depending on server-side conversation IDs. It does not override
the provider's general logging, training, or retention policies.

## 3. Definitions describe tools; functions execute them

Each definition in [`tools.ts`](../src/tools.ts) contains a name, description,
and JSON schema. The connector sends those definitions to the model.
The corresponding executable code stays on your computer.

A TypeScript interface cannot validate network data. `executeTool` therefore
checks the requested name, required string fields, extra fields, file size, and
path before taking action. Unknown tools or invalid arguments return an error
result. Reads are immediate; writes and commands call an approval function
before mutation.

The approval function lives in [`terminal.ts`](../src/terminal.ts). Keeping it
separate lets tests approve or deny a synthetic request without a real terminal.
The production CLI requires interactive input; piped text cannot grant approval.

## 4. A bounded loop ties the pieces together

Read the real implementation in [`agent.ts`](../src/agent.ts). In outline:

```text
repeat up to the request limit:
    ask the model using messages and tool definitions
    stop if the response is incomplete
    append the assistant message
    if it contains no tool calls, finish the turn
    for each tool call, in order:
        execute it or record a failure
        append the matching result
report an unfinished task if the request limit was reached
```

Call IDs match requests and results. A denial, missing file, or failed command
still produces a result. That gives the model evidence about what happened.
The shell tool includes exit status, stdout, stderr, and timeout information.

At the step limit, requested tools in the last completed response have results
in history, but the model may not have received them yet. The CLI reports that
the task may be unfinished. In chat you can ask it to continue, starting another
bounded turn. No automatic retry or infinite recovery loop hides this behavior.

## 5. The outer chat loop accepts follow-ups

The outer loop in `main.ts` asks for another user prompt after `runAgent` ends.
It handles `/help`, `/usage`, `/context`, `/clear`, and `/exit`; the inner loop
handles tool calls. A task passed as an argument runs one turn. Full-screen mode
waits for Enter before exiting so the answer stays visible; `--plain` exits
immediately after the turn.

In chat, Ctrl+C stops the current turn: it aborts the HTTP request or command,
records a result for every requested tool, and returns to the prompt with the
conversation intact. Ctrl+C at the prompt, a second Ctrl+C, or Ctrl+C during a
quoted single task exits with code 130.
The model request timeout is five minutes. Shell commands have a 30-second limit;
their process trees are terminated on timeout or cancellation. Background jobs,
interactive subprocesses, and persistent terminal sessions are outside this
small implementation.

## 6. Presentation observes the loop

Callbacks announce requests, replies, and tool results. [`display.ts`](../src/display.ts)
uses them to render assistant text and update usage; they do not execute tools.
[`screen.ts`](../src/screen.ts) uses Node's `emitKeypressEvents`, raw input, and
ANSI cursor commands to redraw a fixed viewport. An alternate screen keeps the
shell's earlier output intact, and `finally` restores the terminal on exit.
The screen owns a bounded transcript for viewing. `Message[]` remains the
separate conversation memory used by the harness. `--plain` removes the viewport
while keeping the same agent behavior. See the [terminal guide](terminal.md).

## What to add later

Long conversations eventually exceed a model's context window. Tinkerloop
surfaces that API error rather than silently summarizing or dropping messages.
History compaction, streaming, session storage, and stronger
process isolation are useful extensions once you understand the basic loop.
