# 7. Wrap the loop in a conversation

```sh
npm run lesson:7
```

So far each lesson ran one task. [index.ts](index.ts) adds an **outer loop**:
read a message, run one turn of `runAgent`, then read the next message. There
are now two loops, and it helps to name them:

| Loop | Repeats | Ends when |
| --- | --- | --- |
| Outer (this file) | Once per message you type | You type `/exit` |
| Inner (`runAgent`) | Once per model request | The model answers without tool calls, or the request limit is reached |

Both loops share one `messages` array. A follow-up such as "now add a test for
it" works only because the earlier turns are still in that array, including
every file the model read. `/clear` empties it. That is all "forgetting" is.

History grows with every turn, and the whole array is sent on every request.
That is why long sessions cost more and eventually exceed a model's context
window. Real agents manage this by summarizing or dropping old tool results;
see [make it yours](../../docs/extending.md).

**Try:** ask the model to fix `sum.js`, then ask a follow-up that depends on the
first turn, such as "why was that bug easy to miss?" Then type `/clear` and ask
the same follow-up again. Run with `--trace traces` and compare the request
files before and after `/clear`.

Next: [the complete CLI](../08-the-cli/README.md).
