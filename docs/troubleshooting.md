# Troubleshooting

| Symptom | What to check |
| --- | --- |
| Node syntax or engine error | Run `node --version`; use Node 24 or later. |
| Setup appears every run | Answers are session-only. Set `TINKERLOOP_PROVIDER`, `TINKERLOOP_MODEL`, and your key in the environment or ignored `.env.local` to skip questions. |
| No full-screen view | It needs terminal stdin, stdout, and stderr, without `--plain` or `TERM=dumb`. Pipes use ordinary output. |
| Screen says to enlarge the terminal | Resize to at least 30 columns by 12 rows, or restart with `--plain`. |
| Missing token counts | `—` means the API did not report that metric. `/usage` shows reporting coverage; counts are never invented. |
| No context percentage | Set `--context-window` to your model's documented token limit; `/context` still shows measured input without it. |
| “Choose a model” | Set `TINKERLOOP_MODEL` or pass `--model` with a real provider model ID. |
| “Set …_API_KEY” | Configure the key for the selected provider. `.env.local` comes from the launch directory, not `--cwd`. |
| HTTP 401 or 403 | Check the selected provider, key validity, API project permissions, and model access. |
| HTTP 404 | Check the model ID; for compatible servers, check the base URL and supported API route. |
| HTTP 429 | Check provider rate limits, quota, and billing. Tinkerloop does not retry automatically. |
| “fetch failed” | Check network access, proxy/firewall settings, DNS, and endpoint availability. |
| Incomplete response | The model hit an output limit or returned a nonfinal status. Try a smaller task or inspect the provider's limits. Partial tool requests are not executed. |
| Request limit reached | The turn used all allowed model requests. Inspect what happened; continue in chat or increase `--max-steps` deliberately. |
| Context-window error | `/clear` starts fresh. There is no automatic compaction or silent message dropping. |
| Denied without asking | Approval needs a terminal. Piped stdin cannot approve writes or commands. |
| File path rejected | Check workspace boundaries, symlinks, excluded names, and the 20,000-byte file limit. |
| Command timed out | The fixed limit is 30 seconds. Run longer work yourself or simplify the command. |
| Command syntax fails on Windows | The default command shell is generally `cmd.exe`, not PowerShell. Ask for Windows commands, use a portable `node -e` command, or run Tinkerloop inside WSL. |
| Tool output is truncated | Ask for a smaller result. Files larger than 20,000 bytes require an approved command to inspect a section. |

`npm run check` tests the application without calling a provider. It does not
prove that your particular API key, model, or compatible server works. The
example project's tests are intentionally broken until you complete the exercise.

When reporting a problem, include your Node version, operating system, provider,
model ID, and a redacted error message. Never include API keys, `.env.local`, or
private project files. The CLI does not print stack traces or request headers.
