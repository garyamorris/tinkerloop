# Glossary

The words used in Tinkerloop, in roughly the order the lessons introduce them.
Each entry points to the code that makes it real.

## The pieces

**Model.** A language model behind an HTTP API. It reads text and returns text.
It cannot read your files or run commands; it can only *ask* for that.

**Harness.** The program around the model: it builds each request, runs the
tools the model asks for, and decides when to stop. Tinkerloop is a harness.
Coding agents are a model plus a harness.

**Provider.** A company or server that hosts models: OpenAI, Anthropic, Google
Gemini, or anything that speaks the OpenAI Chat Completions format. With
`--provider human`, the provider is you.

**Connector.** The code that turns Tinkerloop's request into one provider's
JSON format and turns the reply back. One file per provider in
[`src/connectors/`](../src/connectors/).

## A conversation

**Message.** One entry in the conversation: something you said, something the
model replied, or a tool result. See `Message` in [`types.ts`](../src/types.ts).

**History.** The array of messages. The model has no memory between requests,
so the harness sends the whole history every time (lesson 2).

**System prompt.** Instructions sent with every request, separate from the
history. They set the model's role and rules. See the prompt in
[`main.ts`](../src/main.ts).

**Request and reply.** One HTTP call to the model and what comes back. In the
terminal, `↻ request` and `↳ reply` mark each one.

**Stop reason.** Why a reply ended: a finished answer, a request for tools, or
an incomplete reply cut off by a limit. The loop acts differently on each.

**Tokens.** The units models read and write, and how providers charge. The
footer and `/usage` show the counts each provider reports.

## Tools

**Tool definition.** A name, a description, and a JSON schema for the
arguments, sent with each request so the model knows what it may ask for. See
`tools` in [`tools.ts`](../src/tools.ts).

**Tool call.** The model's request to use a tool, with arguments. It is only a
request: nothing has happened yet (lesson 3).

**Call ID.** A label on each tool call. The result carries the same ID, so the
model can match answers to questions when it asked for several at once.

**Tool result.** What actually happened when your code ran the tool: the file
contents, the command output, or an error. A denied approval is a result too.

**Approval.** Asking a person before a tool changes anything. Reads run
automatically; writes and commands wait for `y` (lesson 5).

## The loop

**Loop.** Send the history, read the reply, run any requested tools, add their
results to the history, and repeat until the model answers. About ten lines in
[`agent.ts`](../src/agent.ts) (lesson 4).

**Step.** One pass through the loop, which means one model request. `--max-steps`
limits how many a turn may use.

**Turn.** Everything that happens between your message and the model's final
answer: possibly many steps (lesson 7).

**Context window.** The most text a model can read in one request. History
grows every step, so long sessions eventually reach it.

## Watching it work

**Trace.** `--trace <folder>` saves each request and reply body as JSON, so you
can read exactly what was sent. See [`trace.ts`](../src/connectors/trace.ts).

**Prompt injection.** Text inside a file or tool result that tries to give the
model orders. The model sees it as part of the conversation, which is why
approvals matter. Try the [injection exercise](../examples/injection-demo/README.md).
