import type { Config } from "../config.js";
import type { ModelConnector } from "../types.js";
import { createOpenAIConnector } from "./openai.js";
import { createAnthropicConnector } from "./anthropic.js";
import { createGeminiConnector } from "./gemini.js";
import { createCompatibleConnector } from "./compatible.js";

export function createConnector(config: Config): ModelConnector {
  switch (config.provider) {
    case "openai":
      return createOpenAIConnector(config.apiKey, config.model);
    case "anthropic":
      return createAnthropicConnector(config.apiKey, config.model);
    case "gemini":
      return createGeminiConnector(config.apiKey, config.model);
    case "compatible":
      return createCompatibleConnector(
        config.baseUrl,
        config.apiKey,
        config.model,
      );
  }
}
