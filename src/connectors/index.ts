import type { Config } from "../config.js";
import type { ModelConnector } from "../types.js";
import { createOpenAIConnector } from "./openai.js";
import { createAnthropicConnector } from "./anthropic.js";
import { createGeminiConnector } from "./gemini.js";
import { createCompatibleConnector } from "./compatible.js";
import { createHumanConnector, type HumanConsole } from "./human.js";
import { traceFetch } from "./trace.js";

export function createConnector(
  config: Config,
  human?: HumanConsole,
): ModelConnector {
  const fetchImpl = config.trace ? traceFetch(config.trace) : undefined;
  switch (config.provider) {
    case "human":
      if (!human)
        throw new Error(
          "--provider human needs an interactive terminal: you type the model's replies.",
        );
      return createHumanConnector(human);
    case "openai":
      return createOpenAIConnector(config.apiKey, config.model, fetchImpl);
    case "anthropic":
      return createAnthropicConnector(config.apiKey, config.model, fetchImpl);
    case "gemini":
      return createGeminiConnector(config.apiKey, config.model, fetchImpl);
    case "compatible":
      return createCompatibleConnector(
        config.baseUrl,
        config.apiKey,
        config.model,
        fetchImpl,
      );
  }
}
