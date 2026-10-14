# A small bug to fix

`sum.js` deliberately skips the last number. `npm test` should fail until you fix it.
There are no dependencies to install in this folder.

From the Tinkerloop repository root, with a provider and model configured:

```sh
npm run dev -- --cwd examples/tiny-project "Read the code, fix sum.js, and run npm test."
```

Review the proposed file replacement and each shell command before approving.
Keep the tests unchanged. To repeat the exercise in a Git clone, restore the
example with `git restore examples/tiny-project/sum.js` from the repository root.
