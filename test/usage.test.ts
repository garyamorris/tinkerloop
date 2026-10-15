import assert from "node:assert/strict";
import test from "node:test";
import { readUsage, summarizeUsage } from "../src/usage.js";

test("OpenAI and compatible cache reads are already part of input", () => {
  const openai = readUsage("openai", {
    input_tokens: 1000,
    output_tokens: 70,
    input_tokens_details: { cached_tokens: 800, cache_write_tokens: 20 },
    output_tokens_details: { reasoning_tokens: 30 },
  });
  assert.equal(openai?.inputTokens, 1000);
  assert.equal(openai?.cacheReadTokens, 800);
  assert.equal(openai?.cacheWriteTokens, 20);
  assert.equal(openai?.outputTokens, 70);
  assert.equal(openai?.reasoningTokens, 30);
  const compatible = readUsage("compatible", {
    prompt_tokens: 1000,
    completion_tokens: 70,
    prompt_tokens_details: { cached_tokens: 800 },
  });
  assert.equal(compatible?.inputTokens, 1000);
  assert.equal(compatible?.cacheReadTokens, 800);
  assert.equal(compatible?.cacheWriteTokens, undefined);
});

test("Anthropic total input includes uncached, cache-read, and cache-write tokens", () => {
  const usage = readUsage("anthropic", {
    input_tokens: 50,
    output_tokens: 100,
    cache_read_input_tokens: 1000,
    cache_creation_input_tokens: 200,
  });
  assert.equal(usage?.inputTokens, 1250);
  assert.equal(usage?.cacheReadTokens, 1000);
  assert.equal(usage?.cacheWriteTokens, 200);
  assert.equal(usage?.outputTokens, 100);
});

test("Gemini generated output includes separately reported thought tokens", () => {
  const usage = readUsage("gemini", {
    total_input_tokens: 100,
    total_output_tokens: 20,
    total_thought_tokens: 22,
    total_cached_tokens: 50,
  });
  assert.equal(usage?.inputTokens, 100);
  assert.equal(usage?.outputTokens, 42);
  assert.equal(usage?.reasoningTokens, 22);
  assert.equal(usage?.cacheReadTokens, 50);
});

test("absent or invalid counts stay unknown while zero remains a reported value", () => {
  for (const value of [
    undefined,
    null,
    [],
    {},
    { input_tokens: -1, output_tokens: "12" },
    { input_tokens: NaN, output_tokens: Infinity },
    { input_tokens: 1.5 },
  ]) {
    assert.equal(readUsage("openai", value), undefined);
  }
  assert.equal(readUsage("openai", { input_tokens: 0 })?.inputTokens, 0);
  assert.equal(
    readUsage("anthropic", { cache_read_input_tokens: 50 })?.inputTokens,
    undefined,
  );
  assert.equal(
    readUsage("gemini", { total_thought_tokens: 5 })?.outputTokens,
    undefined,
  );
});

test("session totals sum requests and track partial reporting without inventing zeroes", () => {
  const result = summarizeUsage([
    { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0 },
    undefined,
    { inputTokens: 300, outputTokens: 20 },
  ]);
  assert.equal(result.totals.cacheWriteTokens, undefined);
  assert.deepEqual(result.totals, {
    inputTokens: 400,
    outputTokens: 30,
    cacheReadTokens: 0,
  });
  assert.deepEqual(result.reports, {
    inputTokens: 2,
    outputTokens: 2,
    cacheReadTokens: 1,
  });
});
