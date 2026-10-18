# 6. Check work with commands

```sh
npm run lesson:6
npm run lesson:6 -- --cwd examples/word-count
```

This lesson adds `run_command`, the tool that lets an agent check its own work.
It also moves the loop out of the lesson. [index.ts](index.ts) calls
[`runAgent`](../../src/agent.ts), which is lesson 5's loop in a function, plus:

- **Hooks** (`onRequest`, `onReply`, `onTool`, `onToolResult`) so a caller can
  display progress. The loop itself never prints anything.
- **Cancellation**: if Ctrl+C arrives mid-turn, every requested tool still gets
  a result, so the history stays valid to send.
- **Result checks**: a tool result must carry its request's call ID.

A command result is JSON with the exit code, stdout, stderr, and whether it
timed out. A nonzero exit code marks the result as an error. That is the
feedback that makes an agent useful: it can claim "the tests pass" only if a
tool result shows it. Read [`command.ts`](../../src/command.ts) for the
30-second timeout, output limits, and how the process tree is stopped. Long
output keeps its start and its end, because a test run's failures and summary
come last; a model that sees only the first passing tests cannot fix anything.

Approved commands run with your user account's permissions. The workspace
folder is where a command starts, not a boundary: a command can read or change
anything you can. Read [local access](../../docs/local-access.md) before using
this on real projects.

**Try:** the default task runs the failing tests, fixes the bug, and runs them
again. Watch the second `npm test` result: that is the evidence. Then try
[`examples/word-count`](../../examples/word-count/README.md), where one fix is
not enough and the model has to iterate on test output.

Next: [7. Wrap the loop in a chat](../07-chat/README.md).
