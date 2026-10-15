import { executeTool, tools as allTools } from "../../src/tools.js";
import type { Message } from "../../src/types.js";
import { lesson } from "../shared.js";

// New in this lesson: write_file. It changes your files, so a person approves
// each write. Commands arrive in lesson 6.
const tools = allTools.filter((tool) => tool.name !== "run_command");

await lesson(
  async ({ connector, config, systemPrompt, signal, display, approve }) => {
    const messages: Message[] = [
      {
        role: "user",
        content:
          config.prompt ||
          "Read sum.js and sum.test.js, then fix the bug in sum.js. Do not change the tests.",
      },
    ];
    const instructions = `${systemPrompt} Read a file before replacing it. Each write needs the user's approval; if one is denied, do not retry it.`;

    display.user(messages[0]!.content);
    // The same bounded loop as lesson 4.
    for (let step = 0; step < config.maxSteps; step++) {
      signal.throwIfAborted();
      display.request(step + 1, config.maxSteps, messages);
      const reply = await connector.complete({
        systemPrompt: instructions,
        messages,
        tools,
        signal,
      });
      display.reply(reply);
      if (reply.stopReason === "incomplete")
        throw new Error("The model response was incomplete.");
      messages.push(reply.message);
      if (!reply.message.toolCalls.length) {
        if (reply.stopReason !== "complete" || !reply.message.content.trim())
          throw new Error("The model returned no answer or tool calls.");
        display.finish(messages, tools.length);
        return;
      }
      for (const call of reply.message.toolCalls) {
        signal.throwIfAborted();
        display.tool(call);
        const started = performance.now();
        // Compare with lesson 4, where approve always answered no. Now it asks
        // you. executeTool shows the complete new file before it asks, and
        // writes nothing unless you type y.
        const result = await executeTool(
          call,
          { cwd: config.cwd, signal, approve },
          tools,
        );
        display.toolResult(result, call, performance.now() - started);
        // A denial is a result too: the model reads it on the next request.
        messages.push(result);
      }
    }
    display.finish(messages, tools.length);
    throw new Error(
      `Stopped after ${config.maxSteps} requests; the task may be unfinished.`,
    );
  },
  { workspace: "examples/tiny-project" },
);
