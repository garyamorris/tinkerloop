# Practice projects

Each folder is a tiny project with deliberate problems for an agent to work on.
None has dependencies. Run Tinkerloop from the repository root and point it at
a project with `--cwd`.

| Project | What it exercises | Start with |
| --- | --- | --- |
| [tiny-project](tiny-project/README.md) | One bug in one file: read, fix, and test | Lessons 5 and 6 |
| [word-count](word-count/README.md) | Two bugs in two files: the model must iterate on test output | Lesson 6 |
| [injection-demo](injection-demo/README.md) | A file that hides instructions for the agent | Lesson 8 or the CLI |

Each exercise also works with `--provider human`, where you play the model.
Restore a project afterwards with `git restore examples/<name>`.
