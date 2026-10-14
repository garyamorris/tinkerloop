# Verification

Initial local verification: **15 October 2026**, macOS, Node.js 24.14.0.

## Automated checks

`npm run check` runs strict typechecking, the Node test suite, and a TypeScript
build. The suite covers history, sequential tool execution, call/result pairing,
denials, malformed arguments, provider failures, incomplete replies, request
limits, cancellation, path escapes, symlinks, bounded output, command failures,
command timeouts, configuration, and non-terminal approvals.

All four connectors have synthetic HTTP round-trip fixtures under
[`test/fixtures`](../test/fixtures/). Tests check preservation of opaque reasoning
metadata as well as each provider's result format. Fixtures validate our request
and parsing logic; they do not prove access to a live provider or every compatible
server. No credentials or live calls are used by the automated suite.

The [CI workflow](../.github/workflows/ci.yml) runs on Ubuntu, macOS, and Windows
with Node 24. Check the [current CI results](https://github.com/garyamorris/tinkerloop/actions/workflows/ci.yml)
for the status of the published revision.

## Live API and terminal checks

| Capability | Verification |
| --- | --- |
| OpenAI Responses connector | Real requests using `gpt-5.4-mini` |
| Lessons 1–4 | Real model call, remembered project name, file tool round trip, and repeated read-only tool use |
| Complete CLI | Read source and tests, propose a correction, obtain terminal approval, replace the file, then obtain approval for `npm test` |
| Result of coding task | Independently reran the example's three tests: all passed; test files were unchanged |
| Interactive chat | Real follow-up remembered the project name; `/clear`, `/exit`, and end-of-input checked |
| Missing terminal input | Real model's requested write was denied and the proposed file was not created |
| Anthropic, Gemini, compatible connector | HTTP fixtures only; their credentials were not available for live checks |

The coding task ran in a temporary copy of `examples/tiny-project`, leaving the
repository exercise intentionally broken. Provider credentials stayed in the
local environment and were not written to the repository.

The compiled CLI's help and local package installation were also checked. The
project is published on GitHub, not on the npm registry.
