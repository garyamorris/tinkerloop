import assert from "node:assert/strict";
import test from "node:test";
import { sum } from "./sum.js";

test("adds all numbers", () => assert.equal(sum([2, 3, 4]), 9));
test("adds a single number", () => assert.equal(sum([7]), 7));
test("handles an empty list", () => assert.equal(sum([]), 0));
