const symbols = {
  "BTC/USDT": 64000,
  "ETH/USDT": 3200,
  "SOL/USDT": 145,
  "XAUT/USDT": 2350,
};

const createPrices = (basePrice) => Array.from({ length: 30 }, (_, index) => {
  const trend = index * basePrice * 0.001;
  const wave = Math.sin(index / 2) * basePrice * 0.004;
  return Number((basePrice + trend + wave).toFixed(4));
});

export const getSampleMarketData = () => Object.entries(symbols).map(([symbol, basePrice]) => ({
  symbol,
  prices: createPrices(basePrice),
}));
