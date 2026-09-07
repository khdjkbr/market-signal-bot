import { createSignal } from "./signals.js";

const WINDOW_SIZE = 21;

export const runBacktest = ({ candles, feeRate = 0.001 }) => {
  if (candles.length <= WINDOW_SIZE) {
    return { trades: [], summary: { tradeCount: 0, winRate: 0, netReturn: 0 } };
  }

  const trades = [];
  for (let index = WINDOW_SIZE; index < candles.length - 1; index += 1) {
    const currentCandle = candles[index];
    const nextCandle = candles[index + 1];
    const signal = createSignal({
      symbol: currentCandle.symbol,
      prices: candles.slice(index - WINDOW_SIZE + 1, index + 1).map((candle) => candle.close),
      horizon: currentCandle.interval,
    });

    if (signal.signal === "HOLD") {
      continue;
    }

    const grossReturn = signal.signal === "BUY"
      ? nextCandle.close / currentCandle.close - 1
      : currentCandle.close / nextCandle.close - 1;
    const netReturn = grossReturn - feeRate * 2;
    trades.push({
      timestamp: currentCandle.timestamp,
      signal: signal.signal,
      entryPrice: currentCandle.close,
      exitPrice: nextCandle.close,
      netReturn: Number(netReturn.toFixed(6)),
      profitable: netReturn > 0,
    });
  }

  const profitableTrades = trades.filter((trade) => trade.profitable).length;
  const netReturn = trades.reduce((total, trade) => total + trade.netReturn, 0);
  return {
    trades,
    summary: {
      tradeCount: trades.length,
      winRate: trades.length > 0 ? Number((profitableTrades / trades.length).toFixed(4)) : 0,
      netReturn: Number(netReturn.toFixed(6)),
    },
  };
};
