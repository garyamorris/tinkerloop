# Make it yours

Start by tracing one request through the [lessons](../lessons/README.md).
Add one capability at a time and keep the loop readable.

## Add a tool

For a small string-argument tool, edit [`src/tools.ts`](../src/tools.ts):

1. Add a definition to `tools`: give it a descriptive name, useful description,
   and string fields. Every field is required in this minimal schema.
2. Add its execution branch to `executeTool`. Runtime validation happens before
   the branch, but add any tool-specific checks before taking action.
3. If it changes anything, call `context.approve` with a concrete preview and
   require `true` before mutation. Check cancellation again after approval.
4. Return useful evidence in `result.content` and mark failures with `isError`.
   Keep output bounded. The caller supplies the original call ID and name.
5. Add focused tests for its behavior and approval boundary.

If your tool needs numbers, arrays, or optional fields, extend both
`ToolDefinition` and `argumentsFor`. Changing a TypeScript type alone does not
validate model output. Keep provider schema requirements in mind, particularly
strict OpenAI function schemas. Add a tool to `readOnlyTools` only if it is
actually read-only.

## Add a connector

Use one of the files in [`src/connectors`](../src/connectors/) as a guide.
Implement `ModelConnector.complete` with a direct `fetch` request:

1. Translate system instructions, messages, tool definitions, and results into
   the provider's documented format.
2. Supply credentials in request headers and propagate the abort signal through
   `postJson`. Do not log credentials or reuse another provider's key.
3. Translate returned text and tool calls into `ModelReply`. Tool IDs must match
   the IDs expected when returning results. Keep unvalidated arguments as
   `unknown` until the executor checks them.
4. Preserve original assistant blocks in `providerData`, including any required
   signatures or reasoning items. Replay them correctly on later requests.
5. Distinguish complete answers, tool requests, and incomplete output.
6. Add the provider to `Provider`, configuration validation and key selection,
   the factory switch, help, and provider documentation.
7. Add HTTP fixtures for a complete tool round trip, malformed input, and
   provider errors. Verify against a real API when credentials are available.

All lessons then pick up the new connector without changing their loop code.
Provider selection is fixed for a conversation; switching providers mid-history
would require a deliberate strategy for translating opaque metadata.

## Useful next experiments

- Add a dedicated search tool so routine searches need no shell approval.
- Add token and cost reporting from provider usage fields.
- Save and reload conversation history, taking care with local secrets.
- Stream visible text while still assembling complete tool calls before execution.
- Put command execution in a container or OS sandbox.

Treat these as exercises. None is required to understand the core harness.
