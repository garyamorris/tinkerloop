# 5. Ask before changing anything

```sh
npm run lesson:5
npm run lesson:5 -- --provider human
```

This lesson works in [`examples/tiny-project`](../../examples/tiny-project/README.md)
unless you pass `--cwd`. Its `sum.js` has an intentional bug. After the exercise,
restore it with `git restore examples/tiny-project/sum.js`.

[index.ts](index.ts) is lesson 4's loop with one more tool: `write_file`. Reads
still run automatically, but a write changes your files, so the `approve`
function now asks you instead of always answering no. Before asking,
[`executeTool`](../../src/tools.ts) shows the complete proposed file. Nothing is
written unless you type `y` or `yes`. Enter, `n`, or missing terminal input denies.

A denial does not crash the loop. It becomes an ordinary error result with the
same call ID, and the model reads it on the next request. The system prompt
asks the model not to retry a denied write, but that is a request, not a
guarantee. The approval check in your own code is what actually stops the write.

`write_file` replaces a whole file. That keeps this harness small, but a model
must send the entire file to change one character, which costs output tokens.
Real coding agents usually offer an edit tool that replaces one exact, unique
snippet instead. See [make it yours](../../docs/extending.md) for that exercise.

**Try:** deny the first proposed write and read how the model explains what is
unfinished. Run it again and approve. Then play the model with `--provider human`:
propose a `write_file` yourself, and notice that you then approve your own
request as the user. The model and the person approving are separate roles.

Next: [commands as evidence](../06-commands/README.md).
