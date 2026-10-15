# 5. Assemble the CLI

```sh
npm run lesson:5
npm run lesson:5 -- --cwd examples/tiny-project "Read the code, fix sum.js, and run npm test."
```

This stage runs the real CLI, using [`src/main.ts`](../../src/main.ts). There is
no second copy of the finished application to drift out of sync.

Read the parts in this order:

1. [`config.ts`](../../src/config.ts) turns flags and environment variables into configuration;
   [`setup.ts`](../../src/setup.ts) prompts for missing settings when terminal input exists.
2. [`main.ts`](../../src/main.ts) adds user messages, sets the instructions, and starts turns.
3. [`agent.ts`](../../src/agent.ts) is lesson 4's loop with callbacks and error/cancellation handling.
4. [`tools.ts`](../../src/tools.ts) validates requests and implements file operations.
5. [`terminal.ts`](../../src/terminal.ts) asks for human approval.
6. [`command.ts`](../../src/command.ts) starts local processes and bounds their output and duration.
7. [`display.ts`](../../src/display.ts), [`render.ts`](../../src/render.ts), and
   [`usage.ts`](../../src/usage.ts) format the transcript and surface provider
   token counts independently of tool execution.
8. [`screen.ts`](../../src/screen.ts) manages the alternate screen, scrollable
   transcript, input editor, and fixed footer. It calls no model or tool.

Use `--plain` to follow the same loop in a scrolling transcript. The extra screen
code is presentation; the model/tool loop remains visible in `agent.ts`.

The new tools are `write_file` and `run_command`. Both show their proposals
before asking permission. Enter, `n`, or missing terminal input denies them.
Type `y` or `yes` to approve one action. There is no approve-everything flag.

The outer chat loop accepts another user message after an agent turn finishes.
`/clear` empties history; `/exit` ends the process. Ctrl+C cancels the run.
This outer loop is separate from the inner model/tool loop.

Try `/usage` for session token totals and `/context` for the last reported input
size and current history size. `/clear` resets conversation context while
retaining session usage. The [terminal guide](../../docs/terminal.md) explains
cache counters, missing metrics, and the optional context-window setting.

**Try:** deny an edit and inspect the model's explanation. Then review and
approve a fix in the practice project. The example tests should pass after the
agent fixes `sum.js`; do not let it weaken the tests.

Next: [add your own tool or connector](../../docs/extending.md).
