# 8. Read the complete CLI

```sh
npm run lesson:8
npm run lesson:8 -- --cwd examples/tiny-project "Read the code, fix sum.js, and run npm test."
```

This stage runs the real CLI, [`src/main.ts`](../../src/main.ts). There is no
second copy of the finished application to drift out of sync. You have already
met every core idea; this lesson is about what a usable tool adds around them.

Read the parts in this order:

1. [`main.ts`](../../src/main.ts) is lesson 7's outer loop, with slash commands,
   error handling, and per-turn cancellation. Compare its system prompt with the
   lessons' one-line prompt.
2. [`agent.ts`](../../src/agent.ts) is the inner loop you used in lessons 6–7.
3. [`tools.ts`](../../src/tools.ts) validates requests and keeps file paths
   inside the workspace; [`command.ts`](../../src/command.ts) runs approved commands.
4. [`config.ts`](../../src/config.ts) turns flags and environment variables into
   configuration; [`setup.ts`](../../src/setup.ts) asks for missing settings.
5. [`terminal.ts`](../../src/terminal.ts) reads input and asks for approval.
6. [`display.ts`](../../src/display.ts), [`render.ts`](../../src/render.ts), and
   [`usage.ts`](../../src/usage.ts) format the transcript and normalize token
   counts across providers.
7. [`screen.ts`](../../src/screen.ts) draws the full-screen view. It calls no
   model or tool. Use `--plain` to follow the same loop in a scrolling transcript.

What the CLI adds over lesson 7:

- **Turn cancellation.** Ctrl+C during a turn stops that turn and keeps the
  conversation. `runAgent` already pairs every tool call with a result, so the
  history is still valid to send. If the model had not replied at all, your
  message is taken back out, so it is not sent again with the next one. Ctrl+C
  at the prompt quits.
- **Errors without losing the session.** A failed HTTP request shows the
  provider's error code and message, then returns to the prompt; `/clear`
  starts over.
- **Telemetry.** `/usage` shows session token totals and `/context` shows the
  last measured input size. The [terminal guide](../../docs/terminal.md)
  explains cache counters and the optional context-window setting.

There is no approve-everything flag: each write and command asks separately.

**Try:** deny an edit and inspect the model's explanation. Then review and
approve a fix in the practice project, and check that it did not weaken the
tests. Try the [prompt-injection exercise](../../examples/injection-demo/README.md)
to see why the approval step matters even when the model behaves well.

Next: [make it yours](../../docs/extending.md).
