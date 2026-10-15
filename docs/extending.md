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

Use one of the files in [`src/connectors`](../src/connectors/) as a guide. The
[human connector](../src/connectors/human.ts) is the smallest complete example
of the interface; the HTTP connectors show the real work. Implement
`ModelConnector.complete` with a direct `fetch` request:

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
   Pass response usage through `readUsage` in `src/usage.ts` (add your provider's
   mapping there). Keep unavailable counters undefined so the terminal can
   distinguish missing metrics from reported zeroes.
6. Add the provider to `providers` and its key variable to `keyNames` in
   [`config.ts`](../src/config.ts). That one list also removes the key from shell
   commands and redacts it from error messages. Then update the factory switch,
   help text, guided setup choices, and provider documentation.
7. Add HTTP fixtures for a complete tool round trip, malformed input, and
   provider errors. Verify against a real API when credentials are available.

Run your connector with `--trace traces` and compare the saved request bodies
with the provider's documentation. All lessons then pick up the new connector
without changing their loop code.
Provider selection is fixed for a conversation; switching providers mid-history
would require a deliberate strategy for translating opaque metadata.

## Exercises: what real coding agents add

Tinkerloop leaves these out so the core stays readable. Each is a problem that
production coding agents solve, and each fits in an afternoon. Use
`--provider human` to test your change without spending tokens, then try a real
model with `--trace` to see what changed on the wire.

### An edit tool

`write_file` resends a whole file to change one line, which costs output tokens
and invites accidental changes elsewhere in the file. Add `edit_file` with
`path`, `old_text`, and `new_text`. Require `old_text` to occur exactly once:
return an error when it is missing ("read the file again") or ambiguous
("include more surrounding lines"). That uniqueness check is what stops an edit
from landing in the wrong place. Show a before/after preview for approval.

### A search tool

Exploring a codebase with `run_command` means approving every `grep`. Add a
read-only `search_files` tool that takes a `pattern` and returns bounded
`path:line: text` matches, skipping the names that `list_files` excludes. Add it
to `readOnlyTools` only because it really is read-only.

### Line ranges for large files

`read_file` rejects files over 20,000 bytes. Add optional `start_line` and
`end_line` arguments. This needs optional fields, so extend `ToolDefinition` and
`argumentsFor`. OpenAI's strict mode requires every property to be listed in
`required`, so express "optional" as a type that also allows `null`.

### Project instructions

Real agents read a file such as `AGENTS.md` from the repository and add it to
the system prompt, which is how they learn a project's commands and conventions.
Load it from the workspace root with a size limit and say so in the banner.
Remember that a cloned repository's instructions were written by someone else;
the [injection exercise](../examples/injection-demo/README.md) shows why that
matters.

### Context management

The whole history is sent on every request, so long sessions grow expensive
and eventually exceed the model's context window. When the last reported input
nears `--context-window`, replace old tool results with short placeholders, or
ask the model to summarize earlier turns into a new first message. Be careful:
some providers attach signed reasoning to assistant messages and reject a
history whose earlier turns were edited. Keep `providerData` exactly as
received, and change only messages your program wrote.

### Evals

How do you know a new prompt or tool helped? Write a script that copies a
practice project into a temporary folder, runs one task with approvals granted
automatically inside that throwaway copy, then runs the project's tests. Repeat
it several times and report the pass rate before and after your change. A
single run proves little, because models vary. Never auto-approve in a real
workspace: approved commands still run with your account's permissions.

### More

- Stream visible text while still assembling complete tool calls before execution.
- Save and reload conversation history, taking care with local secrets.
- Estimate cost from the normalized token counts and your provider's prices.
- Put command execution in a container or OS sandbox.

None is required to understand the core harness.
