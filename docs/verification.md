# Verification

Initial local verification: **15 October 2026**, macOS, Node.js 24.14.0.

## Automated checks

`npm run check` runs strict typechecking, 59 Node tests, and a TypeScript
build. The suite covers history, sequential tool execution, call/result pairing,
denials, malformed arguments, provider failures, incomplete replies, request
limits, cancellation, path escapes, symlinks, bounded output, command failures,
command timeouts, configuration, non-terminal approvals, provider token
accounting, context percentages, partial reporting, terminal control handling,
clean redirected output, guided setup, hidden session keys, bracketed paste,
default-deny full-screen approvals, resize, and terminal mode restoration.

All four connectors have synthetic HTTP round-trip fixtures under
[`test/fixtures`](../test/fixtures/). Tests check preservation of opaque reasoning
metadata as well as each provider's result format. Fixtures validate our request
and parsing logic; they do not prove access to a live provider or every compatible
server. No credentials or live calls are used by the automated suite.

The [CI workflow](../.github/workflows/ci.yml) runs on Ubuntu, macOS, and Windows
with Node 24. Check the [current CI results](https://github.com/garyamorris/tinkerloop/actions/workflows/ci.yml)
for the status of the published revision.

The [first published CI run](https://github.com/garyamorris/tinkerloop/actions/runs/38654329560)
passed all checks on all three operating systems.

## Live API and terminal checks

| Capability | Verification |
| --- | --- |
| OpenAI Responses connector | Real requests using `gpt-5.4-mini` |
| Lessons 1–4 | Real model call, remembered project name, file tool round trip, and repeated read-only tool use |
| Complete CLI | Read source and tests, propose a correction, obtain terminal approval, replace the file, then obtain approval for `npm test` |
| Result of coding task | Independently reran the example's three tests: all passed; test files were unchanged |
| Interactive chat | Real follow-up remembered the project name; `/clear`, `/exit`, and end-of-input checked |
| Terminal presentation and usage | Real OpenAI lesson response with headings, lists, code, input/output tokens, and cache counters |
| Full-screen startup | CLI and lesson 1 launched without provider/model flags; provider selection and model prompt exercised |
| Full-screen coding task | Real OpenAI read/edit/test loop in a temporary project, scrollable file approval, command approval, and live footer |
| Missing terminal input | Real model's requested write was denied and the proposed file was not created |
| Anthropic, Gemini, compatible connector | HTTP fixtures only; their credentials were not available for live checks |

The coding task ran in a temporary copy of `examples/tiny-project`, leaving the
repository exercise intentionally broken. Provider credentials stayed in the
local environment and were not written to the repository.

The compiled CLI's help and local package installation were also checked. The
project is published on GitHub, not on the npm registry.
