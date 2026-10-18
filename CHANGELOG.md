# Changelog

Each release is a fixed version of the lesson path, so a course or a blog post
can point at one and stay accurate while `main` moves on.

## 0.3.0

Every lesson and the CLI were run against live APIs for the first time. This
release fixes what those runs found, and lets you choose how much a model
reasons.

### Fixes

- **Long command output keeps its end.** Output over 20,000 characters used to
  keep only its start, so a large failing test run hid the error on stderr and
  the summary from the model. Now each stream keeps its start and end, a marker
  counts what was left out, and the result stays valid JSON.
- **Models act instead of asking first.** The system prompts said each write
  "requires the user's approval", and some models (such as `gpt-5-nano`) then
  replied with a plan and asked for permission in chat, calling no tool. The
  CLI and lesson 5 now say the user's message is the request. Every write and
  command still stops at the approval prompt.
- **An unanswered message leaves the history.** After Ctrl+C or an error with
  no reply, the chat removes that message, so it is not sent again with the
  next one.
- **Readable API errors.** A failed request shows the provider's code and
  message instead of its raw JSON body.

### New

- **`--reasoning-effort`** (or `TINKERLOOP_REASONING_EFFORT`) sets the reasoning
  level for the openai and compatible providers. Some models, such as
  `gpt-5.4-mini`, default to no reasoning.
- **Reasoning tokens in the transcript.** Usage lines show the reasoning share
  of output, such as `out 2,779 (reasoning 1,792)`.
- **Node.js 22 is supported**, and CI checks it on Linux.

### Upgrading from 0.2.0

- Nothing to change: flags, environment variables, and lesson commands are the
  same.
- A long command result now marks its middle with
  `[… N characters omitted …]` instead of ending with `[truncated]`.

### Known gaps

The OpenAI and OpenAI-compatible connectors were checked against live APIs.
The Anthropic and Gemini connectors, including Anthropic's caching request, are
still covered only by tests against recorded HTTP bodies. See
[verification](docs/verification.md).

## 0.2.0

The lessons grow from five to eight, you can learn without an API key, and the
terminal now narrates the loop as it runs.

### Learn

- **Play the model.** `--provider human` makes no API call: each request shows
  you exactly what a model would receive, and you type the reply. It works in
  every lesson and in the CLI, offline and free.
- **See the wire.** `--trace <folder>` saves every request and response body as
  numbered JSON files. Headers, and so API keys, are never saved.
- **Eight lessons instead of five.** The old lesson 5 jumped from a short loop to
  the whole application. It is now four steps: 5 asks before changing files,
  6 checks work with commands, 7 wraps the loop in a chat, and 8 reads the
  complete CLI.
- **Harder practice projects.** `examples/word-count` needs two fixes, so the
  model must iterate on test output. `examples/injection-demo` hides an
  instruction for AI assistants in a file, to show why approvals matter.
- **A glossary** that defines each term in lesson order and links to its code,
  and **extension exercises** for what production agents add: an edit tool,
  search, line ranges, project instructions, context management, and evals.

### Terminal

- `↻` starts every model request line, followed by `↳` for the reply, `→` for a
  tool your code runs, and `✓` or `✗` for its result. These lines appear in the
  full-screen view too.
- The model's text is labelled `model`, and you, the model, and the harness each
  have one colour.
- Lessons open with their number, title, and goal.
- In chat, Ctrl+C stops the current turn and keeps the conversation.
- Full-screen mode leaves its transcript in your scrollback when it exits.

### Fixes

- The Anthropic connector now asks for prompt caching. Every loop step resends
  the same prefix, which was previously billed in full each time.
- Provider key names come from one list, so a new connector's key can no longer
  leak into the environment of approved shell commands.
- The output cap is 16,000 tokens (reasoning counts toward it, and `write_file`
  sends whole files), and a model request may take up to five minutes.

### Identity

- New tagline, *Learn how coding agents work by building the loop*, a mark, a
  social preview image, and short notes on colours and voice in `docs/assets`.
- The README leads with the loop itself and starts you without an API key.

### Upgrading from 0.1.0

- `npm run lesson:5` now runs the approvals lesson. The complete CLI is
  `npm run lesson:8`, or `npm run dev` as before.
- When stdout is redirected, it still contains only the model's text, so
  scripts that read it are unaffected by the new labels.

### Known gaps

The Anthropic caching request, the new output cap, and the longer timeout are
covered by tests against recorded HTTP bodies but have not yet been checked
against live APIs. See [verification](docs/verification.md).

## 0.1.0

The first version: a model/tool loop in plain TypeScript with no runtime
dependencies, five runnable lessons, connectors for OpenAI, Anthropic, Gemini,
and OpenAI-compatible endpoints, file and shell tools with approvals, guided
setup, and a full-screen terminal with token counts.
