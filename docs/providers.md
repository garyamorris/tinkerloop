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

Set `TINKERLOOP_PROVIDER` and `TINKERLOOP_MODEL` in `.env.local` to avoid typing
flags. Command-line options take precedence. The default provider is OpenAI;
there is deliberately no default model, so you choose what you will run and pay
for. You only need the key for your selected provider.

## OpenAI

For example, after setting `OPENAI_API_KEY`:

```sh
npm run lesson:1 -- --provider openai --model gpt-5.4-mini
npm run dev -- --provider openai --model gpt-5.4-mini "Read README.md."
```

The adapter uses `POST /v1/responses`, function tools, explicit history, and
encrypted reasoning content when returned. It sets `store: false`.
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
assistant blocks are preserved if returned. Output is capped at 8,192 tokens.
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
