# Contributing

Keep the teaching goal in mind: someone with basic TypeScript knowledge should
be able to trace the model/tool loop without learning a framework first.

```sh
npm ci
npm run check
```

Prefer small functions, descriptive names, and comments explaining why a step
exists. Keep runtime dependencies at zero. If you change behavior, update the
relevant lesson and documentation as well as the final CLI. Intermediate stages
intentionally repeat a little conversation logic so their changes are visible.

Tests use Node's built-in test runner through `tsx`, synthetic HTTP fixtures,
and temporary directories. Do not add live API calls or credentials to CI.
New filesystem or command behavior needs tests proving when mutation occurs,
including denial and cancellation paths. Provider changes need a round-trip
fixture that preserves required metadata.

The practice project's bug is intentional. Fix it only while doing the exercise,
and restore it before submitting unrelated changes.

Use plain, descriptive commit messages. Do not add automated attribution or
co-author trailers. Never commit credentials or generated build output.
