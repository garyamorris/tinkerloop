import assert from "node:assert/strict";
import test from "node:test";
import { countWords } from "./count.js";
import { words } from "./words.js";

test("splits on any run of whitespace", () =>
  assert.deepEqual(words("one  two\nthree"), ["one", "two", "three"]));
test("empty text has no words", () => assert.deepEqual(words(""), []));
test("counts ignore letter case", () =>
  assert.deepEqual(countWords("The cat saw the dog"), {
    the: 2,
    cat: 1,
    saw: 1,
    dog: 1,
  }));
test("empty text has no counts", () => assert.deepEqual(countWords(""), {}));
