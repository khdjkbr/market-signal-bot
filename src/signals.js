import { rsi, sma } from "./indicators.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const createSignal = ({ symbol, prices, horizon }) => {
  const currentPrice = prices.at(-1);
  const shortSma = sma(prices, 7);
  const longSma = sma(prices, 21);
  const currentRsi = rsi(prices);

  if (shortSma === null || longSma === null || currentRsi === null) {
    throw new Error(`Not enough price data for ${symbol}`);
  }

  const trendScore = shortSma > longSma ? 1 : -1;
  const momentumScore = currentRsi < 35 ? 1 : currentRsi > 65 ? -1 : 0;
  const score = trendScore + momentumScore;
  const signal = score > 0 ? "BUY" : score < 0 ? "SELL" : "HOLD";
  const confidence = clamp(0.5 + Math.abs(score) * 0.1 + Math.abs(currentRsi - 50) / 500, 0.5, 0.8);
  const neutralProbability = (1 - confidence) / 2;
  const growthProbability = signal === "BUY" ? confidence : signal === "SELL" ? neutralProbability : 0.25;
  const declineProbability = signal === "SELL" ? confidence : signal === "BUY" ? neutralProbability : 0.25;
  const sidewaysProbability = signal === "HOLD" ? 0.5 : neutralProbability;

  return {
    symbol,
    horizon,
    signal,
    currentPrice,
    indicators: {
      sma7: Number(shortSma.toFixed(4)),
      sma21: Number(longSma.toFixed(4)),
      rsi14: Number(currentRsi.toFixed(2)),
    },
    probabilities: {
      growth: Number(growthProbability.toFixed(4)),
      decline: Number(declineProbability.toFixed(4)),
      sideways: Number(Math.max(sidewaysProbability, 0).toFixed(4)),
    },
    status: "experimental",
  };
};
