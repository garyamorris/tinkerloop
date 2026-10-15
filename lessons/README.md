# The lesson path

Run lessons from the repository root after following the [quickstart](../README.md).
Each lesson calls a real model, or you can be the model: add `-- --provider human`
and type the replies yourself. You will see exactly what a model receives on
every request, including the history and tool definitions sent again each time.
Try a lesson both ways. Playing the model shows you what the harness does;
a real model shows you how well a model handles it.

Run `npm run lesson:1` to begin. In a terminal, missing provider/model settings
open guided setup; full-screen mode can also accept a hidden session API key.
Lessons 1–4 keep the result on screen until you press Enter. Use PgUp/PgDn to
review it, or add `-- --plain` for an ordinary scrolling transcript.

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

| Stage | New building block | Entry point |
| --- | --- | --- |
| [1](01-model-call/README.md) | A single request | [index.ts](01-model-call/index.ts) |
| [2](02-conversation/README.md) | Explicit history | [index.ts](02-conversation/index.ts) |
| [3](03-one-tool/README.md) | Local tool execution and result | [index.ts](03-one-tool/index.ts) |
| [4](04-the-loop/README.md) | A bounded loop | [index.ts](04-the-loop/index.ts) |
| [5](05-the-cli/README.md) | Complete CLI with human approval | [src/main.ts](../src/main.ts) |

Imports end in `.js` because those are the filenames Node uses after `tsc` builds
the app. During development, `tsx` resolves the same imports to the TypeScript
source. An `interface` describes data; it does not validate JSON at runtime.
That is why the tool executor still checks model-generated arguments.

**Checkpoint:** before moving to the next lesson, trace the messages sent on each
API request. Add `-- --trace traces` to any lesson to save every request and
response body as numbered JSON files, then open them side by side: watch history
grow, and notice that the tool definitions are resent every time. Ask yourself
which code runs locally and which data reaches the model.
