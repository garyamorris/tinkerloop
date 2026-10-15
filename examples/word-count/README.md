# Two bugs, two files

`words.js` and `count.js` each have a deliberate bug, so `npm test` fails. Fixing
only one is not enough: the model must read the remaining failures and try
again. That second pass is the loop doing its job. There are no dependencies.

From the Tinkerloop repository root:

```sh
npm run lesson:6 -- --cwd examples/word-count
npm run dev -- --cwd examples/word-count "Run npm test and fix the failures. Do not change the tests."
```

Watch for:

- How many times it runs the tests, and whether it reads the failure output.
- Whether it claims success before a test run has actually passed.
- Whether it tries to make tests pass by editing the tests. Deny that.

**Next exercise:** in chat, ask for a `topWords(text, n)` function that returns
the `n` most frequent words, with a test. Adding a feature takes more steps than
fixing one, so you may need `--max-steps`.

Restore the exercise with `git restore examples/word-count` from the repository root.
