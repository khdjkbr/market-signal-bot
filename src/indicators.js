const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export const sma = (prices, period) => {
  if (prices.length < period) {
    return null;
  }

  return average(prices.slice(-period));
};

export const rsi = (prices, period = 14) => {
  if (prices.length <= period) {
    return null;
  }

  const changes = prices.slice(1).map((price, index) => price - prices[index]);
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter((change) => change > 0);
  const losses = recentChanges.filter((change) => change < 0).map((change) => Math.abs(change));
  const averageGain = average(gains.length > 0 ? gains : [0]);
  const averageLoss = average(losses.length > 0 ? losses : [0]);

  if (averageLoss === 0) {
    return 100;
  }

  return 100 - 100 / (1 + averageGain / averageLoss);
};
