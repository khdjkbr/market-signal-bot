import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBitgetCandles, normalizeMexcCandles } from "../src/exchanges.js";

test("normalizes Bitget candles into a common format", () => {
  const result = normalizeBitgetCandles([["2000", "10", "12", "9", "11", "100", "1100"]], "BTCUSDT", "1H");

  assert.deepEqual(result[0], {
    exchange: "bitget",
    symbol: "BTCUSDT",
    interval: "1H",
    timestamp: 2000,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 100,
    turnover: 1100,
  });
});

test("normalizes MEXC candle payloads", () => {
  const result = normalizeMexcCandles({
    data: {
      time: [2, 1],
      open: [20, 10],
      high: [22, 12],
      low: [19, 9],
      close: [21, 11],
      vol: [200, 100],
      amount: [4200, 1100],
    },
  }, "BTC_USDT", "Min60");

  assert.equal(result[0].timestamp, 2000);
  assert.equal(result[1].turnover, 1100);
});
