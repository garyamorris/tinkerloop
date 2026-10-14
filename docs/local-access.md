# Local access and approvals

Tinkerloop is an educational local program. Select a small practice directory
first, using `--cwd`, and keep version-control backups of work you care about.

## File tools

`list_files` and `read_file` run automatically. `write_file` displays the complete
replacement contents and asks for approval. A write can create missing parent
directories, but only after approval. An empty content string intentionally
creates or replaces a file with an empty file.

File paths resolve under the selected workspace. The tools reject traversal
outside it, symbolic links in paths, `.git`, `node_modules`, and environment
files named `.env` or `.env.*`, except `.env.example`. Listings omit those entries.
Files read or written are limited to 20,000 bytes. Binary files containing NUL
bytes are rejected by `read_file`. These rules keep the implementation small;
they are not a general secret detector. Credentials can have other filenames.

The executor checks a write path before and after human review and refuses a
final symlink when opening the file where the operating system supports it.
These ordinary filesystem checks do not provide isolation against another
process concurrently replacing ancestor directories. Use OS isolation if you
need a strong security boundary.

## Shell commands

`run_command` shows the exact command and working directory before approval.
It uses your OS's default Node shell: `/bin/sh` on Unix-like systems and the
configured command shell, usually `cmd.exe`, on Windows. A command can access
files outside the workspace, use the network, or modify your machine. It can
also read files that the direct file tools exclude. Approval is the boundary;
the working directory is not a shell sandbox.

The child process does not inherit the four provider API-key variables used by
Tinkerloop. Other environment variables and locally saved files remain
accessible. This does not make an approved command safe automatically.

Each command has a 30-second timeout and receives no interactive stdin. Timeout
or Ctrl+C triggers process-tree termination. Unix uses a process group; Windows
uses `taskkill /T /F`. Deliberately detached background processes can escape that
mechanism; background jobs are unsupported. Output capture is bounded and
truncation is marked. A command error includes exit status and captured output.

## Human input

`y` or `yes`, ignoring case and surrounding spaces, approves **one** proposed
action. Enter or any other response denies it. There is no `--yes` bypass or
session-wide approval. Without a terminal, edits and commands are denied even
if text is piped into stdin.

Denied requests return an error to the model. The instructions tell it to respect
the denial rather than try an alternative route. Prompt instructions are not
an OS security mechanism: continue to inspect every proposal.

## What is shared

The selected model endpoint receives your prompts, instructions, conversation
history, tool descriptions, and tool results. Selected file contents and
captured command output therefore leave your computer when using a remote
provider. We do not automatically upload the full repository. `.env.local` is
not sent as part of configuration; its selected key goes in an authentication
header.

Conversations are kept in memory and disappear on exit or `/clear`. There is no
application transcript file. Provider-side logging and retention remain governed
by your provider. Terminal output and your shell's history may still be saved by
other software.
