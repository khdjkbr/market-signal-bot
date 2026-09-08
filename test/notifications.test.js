import assert from "node:assert/strict";
import test from "node:test";
import { formatSignalMessage } from "../src/notifications.js";

test("marks futures Telegram signals", () => {
  const message = formatSignalMessage({
    market: "futures",
    symbol: "BTC/USDT",
    signal: "BUY",
    probabilities: { growth: 0.7, decline: 0.2 },
  });

  assert.match(message, /^FUTURES\n/);
});

test("marks spot Telegram signals", () => {
  const message = formatSignalMessage({
    market: "spot",
    symbol: "ETH/USDT",
    signal: "SELL",
    probabilities: { growth: 0.2, decline: 0.7 },
  });

  assert.match(message, /^SPOT\n/);
});
