import { words } from "./words.js";

// Counts how often each word appears.
export function countWords(text) {
  const counts = {};
  for (const word of words(text)) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}
