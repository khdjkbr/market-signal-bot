import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpotPair } from "../src/spot-analysis.js";

test("normalizes common spot pair formats", () => {
  assert.equal(normalizeSpotPair("SOL/USDT"), "SOL/USDT");
  assert.equal(normalizeSpotPair("solusdt"), "SOL/USDT");
  assert.equal(normalizeSpotPair("BTC USDT"), "BTC/USDT");
});

test("rejects unsupported or malformed pair input", () => {
  assert.equal(normalizeSpotPair("not a pair"), null);
  assert.equal(normalizeSpotPair("SOL/RUB"), null);
});
