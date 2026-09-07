import test from "node:test";
import assert from "node:assert/strict";
import { createSignal } from "../src/signals.js";

test("creates a signal with probabilities that sum to one", () => {
  const prices = Array.from({ length: 30 }, (_, index) => 100 + index);
  const result = createSignal({ symbol: "BTC/USDT", prices, horizon: "24h" });
  const probabilitySum = Object.values(result.probabilities).reduce((sum, value) => sum + value, 0);

  assert.ok(["BUY", "SELL", "HOLD"].includes(result.signal));
  assert.ok(Math.abs(probabilitySum - 1) < 0.001);
});

test("rejects an incomplete price series", () => {
  assert.throws(
    () => createSignal({ symbol: "BTC/USDT", prices: [100, 101], horizon: "24h" }),
    /Not enough price data/
  );
});
