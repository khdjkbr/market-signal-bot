import test from "node:test";
import assert from "node:assert/strict";
import { runBacktest } from "../src/backtest.js";

test("runs a backtest and returns a summary", () => {
  const candles = Array.from({ length: 30 }, (_, index) => ({
    symbol: "BTC/USDT",
    interval: "1H",
    timestamp: index,
    close: 100 + index,
  }));
  const result = runBacktest({ candles });

  assert.equal(result.summary.tradeCount, result.trades.length);
  assert.ok(result.summary.winRate >= 0 && result.summary.winRate <= 1);
});
