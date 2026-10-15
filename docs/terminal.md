# A small full-screen terminal

Tinkerloop opens a full-screen terminal by default when stdin, stdout, and stderr
are terminals. A fixed header identifies your provider, model, and workspace;
the middle holds a scrollable transcript; the footer shows usage and context
above your input line. It restores your previous terminal screen on exit.
Pass `--plain` for a normal scrolling transcript. Both views use native Node
APIs and ANSI sequences, with no UI framework or runtime dependency.

The CLI and all lessons share a branded header, user/assistant sections, readable
basic Markdown, and token summaries. Headings, bold text, inline code, links,
lists, quotes, and fenced code blocks are supported. Code indentation is
preserved; the viewport wraps long lines without changing their contents. This is a small Markdown subset rather
than a complete CommonMark implementation or syntax highlighter.

A full-screen snapshot might look like this. The numbers are illustrative:

```text
  <> Tinkerloop · openai · your-model
  ~/projects/my-app
  ────────────────────────────────────────────────────────────────────────
  you
  Read app.ts and explain it.
  → read_file app.ts
  ✓ read_file app.ts · 3 ms

  tinkerloop
  This file defines the application entry point.

  ────────────────────────────────────────────────────────────────────────
  Last · in 1,420 · out 86 · cache read 1,024 · write —
  Context · 1,420 tokens · 4 messages
  Session · 2 requests · in 2,300 · out 110
  Ready
  ›
  Enter send · ↑/↓ history · PgUp/PgDn scroll · Ctrl+C quit
```

Writes and commands still show their complete proposal and need approval. Tool
status rows show the requested filename or command, success/failure, and elapsed
time. Command results include a short output preview; the model receives the
bounded result, which can be longer than the terminal preview.

## Guided startup and keys

Run `npm run dev` or `npm run lesson:1` without flags. Missing settings open a
provider selector and model-ID prompt. Up/down or a number highlights a provider;
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
| Ctrl+C | Cancel and exit, restoring the terminal |
| Ctrl+D on empty chat input | Exit |

Terminals with bracketed paste support can paste multiple lines without
submitting them; press Enter to send. Pasted text cannot approve an action.
For terminals without that support, use Ctrl+J for line breaks or keep input to
one line. The view retains up to 5,000 transcript lines; this does not truncate
the separate conversation array sent to the model. Full-screen mode needs at
least 30 columns and 12 rows. Resize freely, or use `--plain` in a small terminal.

Chat stays open after each turn. A quoted task or lessons 1–4 wait for Enter
after completing, so the answer remains visible. `--plain` exits immediately
after these one-shot runs; use it when you want output in your terminal scrollback.

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

These commands belong to the full CLI (lesson 5). Lessons 1–4 use the same
presentation and telemetry around their own explicit model calls.

## Colors and pipes

Formatting is enabled when stdout and stderr are terminals. Set `NO_COLOR` to
disable colors while keeping the full-screen layout. `--plain` or `TERM=dumb`
uses a scrolling view. When stdout is redirected, it contains the model's original Markdown
without labels or usage counters; status and summaries use stderr. Terminal
control sequences from model output are stripped. In approval previews, hidden
control characters are shown as escapes so proposed contents remain visible.

The display observes callbacks from the agent loop; it does not decide which
tools can run. [`screen.ts`](../src/screen.ts) handles the alternate terminal
buffer, keyboard events, redraws, and cleanup. [`display.ts`](../src/display.ts)
turns harness events into presentation; [`render.ts`](../src/render.ts) formats
text; [`usage.ts`](../src/usage.ts) normalizes usage. Compare these with
[`agent.ts`](../src/agent.ts): the execution loop stays independent of the view.
