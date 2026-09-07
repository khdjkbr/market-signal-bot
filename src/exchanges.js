const toCandle = ([timestamp, open, high, low, close, volume, turnover], exchange, symbol, interval) => ({
  exchange,
  symbol,
  interval,
  timestamp: Number(timestamp),
  open: Number(open),
  high: Number(high),
  low: Number(low),
  close: Number(close),
  volume: Number(volume),
  turnover: Number(turnover ?? 0),
});

export const normalizeBitgetCandles = (rows, symbol, interval, exchange = "bitget") => rows
  .map((row) => toCandle(row, exchange, symbol, interval))
  .sort((first, second) => first.timestamp - second.timestamp);

export const normalizeMexcCandles = (payload, symbol, interval, exchange = "mexc") => {
  const data = payload?.data;
  if (!data?.time || !data.open || !data.high || !data.low || !data.close || !data.vol) {
    throw new Error("MEXC returned an invalid candle payload");
  }

  return data.time.map((timestamp, index) => toCandle([
    timestamp * 1000,
    data.open[index],
    data.high[index],
    data.low[index],
    data.close[index],
    data.vol[index],
    data.amount?.[index],
  ], exchange, symbol, interval));
};

export const exchangeConfig = {
  bitget: {
    name: "Bitget",
    spotCandles: "https://api.bitget.com/api/v3/market/candles",
    futuresCandles: "https://api.bitget.com/api/v3/market/candles",
  },
  mexc: {
    name: "MEXC",
    futuresCandles: "https://contract.mexc.com/api/v1/contract/kline",
  },
};
