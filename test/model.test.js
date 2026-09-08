import test from "node:test";
import assert from "node:assert/strict";
import { predictModel, trainModel } from "../src/model.js";

test("trains and predicts a probability signal", () => {
  const candles = Array.from({ length: 80 }, (_, index) => ({
    close: 100 + index * 0.5 + Math.sin(index) * 0.2,
  }));
  const model = trainModel({ candles, symbol: "BTC/USDT", interval: "1H" });
  const signal = predictModel({ model, candles });
  const probabilitySum = Object.values(signal.probabilities).reduce((sum, value) => sum + value, 0);

  assert.equal(model.sampleCount, 57);
  assert.ok(Math.abs(probabilitySum - 1) < 0.001);
  assert.ok(["BUY", "SELL", "HOLD"].includes(signal.signal));
});
