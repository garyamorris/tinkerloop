import type { Config } from "../config.js";
import type { ModelConnector } from "../types.js";
import { createOpenAIConnector } from "./openai.js";
import { createAnthropicConnector } from "./anthropic.js";
import { createGeminiConnector } from "./gemini.js";
import { createCompatibleConnector } from "./compatible.js";
import { traceFetch } from "./trace.js";

export function createConnector(config: Config): ModelConnector {
  const fetchImpl = config.trace ? traceFetch(config.trace) : undefined;
  switch (config.provider) {
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
