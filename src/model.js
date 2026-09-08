const FEATURE_COUNT = 4;
const HORIZON = 3;
const MIN_TRAINING_CANDLES = 50;

const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(Math.min(value, 30), -30)));
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const getFeatures = (closes, index) => {
  const current = closes[index];
  const return1 = current / closes[index - 1] - 1;
  const return3 = current / closes[index - 3] - 1;
  const shortAverage = average(closes.slice(index - 6, index + 1));
  const longAverage = average(closes.slice(index - 20, index + 1));
  const volatility = average(closes.slice(index - 4, index + 1).map((price, offset, values) => offset === 0 ? 0 : Math.abs(price / values[offset - 1] - 1)));
  return [return1, return3, shortAverage / longAverage - 1, volatility];
};

const trainBinary = (examples, labels) => {
  const weights = Array(FEATURE_COUNT + 1).fill(0);
  const learningRate = 0.3;
  for (let epoch = 0; epoch < 300; epoch += 1) {
    for (let index = 0; index < examples.length; index += 1) {
      const features = [1, ...examples[index]];
      const prediction = sigmoid(weights.reduce((sum, weight, featureIndex) => sum + weight * features[featureIndex], 0));
      const error = labels[index] - prediction;
      for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
        weights[featureIndex] += learningRate * error * features[featureIndex];
      }
    }
  }
  return weights;
};

export const trainModel = ({ candles, symbol, interval, threshold = 0.01 }) => {
  const closes = candles.map((candle) => candle.close);
  if (closes.length < MIN_TRAINING_CANDLES) {
    throw new Error(`At least ${MIN_TRAINING_CANDLES} candles are required to train ${symbol}`);
  }

  const examples = [];
  const growthLabels = [];
  const declineLabels = [];
  for (let index = 20; index < closes.length - HORIZON; index += 1) {
    const futureReturn = closes[index + HORIZON] / closes[index] - 1;
    examples.push(getFeatures(closes, index));
    growthLabels.push(futureReturn >= threshold ? 1 : 0);
    declineLabels.push(futureReturn <= -threshold ? 1 : 0);
  }

  return {
    symbol,
    interval,
    threshold,
    growthWeights: trainBinary(examples, growthLabels),
    declineWeights: trainBinary(examples, declineLabels),
    trainedAt: new Date().toISOString(),
    sampleCount: examples.length,
  };
};

export const predictModel = ({ model, candles }) => {
  const closes = candles.map((candle) => candle.close);
  if (closes.length < 21) {
    throw new Error("At least 21 candles are required for prediction");
  }
  const features = [1, ...getFeatures(closes, closes.length - 1)];
  const growth = sigmoid(model.growthWeights.reduce((sum, weight, index) => sum + weight * features[index], 0));
  const decline = sigmoid(model.declineWeights.reduce((sum, weight, index) => sum + weight * features[index], 0));
  const total = growth + decline;
  const probabilities = total > 1 ? { growth: growth / total, decline: decline / total, sideways: 0 } : { growth, decline, sideways: 1 - total };
  const signal = probabilities.growth >= 0.55 ? "BUY" : probabilities.decline >= 0.55 ? "SELL" : "HOLD";
  return { symbol: model.symbol, horizon: model.interval, signal, currentPrice: closes.at(-1), probabilities, status: "trained-experimental" };
};
