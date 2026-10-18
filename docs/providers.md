# Connect a model

All lessons and the CLI use the same configuration. Choose a **tool-capable**
model ID from your provider's catalog. Set the key locally in your environment
or ignored `.env.local`; never add it to a source file.

| `--provider` | API used | Key variable | Model catalog |
| --- | --- | --- | --- |
| `openai` | Responses | `OPENAI_API_KEY` | [OpenAI models](https://developers.openai.com/api/docs/models) |
| `anthropic` | Messages | `ANTHROPIC_API_KEY` | [Claude models](https://platform.claude.com/docs/en/about-claude/models/overview) |
| `gemini` | Interactions | `GEMINI_API_KEY` | [Gemini models](https://ai.google.dev/gemini-api/docs/models) |
| `compatible` | Chat Completions with function tools | `OPENAI_COMPATIBLE_API_KEY` (optional) | Your server's catalog |
| `human` | None: you type the replies | None | You |

Set `TINKERLOOP_PROVIDER` and `TINKERLOOP_MODEL` in `.env.local` to avoid typing
flags. Command-line options take precedence. In a terminal, missing settings
open guided setup: choose the provider, enter a model ID, then supply any missing
endpoint or key. OpenAI setup offers `gpt-5.4-mini` as a suggestion that you can
accept or replace. A full-screen key prompt hides input and keeps the key only
in this process. It never edits your environment or `.env.local`.

Without terminal input, there are no questions: the provider defaults to OpenAI
and a model must be configured. In `--plain` mode, set keys in your environment
or `.env.local`; its readline prompts do not accept secret input. You only need
credentials for the selected provider.

## OpenAI

For example, after setting `OPENAI_API_KEY`:

```sh
npm run lesson:1 -- --provider openai --model gpt-5.4-mini
npm run dev -- --provider openai --model gpt-5.4-mini "Read README.md."
```

The adapter uses `POST /v1/responses`, function tools, explicit history, and
encrypted reasoning content when returned. It sets `store: false` and caps
output, including reasoning, at 16,000 tokens.

Some models, such as `gpt-5.4-mini`, default to no reasoning. To see reasoning
in the loop, choose a level with `--reasoning-effort` or
`TINKERLOOP_REASONING_EFFORT`: `none`, `minimal`, `low`, `medium`, `high`, or
`xhigh`. Each model supports only some levels, and the API says which when you
pick another. The adapter sends it as `reasoning.effort`; the compatible adapter
sends `reasoning_effort`. Anthropic and Gemini do not accept this setting.
Reasoning tokens count as output, and the transcript shows their share.
Read the [adapter](../src/connectors/openai.ts),
[function calling guide](https://developers.openai.com/api/docs/guides/function-calling),
and [example model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
Use a model your API account can access; model availability changes.

## Anthropic

Set `ANTHROPIC_API_KEY`, then replace `YOUR_MODEL_ID` with an ID from the catalog:

```sh
npm run lesson:1 -- --provider anthropic --model YOUR_MODEL_ID
```

The [adapter](../src/connectors/anthropic.ts) uses `POST /v1/messages`,
`input_schema` tool definitions, `tool_use` requests, and `tool_result` replies.
Results for the same assistant turn are grouped into one user message. Signed
assistant blocks are preserved if returned. Output is capped at 16,000 tokens.
Anthropic caches a prompt only when the request asks, so the adapter sets
top-level `cache_control`. Each loop step resends the previous step's prefix,
which the next request reads from the cache; watch the footer's cache counters.
See [handling tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls).

## Gemini

Set `GEMINI_API_KEY` and choose an Interactions-supported, tool-capable model:

```sh
npm run lesson:1 -- --provider gemini --model YOUR_MODEL_ID
```

The [adapter](../src/connectors/gemini.ts) uses the native
`POST /v1beta/interactions` endpoint. It sets `store: false` and replays all
returned steps, including thought signatures, on the next request. Local tool
results use the exact function call ID.
Read the [Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
and [function calling guide](https://ai.google.dev/gemini-api/docs/function-calling).
This is separate from Gemini's Generate Content API and its wire format.

## An OpenAI-compatible endpoint

Configure the **API prefix**, not a full Chat Completions URL. For a local server
it might look like this:

```dotenv
TINKERLOOP_PROVIDER=compatible
TINKERLOOP_MODEL=YOUR_SERVER_MODEL_ID
TINKERLOOP_BASE_URL=http://localhost:11434/v1
# Set this only if the server requires authentication.
OPENAI_COMPATIBLE_API_KEY=
```

The adapter appends `/chat/completions`. The server and model must support
function-tool definitions, `tool_calls`, tool result messages, and multi-turn
history. A server that only offers text completion is insufficient.

Remote endpoints require HTTPS; plain HTTP is allowed for `localhost`,
`127.0.0.1`, or `::1`. URL credentials, query parameters, fragments, and HTTP
redirects are rejected. The connector only sends
`OPENAI_COMPATIBLE_API_KEY`; it never falls back to a native provider's key.
Check the [adapter](../src/connectors/compatible.ts) against your server's docs.

## You, as the model

```sh
npm run lesson:3 -- --provider human --cwd examples/tiny-project
npm run dev -- --provider human --cwd examples/tiny-project
```

The [human connector](../src/connectors/human.ts) makes no network request. For
each model request it prints the system prompt, the tool definitions, and the
message history, marking what is new since your last reply. Type plain text to
answer, or request a tool by name followed by a JSON object:

```text
read_file {"path": "sum.js"}
write_file {"path": "notes.md", "content": "# Notes\nFirst line"}
```

Put several requests on separate lines; each gets its own call ID. Invalid JSON
or an unknown tool name still becomes a request, so the executor's error comes
back to you exactly as it would to a real model. Writes and commands still ask
for approval, which means you propose a change as the model and then decide
on it as the user. A terminal is required, no key or model ID is needed, and
token counts are absent because no model API reported any.

## Costs, data, and verification

Each turn can make several API calls. Each includes history and tool results;
longer sessions therefore use more tokens. `--max-steps` limits request count,
not money or tokens. Configure budgets in your provider account and consult its
current pricing. A ChatGPT subscription does not by itself configure an API key.

Your prompts, instructions, selected file contents, tool results, and command
output reach the selected endpoint. Read its data-handling policy. `store: false`
controls conversation storage where supported, not every form of retention.

Automated tests use synthetic HTTP fixtures for all four protocols. Live checks
depend on locally available credentials; see [verification](verification.md)
for what was actually exercised before publication.
