# An annotated tool round trip

This is an illustrative, shortened transcript. Exact wording and tool order vary
by model. The application calls a real provider; this is not an offline mode.

## A request becomes an action

```text
You: Read the code, fix sum.js, and run npm test.

Model request 1:
  tool: read_file
  call ID: read_1
  arguments: { "path": "sum.js" }

Local result:
  call ID: read_1
  content: export function sum(numbers) { ... index < numbers.length - 1 ... }
```

The model returned JSON describing a request. `executeTool` validated it and
read a file locally. The harness appends both the assistant's request and the
matching result to the message history. A test-file read may follow.

## A file change needs approval

```text
Model request 2:
  tool: write_file
  call ID: write_1
  arguments:
    path: sum.js
    content: <the complete corrected source>

Terminal:
  Create or replace /your/practice/sum.js with these complete contents:
  --- begin file ---
  ... index < numbers.length ...
  --- end file ---

  Allow this action? [y/N] y

Local result:
  call ID: write_1
  content: Wrote ... bytes to sum.js.
```

The file changes only after approval. `write_file` accepts the entire new file,
which avoids introducing a patch parser in the first version.

## A command returns evidence

```text
Model request 3:
  tool: run_command
  call ID: test_1
  arguments: { "command": "npm test" }

Terminal:
  Run in /your/practice:
  npm test
  Allow this action? [y/N] y

Local result:
  call ID: test_1
  content: { "exitCode": 0, "timedOut": false, "stdout": "... pass 3 ...", ... }

Model request 4:
  answer: Fixed the loop to include the last number. All three tests pass.
```

The final answer is grounded in the tool result. A nonzero exit status is an
error result, not a successful test run.

## Denial is a result too

If you enter `n`, the executor returns an error associated with the same call
ID. No write or command occurs. The next API request includes that denial so
the model can report what remains unfinished. The harness does not silently
approve a substitute command.
