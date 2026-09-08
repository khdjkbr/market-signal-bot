import { fetchExchangeCandles } from "./market-data.js";
import { saveCandles } from "./storage.js";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const percentageReturn = (values, periods) => {
  if (values.length <= periods) return null;
  return values.at(-1) / values.at(-1 - periods) - 1;
};

const calculateRsi = (closes, periods = 14) => {
  if (closes.length <= periods) return null;
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const recent = changes.slice(-periods);
  const gains = average(recent.map((change) => Math.max(change, 0)));
  const losses = average(recent.map((change) => Math.max(-change, 0)));
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
};

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const fetchFundamentals = async (baseAsset) => {
  try {
    const search = await fetchJson(`${COINGECKO_API}/search?query=${encodeURIComponent(baseAsset)}`);
    const coin = (search.coins ?? []).find((item) => item.symbol?.toUpperCase() === baseAsset);
    if (!coin) return { available: false, reason: "Монета не найдена в источнике фундаментальных данных" };

    const details = await fetchJson(`${COINGECKO_API}/coins/${encodeURIComponent(coin.id)}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`);
    const marketData = details.market_data ?? {};
    const marketCap = marketData.market_cap?.usd ?? null;
    const volume = marketData.total_volume?.usd ?? null;
    const rank = marketData.market_cap_rank ?? null;
    const marketCapChange30d = marketData.market_cap_change_percentage_30d ?? null;
    const volumeToCap = marketCap && volume ? volume / marketCap : null;

    let score = 5;
    if (rank && rank <= 100) score += 1.5;
    if (rank && rank <= 25) score += 0.5;
    if (marketCapChange30d !== null) score += Math.max(-1.5, Math.min(1.5, marketCapChange30d / 10));
    if (volumeToCap !== null && volumeToCap >= 0.03) score += 0.5;
    if ((details.developer_data?.commit_count_4_weeks ?? 0) > 0) score += 0.5;
    score = Math.max(0, Math.min(10, score));

    return {
      available: true,
      name: details.name ?? coin.name,
      score: Number(score.toFixed(1)),
      marketCapRank: rank,
      marketCapUsd: marketCap,
      marketCapChange30d: marketCapChange30d === null ? null : Number(marketCapChange30d.toFixed(1)),
      volumeToCap: volumeToCap === null ? null : Number(volumeToCap.toFixed(3)),
    };
  } catch (error) {
    return { available: false, reason: `Источник фундаментальных данных недоступен: ${error.message}` };
  }
};

const buildProbabilities = ({ return30d, sma20, sma50, rsi, fundamentalScore }) => {
  let score = 0.5;
  if (return30d !== null) score += Math.max(-0.18, Math.min(0.18, return30d));
  if (sma20 > sma50) score += 0.08;
  else score -= 0.08;
  if (rsi !== null) {
    if (rsi >= 50 && rsi <= 68) score += 0.06;
    if (rsi < 35) score += 0.03;
    if (rsi > 75) score -= 0.06;
  }
  if (fundamentalScore !== null) score += (fundamentalScore - 5) * 0.025;
  const growth = Math.max(0.08, Math.min(0.82, score));
  const decline = Math.max(0.08, Math.min(0.82, 1 - score));
  const sideways = Math.max(0.04, 1 - growth - decline);
  const total = growth + decline + sideways;
  return { growth: growth / total, decline: decline / total, sideways: sideways / total };
};

export const normalizeSpotPair = (input) => {
  const compact = String(input ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^([A-Z0-9]{2,15})(?:[\/-]?)(USDT|USDC|BTC|ETH)$/);
  return match ? `${match[1]}/${match[2]}` : null;
};

export const analyzeSpotPair = async ({ symbol, exchange = "bitget" }) => {
  const normalized = normalizeSpotPair(symbol);
  if (!normalized) throw new Error("Укажите пару в формате SOL/USDT");
  const candles = await fetchExchangeCandles({ exchange, symbol: normalized, interval: "1D", market: "spot", limit: 200 });
  if (candles.length < 60) throw new Error(`Для ${normalized} пока недостаточно дневных свечей`);
  await saveCandles(candles);

  const closes = candles.map((candle) => candle.close);
  const sma20 = average(closes.slice(-20));
  const sma50 = average(closes.slice(-50));
  const rsi14 = calculateRsi(closes);
  const return7d = percentageReturn(closes, 7);
  const return30d = percentageReturn(closes, 30);
  const return60d = percentageReturn(closes, 60);
  const fundamentals = await fetchFundamentals(normalized.split("/")[0]);
  const probabilities = buildProbabilities({ return30d, sma20, sma50, rsi: rsi14, fundamentalScore: fundamentals.score ?? null });
  const signal = probabilities.growth >= 0.6 ? "BUY" : probabilities.decline >= 0.6 ? "SELL" : "WAIT";
  const risk = rsi14 !== null && (rsi14 > 75 || rsi14 < 25) ? "высокий" : "умеренный";

  return {
    market: "spot",
    exchange,
    symbol: normalized,
    horizon: "30D",
    signal,
    currentPrice: closes.at(-1),
    probabilities,
    technical: {
      return7d,
      return30d,
      return60d,
      rsi14,
      sma20,
      sma50,
    },
    fundamental: fundamentals,
    risk,
    dataQuality: fundamentals.available ? "market + fundamentals" : "market only",
    generatedAt: new Date().toISOString(),
  };
};

export const formatSpotAnalysis = (analysis) => {
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  const change = (value) => value === null ? "нет данных" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  const fundamental = analysis.fundamental.available
    ? `Фундаментальная оценка: ${analysis.fundamental.score}/10${analysis.fundamental.marketCapRank ? `, ранг капитализации: ${analysis.fundamental.marketCapRank}` : ""}`
    : `Фундаментальный анализ: недостаточно данных\nПричина: ${analysis.fundamental.reason}`;

  return [
    `SPOT — ${analysis.symbol}`,
    "",
    `Рекомендация: ${analysis.signal}`,
    `Вероятность роста за 30 дней: ${percent(analysis.probabilities.growth)}`,
    `Вероятность снижения: ${percent(analysis.probabilities.decline)}`,
    `Боковое движение: ${percent(analysis.probabilities.sideways)}`,
    "",
    fundamental,
    `Технические изменения: 7д ${change(analysis.technical.return7d)}, 30д ${change(analysis.technical.return30d)}, 60д ${change(analysis.technical.return60d)}`,
    `RSI: ${analysis.technical.rsi14 === null ? "нет данных" : analysis.technical.rsi14.toFixed(1)}`,
    `Риск: ${analysis.risk}`,
    `Цена: ${analysis.currentPrice}`,
    "",
    "Прогноз экспериментальный и не является гарантией доходности.",
  ].join("\n");
};
