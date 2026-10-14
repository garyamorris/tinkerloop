# 1. Make a model call

```sh
npm run lesson:1
npm run lesson:1 -- "Explain what fetch does in two sentences."
```

Read [index.ts](index.ts). A system prompt, one user message, and an empty tool
list go to `connector.complete`. The reply contains the assistant's text and a
stop reason. This stage has no local tools and cannot edit files or run commands.

Follow the call into [your connector](../README.md). Find its `postJson` call.
The request contains an authentication header and JSON body. `fetch` performs
the HTTP request; the connector translates the response into our shared type.
The provider runs the model remotely, unless you configured a local server.

`signal` supports cancellation. `providerData` keeps opaque response blocks for
later history, even though this first stage does not need them yet.

**Try:** change the system prompt to explain things to a ten-year-old. Then
change only the user message. Observe which part controls style and which part
sets the task. Avoid logging the config object: it contains your API key.

Next: [conversation history](../02-conversation/README.md).
