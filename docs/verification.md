# Verification

Initial local verification: **15 October 2026**, macOS, Node.js 24.14.0.

## Automated checks

`npm run check` runs strict typechecking, 68 Node tests, and a TypeScript
build. The suite covers history, sequential tool execution, call/result pairing,
denials, malformed arguments, provider failures, incomplete replies, request
limits, cancellation, path escapes, symlinks, bounded output, command failures,
command timeouts, configuration, non-terminal approvals, provider token
accounting, context percentages, partial reporting, terminal control handling,
clean redirected output, guided setup, hidden session keys, bracketed paste,
default-deny full-screen approvals, resize, terminal mode restoration, the
transcript left in scrollback, per-turn Ctrl+C cancellation, provider-key
removal from command environments, trace files, and the human provider's reply
parsing and full tool round trip.

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

## Lesson split, tracing, and the human provider

Checked on 15 October 2026 on Linux with Node.js 22, by driving the real
programs through a pseudo-terminal with `--provider human`:

| Capability | Verification |
| --- | --- |
| Lesson 3 | Typed `read_file` request executed; the next request showed the result under its call ID |
| Lesson 5 | First write denied and returned as an error result; second write approved, and the practice tests then passed |
| Lesson 6 | Approved `npm test` returned exit code 1 and the failing output to the "model" |
| Lesson 7 | Defaulted to the practice project; a follow-up turn carried earlier history; `/clear` reset it |
| Full-screen chat | Ctrl+C cancelled a turn and the chat continued; tool use, answer, and `/exit` worked |
| Practice projects | `word-count` needs both fixes to pass; `injection-demo` passes once `greet.js` is fixed |

These changes were not checked against live provider APIs, because no
credentials were available: the Anthropic `cache_control` request field, the
16,000-token output cap, and the five-minute request timeout. Fixtures confirm
the request bodies; confirm behavior with a real key before relying on it.
