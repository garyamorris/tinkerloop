# 2. Remember a conversation

```sh
npm run lesson:2
npm run lesson:2 -- "My favorite language is TypeScript."
```

[index.ts](index.ts) makes two API calls. Before the second call it appends both
the first assistant reply and a follow-up user message to the array:

```text
user: My project is called Acorn. Remember that name.
assistant: ...
user: What did I just tell you?
```

The harness remembers by resending the conversation. Nothing is saved to disk.
Watch the `↻` lines in the transcript: the first request sends one message, the
second sends three.
The connector also resends the provider's original assistant blocks so required
reasoning metadata remains intact. You do not need to interpret that metadata.

**Try:** replace the second request's `messages` with an array containing only
the follow-up. Then restore the history and compare the answers. Longer history
uses more input tokens; memory has a cost.

Next: [3. Give the model a tool](../03-one-tool/README.md).
