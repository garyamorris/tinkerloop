# Name, mark, and voice

**Tinkerloop** — *Learn how coding agents work by building the loop.*

![The Tinkerloop mark](mark.svg)

The mark is a clockwise loop around a terminal prompt: a model request goes
out, a reply comes back, and your code runs the tools in between. In the
terminal the same idea is the `↻` that starts each model request line.

## Colours

| Role | Terminal | Graphics |
| --- | --- | --- |
| The harness (this program) | Cyan | `#0A97AA` on light or dark; `#3CC4D6` for text on dark |
| You | Green | `#4FD17F` |
| The model | Magenta | `#D47AE8` |
| Details | Grey | `#7D8B96` |

The mark's cyan has at least 3:1 contrast on both white and GitHub's dark
background, so one file works in both themes. The palette lives in
[`render.ts`](../../src/render.ts); keep new terminal output to these roles.

## Voice

- Call things what they are. The model *requests* a tool; your code *runs* it.
  Say "request" and "reply", not "thinking".
- Never present the model's words as Tinkerloop's. Model text is labelled `model`.
- Short sentences, second person, no hype. A lesson should read like a good
  colleague explaining something at a whiteboard.

## Files

- [`mark.svg`](mark.svg): the mark, one colour, no text.
- [`social-preview.png`](social-preview.png): 1280×640 card for the GitHub
  repository's social preview (Settings → General → Social preview).
- [`social-preview.html`](social-preview.html): its source. Open it in a browser
  with a 1280×640 window and take a screenshot to regenerate the image. It uses
  the Inter font when installed.
