import { fetchExchangeCandles } from "./market-data.js";
import { trainModel, predictModel } from "./model.js";
import { formatSignalMessage, sendTelegramMessage } from "./notifications.js";
import { saveCandles, saveModel } from "./storage.js";

const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XAUT/USDT"];
const interval = "1H";
const exchange = "bitget";
const market = "futures";

export const syncAndTrain = async () => {
  const results = [];
  for (const symbol of symbols) {
    const candles = await fetchExchangeCandles({ exchange, symbol, interval, market, limit: 200 });
    await saveCandles(candles);
    const model = trainModel({ candles, symbol, interval });
    await saveModel(model);
    const signal = predictModel({ model, candles });
    results.push(signal);
    const strongestProbability = Math.max(signal.probabilities.growth, signal.probabilities.decline);
    if (signal.signal !== "HOLD" && strongestProbability >= 0.6) {
      await sendTelegramMessage(formatSignalMessage({ market, symbol, ...signal }));
    }
  }
  return results;
};

export const startScheduler = () => {
  if (process.env.SCHEDULER_ENABLED !== "true") {
    return null;
  }
  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 900_000);
  syncAndTrain().catch((error) => console.error(`Scheduler sync failed: ${error.message}`));
  return setInterval(() => syncAndTrain().catch((error) => console.error(`Scheduler sync failed: ${error.message}`)), intervalMs);
};
