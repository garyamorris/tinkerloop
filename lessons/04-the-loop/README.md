# 4. Build the loop

```sh
npm run lesson:4
npm run lesson:4 -- --cwd examples/tiny-project "List the files, read sum.js and sum.test.js, and explain the bug."
```

Compare [index.ts](index.ts) with lesson 3. The main change is repetition:

1. Send the current messages and tool definitions.
2. Append the assistant reply.
3. If there are no tool calls, the answer finishes this turn.
4. Otherwise execute each tool, append its result, and repeat.

The available tools are still read-only: `list_files` and `read_file`. This stage
can investigate code but cannot change it. The loop has a request limit so a
model cannot keep calling tools indefinitely. Truncated provider responses also
stop the lesson instead of executing partial tool requests.

**Try:** pass `--max-steps 1`. An answer that needs a tool round trip may now hit
the limit. That means the task is unfinished, not that the harness succeeded.
Follow each mutation of `messages` to see exactly why a subsequent request is
needed.

Next: [the complete CLI](../05-the-cli/README.md).
