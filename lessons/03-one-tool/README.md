# 3. Give the model a tool

```sh
npm run lesson:3
npm run lesson:3 -- --cwd examples/tiny-project "Read sum.js using read_file and explain it."
```

[index.ts](index.ts) advertises only `read_file`. Its definition is a name,
description, and JSON schema describing a `path` string. The model can request
the tool, but the HTTP response itself does not read a local file.

Our code calls [`executeTool`](../../src/tools.ts), which validates the request,
checks the workspace path, and uses Node's filesystem API. It appends a result
with the original call ID. A second model call receives that result and explains
it. The call ID connects the request to the correct result.

Even with one available tool, a model may request several reads in one response.
The short `for` loop executes each and returns all results. This stage handles
one round of tools, not an arbitrary sequence of model/tool exchanges.

**Try:** request a missing file. Find the error in the result sent back to the
model. Then improve the tool description and compare its choice of arguments.
Reads need no approval; edits and commands are unavailable in this lesson.

Next: [4. Build the loop](../04-the-loop/README.md).
