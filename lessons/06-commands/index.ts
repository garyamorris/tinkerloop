import { runAgent } from "../../src/agent.js";
import { executeTool, tools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

// New in this lesson: run_command, and the loop moves into src/agent.ts.
await lesson(
  {
    number: 6,
    title: "Check work with commands",
    goal: "Command output is evidence: the model runs the tests and reads what failed.",
    workspace: "examples/tiny-project",
  },
  async ({ connector, config, systemPrompt, signal, display, approve }) => {
    const messages: Message[] = [
      {
        role: "user",
        content:
          config.prompt ||
          "Run npm test. If tests fail, fix sum.js and run the tests again. Do not change the tests.",
      },
    ];
    display.user(messages[0]!.content);

    // runAgent is lesson 5's loop, moved into a function. The on* hooks let
    // this file show progress without the loop knowing about any terminal.
    const status = await runAgent({
      connector,
      systemPrompt: `${systemPrompt} After changing code, run the tests again. Report only results that a tool result shows.`,
      messages,
      tools,
      maxSteps: config.maxSteps,
      signal,
      // A command's exit code, stdout, and stderr come back as evidence. A
      // failing test run is an error result the model can act on.
      execute: (call) =>
        executeTool(call, { cwd: config.cwd, signal, approve }),
      onRequest: (step) => display.request(step, config.maxSteps, messages),
      onReply: (reply) => display.reply(reply),
      onTool: (call) => display.tool(call),
      onToolResult: (result, call, duration) =>
        display.toolResult(result, call, duration),
    });
    display.finish(messages, tools.length);
    if (status === "limit")
      throw new Error(
        `Stopped after ${config.maxSteps} requests; the task may be unfinished.`,
      );
    if (status === "incomplete")
      throw new Error("The model response was incomplete.");
  },
);
