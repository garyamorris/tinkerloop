# The lesson path

Run lessons from the repository root after following the [quickstart](../README.md).
All examples call a real model. There is no offline model mode.

Read these shared pieces first:

1. [`shared.ts`](shared.ts) loads configuration, selects your connector, and
   handles startup errors and Ctrl+C. It does not implement the agent loop.
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
API request. Ask yourself which code runs locally and which data reaches the model.
