import { fetchSpotCandlesWithFallback } from "./market-data.js";
import { saveCandles } from "./storage.js";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINMARKETCAP_API = "https://pro-api.coinmarketcap.com/v3";
const COINMARKETCAP_LEGACY_API = "https://pro-api.coinmarketcap.com/v2";
const COINMARKETCAP_MAP_API = "https://pro-api.coinmarketcap.com/v1";
const fundamentalsCache = new Map();
const FUNDAMENTALS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
};

const scoreFundamentals = ({ rank, marketCapChange30d, volumeToCap, developerActivity = false }) => {
  let score = 5;
  if (rank && rank <= 100) score += 1.5;
  if (rank && rank <= 25) score += 0.5;
  if (marketCapChange30d !== null) score += Math.max(-1.5, Math.min(1.5, marketCapChange30d / 10));
  if (volumeToCap !== null && volumeToCap >= 0.03) score += 0.5;
  if (developerActivity) score += 0.5;
  return Number(Math.max(0, Math.min(10, score)).toFixed(1));
};

const parseQuote = (data, symbol) => {
  if (Array.isArray(data)) return data.find((item) => item.symbol?.toUpperCase() === symbol);
  const value = data?.[symbol] ?? Object.values(data ?? {})[0];
  return Array.isArray(value) ? value[0] : value;
};

const fetchCoinMarketCapFundamentals = async (baseAsset) => {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) throw new Error("COINMARKETCAP_API_KEY не задан");
  const options = {
    headers: { "X-CMC_PRO_API_KEY": apiKey },
  };
  const mapPayload = await fetchJson(`${COINMARKETCAP_MAP_API}/cryptocurrency/map?symbol=${encodeURIComponent(baseAsset)}&listing_status=active`, options);
  const mappedAsset = (mapPayload.data ?? []).find((item) => item.symbol?.toUpperCase() === baseAsset);
  const query = mappedAsset?.id ? `id=${mappedAsset.id}` : `symbol=${encodeURIComponent(baseAsset)}`;
  let payload = await fetchJson(`${COINMARKETCAP_API}/cryptocurrency/quotes/latest?${query}&convert=USD`, options);
  let asset = parseQuote(payload.data, baseAsset);
  if (!asset) {
    payload = await fetchJson(`${COINMARKETCAP_LEGACY_API}/cryptocurrency/quotes/latest?${query}&convert=USD`, options);
    asset = parseQuote(payload.data, baseAsset);
  }
  const quote = asset?.quote?.USD ?? asset?.quotes?.find((item) => item.quote?.USD)?.quote?.USD;
  if (!asset || !quote) throw new Error("CoinMarketCap не вернул данные монеты");
  const marketCap = quote.market_cap ?? null;
  const volume = quote.volume_24h ?? null;
  const volumeToCap = marketCap && volume ? volume / marketCap : null;
  const marketCapChange30d = quote.percent_change_30d ?? null;
  return {
    available: true,
    source: "coinmarketcap",
    name: asset.name,
    score: scoreFundamentals({ rank: asset.cmc_rank, marketCapChange30d, volumeToCap }),
    marketCapRank: asset.cmc_rank ?? null,
    marketCapUsd: marketCap,
    marketCapChange30d: marketCapChange30d === null ? null : Number(marketCapChange30d.toFixed(1)),
    volumeToCap: volumeToCap === null ? null : Number(volumeToCap.toFixed(3)),
  };
};

const fetchCoinGeckoFundamentals = async (baseAsset) => {
  try {
    const search = await fetchJson(`${COINGECKO_API}/search?query=${encodeURIComponent(baseAsset)}`);
    const coin = (search.coins ?? []).find((item) => item.symbol?.toUpperCase() === baseAsset);
    if (!coin) return { available: false, source: "coingecko", reason: "Монета не найдена в источнике фундаментальных данных" };

    const details = await fetchJson(`${COINGECKO_API}/coins/${encodeURIComponent(coin.id)}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`);
    const marketData = details.market_data ?? {};
    const marketCap = marketData.market_cap?.usd ?? null;
    const volume = marketData.total_volume?.usd ?? null;
    const rank = marketData.market_cap_rank ?? null;
    const marketCapChange30d = marketData.market_cap_change_percentage_30d ?? null;
    const volumeToCap = marketCap && volume ? volume / marketCap : null;

    return {
      available: true,
      source: "coingecko",
      name: details.name ?? coin.name,
      score: scoreFundamentals({ rank, marketCapChange30d, volumeToCap, developerActivity: (details.developer_data?.commit_count_4_weeks ?? 0) > 0 }),
      marketCapRank: rank,
      marketCapUsd: marketCap,
      marketCapChange30d: marketCapChange30d === null ? null : Number(marketCapChange30d.toFixed(1)),
      volumeToCap: volumeToCap === null ? null : Number(volumeToCap.toFixed(3)),
    };
  } catch (error) {
    return { available: false, source: "coingecko", reason: error.message };
  }
};

const fetchFundamentals = async (baseAsset) => {
  const cached = fundamentalsCache.get(baseAsset);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const errors = [];
  for (const provider of [fetchCoinMarketCapFundamentals, fetchCoinGeckoFundamentals]) {
    try {
      const value = await provider(baseAsset);
      if (value.available) {
        fundamentalsCache.set(baseAsset, { value, expiresAt: Date.now() + FUNDAMENTALS_CACHE_TTL_MS });
        return value;
      }
      errors.push(`${value.source ?? "Источник"}: ${value.reason}`);
    } catch (error) {
      errors.push(`${provider === fetchCoinMarketCapFundamentals ? "CoinMarketCap" : "CoinGecko"}: ${error.message}`);
    }
  }
  const value = { available: false, source: null, reason: errors.join("; ") || "Нет доступных фундаментальных источников" };
  fundamentalsCache.set(baseAsset, { value, expiresAt: Date.now() + 15 * 60 * 1000 });
  return value;
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
  const marketData = await fetchSpotCandlesWithFallback({ symbol: normalized, interval: "1D", limit: 200 });
  const { candles } = marketData;
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
    exchange: marketData.source,
    technicalSource: marketData.source,
    technicalFallbackUsed: marketData.fallbackUsed,
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
    `Технические данные: ${analysis.technicalSource}${analysis.technicalFallbackUsed ? " (резерв)" : ""}`,
    fundamental,
    `Технические изменения: 7д ${change(analysis.technical.return7d)}, 30д ${change(analysis.technical.return30d)}, 60д ${change(analysis.technical.return60d)}`,
    `RSI: ${analysis.technical.rsi14 === null ? "нет данных" : analysis.technical.rsi14.toFixed(1)}`,
    `Риск: ${analysis.risk}`,
    `Цена: ${analysis.currentPrice}`,
    "",
    "Прогноз экспериментальный и не является гарантией доходности.",
  ].join("\n");
};
