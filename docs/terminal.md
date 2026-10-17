# A small full-screen terminal

Tinkerloop opens a full-screen terminal by default when stdin, stdout, and stderr
are terminals. A fixed header identifies your provider, model, and workspace;
the middle holds a scrollable transcript; the footer shows usage and context
above your input line. On exit it restores your previous terminal screen, then
prints the transcript so you can scroll back through it. Pass `--plain` for a
normal scrolling transcript instead. Both views use native Node
APIs and ANSI sequences, with no UI framework or runtime dependency.

The CLI and all lessons share the same header, transcript, readable basic
Markdown, and token summaries. Headings, bold text, inline code, links,
lists, quotes, and fenced code blocks are supported. Code indentation is
preserved; the viewport wraps long lines without changing their contents. This is a small Markdown subset rather
than a complete CommonMark implementation or syntax highlighter.

A full-screen snapshot might look like this. The numbers are illustrative:

```text
  ↻ Tinkerloop
  openai · your-model · ~/projects/my-app
  ────────────────────────────────────────────────────────────────────────
  you
  Read app.ts and explain it.

  ↻ request 1/10 · 1 message sent
  ↳ reply · 1 tool call · 0.9s
  → read_file app.ts
  ✓ read_file app.ts · 3 ms
  ↻ request 2/10 · 3 messages sent
  ↳ reply · answer · 1.4s

  model
  This file defines the application entry point.

  ────────────────────────────────────────────────────────────────────────
  Last · in 1,420 · out 86 · cache read 1,024 · write —
  Context · 1,420 tokens · 4 messages
  Session · 2 requests · in 2,300 · out 110
  Ready · 1 tool result · 4 tools available
  ›
  Enter send · ↑/↓ history · PgUp/PgDn scroll · Ctrl+C quit
```

## Reading the transcript

The transcript narrates the loop, one line per step:

| Line | Meaning |
| --- | --- |
| `↻ request 2/10 · 3 messages sent` | One trip around the loop. The harness sends the whole history to the model; this is the second request of the turn, out of at most ten. |
| `↳ reply · 1 tool call` | What came back: an answer, tool calls, or an incomplete reply. The scrolling view adds token counts here; full-screen mode keeps them in the footer. |
| `→ read_file app.ts` | Your code runs a tool the model asked for. |
| `✓ read_file app.ts · 3 ms` | The tool's result, now added to the history. `✗` marks an error, including a denied approval. |

Colours follow the same idea. The harness (this program) is cyan, you are green,
and the model is magenta. The model's text is labelled `model`, not
`Tinkerloop`, because the harness only carries it. Set `NO_COLOR` to turn
colours off.

Writes and commands still show their complete proposal and need approval. Tool
status rows show the requested filename or command, success/failure, and elapsed
time. Command results include a short output preview; the model receives the
bounded result, which can be longer than the terminal preview.

## Guided startup and keys

Run `npm run dev` or `npm run lesson:1` without flags. Missing settings open a
provider selector and model-ID prompt. The last choice, "You", needs no model ID
or key: you type the model's replies, and the status line says when it is your
turn as the model. Up/down or a number highlights a provider;
Enter confirms. The model prompt accepts a free-form API identifier. For OpenAI,
Enter accepts the shown `gpt-5.4-mini` suggestion; you can type a different model.
Check the [provider catalogs](providers.md) for identifiers your account supports.
Setup is configuration only; the first task (or lesson) makes the API request.

For a compatible endpoint, setup asks for its API prefix and an optional key.
For native providers, it asks for a key only when the relevant environment
variable is missing. Key input is masked, never added to chat history, and used
only for this process. Nothing is saved automatically. To skip setup next time,
set flags or variables in your environment or ignored `.env.local`.

Plain mode prompts for provider/model too, but keys must already be configured
through the environment or `.env.local`. Headless runs never prompt and fail
with instructions when configuration is missing.

## Keyboard controls

| Key | Action |
| --- | --- |
| Enter | Send chat input or confirm a setup value |
| Up/down | Recall input history; select a provider during setup |
| Left/right, Home/End | Move within the input |
| Ctrl+A / Ctrl+E | Move to the beginning/end of the input |
| Ctrl+U | Clear the input |
| Ctrl+J | Insert a newline |
| PgUp/PgDn | Scroll the transcript or a long approval proposal |
| `y` during approval | Approve that one action |
| `n` or Enter during approval | Deny that action |
| Ctrl+C during a chat turn | Stop that turn and keep the conversation |
| Ctrl+C at the prompt, or twice | Exit, restoring the terminal |
| Ctrl+D on empty chat input | Exit |

Terminals with bracketed paste support can paste multiple lines without
submitting them; press Enter to send. Pasted text cannot approve an action.
For terminals without that support, use Ctrl+J for line breaks or keep input to
one line. The view retains up to 5,000 transcript lines; this does not truncate
the separate conversation array sent to the model. Full-screen mode needs at
least 30 columns and 12 rows. Resize freely, or use `--plain` in a small terminal.

Chat stays open after each turn. A quoted task or lessons 1–6 wait for Enter
after completing, so you can review the answer with PgUp/PgDn. `--plain` exits
immediately after these one-shot runs. Either way, the transcript ends up in
your terminal's scrollback.

## Token counts

Each API response can include usage. The connector passes normalized counts in
`ModelReply.usage`; [`usage.ts`](../src/usage.ts) handles provider differences.

| Metric | Meaning |
| --- | --- |
| Input | Total prompt tokens, including cached input |
| Output | Generated tokens, including reasoning where reported |
| Cache read | Input tokens retrieved from the provider's prompt cache |
| Cache write | Input tokens written to the provider's prompt cache, when reported |
| Reasoning | The reported reasoning/thought portion of output; visible in `/usage` |

Cache counts are already included in input. Do not add them again when comparing
input and output totals. Anthropic's `input_tokens` excludes cache reads and
writes, so the adapter adds those components. Gemini reports thought tokens
separately from other output, so normalized output includes both. OpenAI output
and compatible completion counts are used as reported.

`—` or `not reported` means unavailable. Zero is displayed only when the API
actually reports zero. A compatible endpoint may return no usage at all. Session
totals include only known counts; `/usage` shows how many requests reported each
metric. Failed requests without a response cannot contribute known token usage.
The request counter includes attempted requests, so reporting gaps stay visible.

Repeated history is counted on every request. Session input totals therefore
grow faster than the current context size. Clearing context does not undo API
usage. These counts are telemetry, not a billing statement. OpenAI and Gemini
cache repeated prefixes automatically. Anthropic caches only when asked, so its
adapter requests caching: a cache write costs a little more than ordinary input,
and each later read of that prefix costs much less. In an agent loop the next
step almost always reads it.

Sources: [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching),
[Anthropic cache accounting](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
and [Gemini Interactions usage](https://ai.google.dev/api/interactions-api-v1).

## Context

`/context` shows the latest response's reported input count, the current history
message and tool-result counts, and the number of available tools. The measured
input covers the request sent to the provider, including instructions and tool
definitions. Messages or tool results added afterward can make the next request
larger. We do not pretend to tokenize the current history locally.

To see a percentage, supply the actual context limit for your chosen model with
`--context-window <tokens>` or `TINKERLOOP_CONTEXT_WINDOW`. Find that limit in your
provider's model documentation. Without it, the display shows measured counts
and says that the window size is unset. There is no guessed model catalog.

The percentage is **last reported input / configured context window**, not a
promise of remaining output capacity. It does not reserve output tokens or
automatically compact the conversation.

## Chat commands

| Command | Action |
| --- | --- |
| `/help` | List local commands without calling a model |
| `/usage` | Show session token totals, reasoning, and reporting coverage |
| `/context` | Show measured input and current conversation size |
| `/clear` | Clear history and its last usage snapshot; retain session totals |
| `/exit` | Quit |

These commands belong to the full CLI (lesson 8). Lesson 7 has only `/clear`
and `/exit`; the other lessons use the same presentation and telemetry around
their own explicit model calls.

## Colors, pipes, and exit codes

Formatting is enabled when stdout and stderr are terminals. Set `NO_COLOR` to
disable colors while keeping the full-screen layout. `--plain` or `TERM=dumb`
uses a scrolling view. When stdout is redirected, it contains the model's original Markdown
without labels or usage counters; status and summaries use stderr. Terminal
control sequences from model output are stripped. In approval previews, hidden
control characters are shown as escapes so proposed contents remain visible.

Without a terminal on stdin, pass a quoted task and configure the provider,
model, and key ahead of time. There are no setup questions, chat is unavailable,
and every write and command is denied because nobody can approve it. Exit
codes are `0` for a completed run or normal chat exit, `1` for an error or an
unfinished single task, and `130` for Ctrl+C cancellation.

The display observes callbacks from the agent loop; it does not decide which
tools can run. [`screen.ts`](../src/screen.ts) handles the alternate terminal
buffer, keyboard events, redraws, and cleanup. [`display.ts`](../src/display.ts)
turns harness events into presentation; [`render.ts`](../src/render.ts) formats
text; [`usage.ts`](../src/usage.ts) normalizes usage. Compare these with
[`agent.ts`](../src/agent.ts): the execution loop stays independent of the view.
