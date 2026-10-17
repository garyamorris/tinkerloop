# The lesson path

Run lessons from the repository root after following the [quickstart](../README.md).
Each lesson calls a real model, or you can be the model: add `-- --provider human`
and type the replies yourself. You will see exactly what a model receives on
every request, including the history and tool definitions sent again each time.
Try a lesson both ways. Playing the model shows you what the harness does;
a real model shows you how well a model handles it.

Run `npm run lesson:1` to begin. In a terminal, missing provider/model settings
open guided setup; full-screen mode can also accept a hidden session API key.
Lessons 1–6 keep the result on screen until you press Enter. Use PgUp/PgDn to
review it, or add `-- --plain` for an ordinary scrolling transcript. Lessons 5–7
can change files, so they work in [`examples/tiny-project`](../examples/tiny-project/README.md)
unless you pass `--cwd`.

Read these shared pieces first:

1. [`shared.ts`](shared.ts) loads or prompts for configuration, selects your connector, creates
   the terminal display, and handles startup errors and Ctrl+C. Each lesson
   calls the model and prints its reply explicitly; the display does not run it.
2. [`src/types.ts`](../src/types.ts) describes what each stage passes around.
   `Message[]` is history; `ToolDefinition` describes a function to a model;
   `ToolCall` is a request; `ToolResult` records what actually happened.
3. [`src/connectors/index.ts`](../src/connectors/index.ts) selects a short adapter:
   [OpenAI](../src/connectors/openai.ts),
   [Anthropic](../src/connectors/anthropic.ts),
   [Gemini](../src/connectors/gemini.ts), or
   [Chat Completions compatible](../src/connectors/compatible.ts).
   Open yours and find the URL, headers, JSON body, and parsing code.

The small connector interface lets you use your preferred provider from lesson 1.
An adapter translates the shared types into its provider's HTTP format. You can
learn the loop without learning four protocols simultaneously, then inspect each
adapter when you're ready. No hidden agent runner drives the lessons.

| Lesson | New building block | Code |
| --- | --- | --- |
| [1. Make a model call](01-model-call/README.md) | One request, one reply | [index.ts](01-model-call/index.ts) |
| [2. Remember a conversation](02-conversation/README.md) | History sent with every request | [index.ts](02-conversation/index.ts) |
| [3. Give the model a tool](03-one-tool/README.md) | One tool request and its result | [index.ts](03-one-tool/index.ts) |
| [4. Build the loop](04-the-loop/README.md) | Repeat until the model answers | [index.ts](04-the-loop/index.ts) |
| [5. Ask before changing files](05-approvals/README.md) | File writes with your approval | [index.ts](05-approvals/index.ts) |
| [6. Check work with commands](06-commands/README.md) | Command output as evidence; the loop as a function | [index.ts](06-commands/index.ts) |
| [7. Wrap the loop in a chat](07-chat/README.md) | An outer loop of your messages | [index.ts](07-chat/index.ts) |
| [8. Read the complete CLI](08-the-cli/README.md) | Cancellation, errors, and token counts | [src/main.ts](../src/main.ts) |

New to the vocabulary? The [glossary](../docs/glossary.md) defines each term and
points to the code that implements it.

Imports end in `.js` because those are the filenames Node uses after `tsc` builds
the app. During development, `tsx` resolves the same imports to the TypeScript
source. An `interface` describes data; it does not validate JSON at runtime.
That is why the tool executor still checks model-generated arguments.

**Checkpoint:** before moving to the next lesson, trace the messages sent on each
API request. Add `-- --trace traces` to any lesson to save every request and
response body as numbered JSON files, then open them side by side: watch history
grow, and notice that the tool definitions are resent every time. Ask yourself
which code runs locally and which data reaches the model.
