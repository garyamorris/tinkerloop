# An annotated tool round trip

This is one turn of the complete CLI, shortened. Exact wording, tool order, and
call IDs vary by model and provider, and token counts are left out. To produce
one like it yourself, run the practice task with `--provider human` and play the
model.

Lines starting with `+` are annotations, not terminal output. Each shows what
joins the history at that moment. Count them, and you will see why every `↻`
line sends two more messages than the one before.

## A request becomes an action

```text
you
Read the code, fix sum.js, and run npm test.
  + user: "Read the code, fix sum.js, and run npm test."

↻ request 1/10 · 1 message sent
↳ reply · 1 tool call
  + assistant: read_file {"path": "sum.js"}             call ID read_1
→ read_file sum.js
✓ read_file sum.js · 2 ms
  + tool result read_1: "export function sum(numbers) { … index < numbers.length - 1 … }"
```

The model returned JSON describing a request; nothing had happened yet.
`executeTool` validated it and read the file locally. The request and its result
both join the history, linked by the call ID, before the next `↻`.

## A file change needs approval

```text
↻ request 2/10 · 3 messages sent
↳ reply · 1 tool call
  + assistant: write_file {"path": "sum.js", "content": "<the complete fixed file>"}   call ID write_1
→ write_file sum.js

Approval required
Create or replace /your/practice/sum.js with these complete contents:

--- begin file ---
… index < numbers.length …
--- end file ---

Allow this action? [y/N] y
✓ write_file sum.js · 4210 ms
Wrote 112 bytes to sum.js.
  + tool result write_1: "Wrote 112 bytes to sum.js."
```

The file changes only after you type `y`, and the duration includes the time you
spent reading the proposal. `write_file` takes the entire new file, which keeps
this harness free of a patch parser; [make it yours](extending.md) suggests an
edit tool as an exercise.

## A command returns evidence

```text
↻ request 3/10 · 5 messages sent
↳ reply · 1 tool call
  + assistant: run_command {"command": "npm test"}       call ID test_1
→ run_command npm test

Approval required
Run in /your/practice:

npm test

Allow this action? [y/N] y
✓ run_command npm test · 5380 ms
exit 0
> test
> node --test sum.test.js
… more output sent to the model
  + tool result test_1: {"exitCode": 0, "timedOut": false, "stdout": "… pass 3 …", …}

↻ request 4/10 · 7 messages sent
↳ reply · answer
  + assistant: "Fixed the loop to include the last number. All three tests pass."

model
Fixed the loop to include the last number. All three tests pass.
```

The final answer is grounded in a tool result: the model can say the tests pass
because a result shows exit code 0. A nonzero exit code is an error result,
marked `✗`, not a successful test run. The terminal shows a short preview of the
output; the model receives the whole bounded result.

## Denial is a result too

If you type `n` instead, nothing is written or run, and the same call ID still
gets a result:

```text
✗ write_file sum.js · 3104 ms
User denied this file change. Do not retry it without a new user request.
  + tool result write_1 (error): "User denied this file change. Do not retry it without a new user request."
```

The next request includes that denial, so the model can report what remains
unfinished. The harness never approves a substitute on your behalf.
