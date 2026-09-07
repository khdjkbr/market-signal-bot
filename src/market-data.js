import { exchangeConfig, normalizeBitgetCandles, normalizeMexcCandles } from "./exchanges.js";

const DEFAULT_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 10_000;

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Market data request failed with HTTP ${response.status}`);
  }

  return response.json();
};

const normalizeBitgetSymbol = (symbol) => symbol.replace("/", "").toUpperCase();
const normalizeMexcSymbol = (symbol) => symbol.replace("/", "_").toUpperCase();

export const fetchBitgetCandles = async ({ symbol, interval, market = "futures", limit = DEFAULT_LIMIT }) => {
  const category = market === "spot" ? "SPOT" : "USDT-FUTURES";
  const url = new URL(market === "spot" ? exchangeConfig.bitget.spotCandles : exchangeConfig.bitget.futuresCandles);
  url.searchParams.set("category", category);
  url.searchParams.set("symbol", normalizeBitgetSymbol(symbol));
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const payload = await fetchJson(url);
  if (payload.code !== "00000") {
    throw new Error(`Bitget returned an error: ${payload.msg ?? payload.code}`);
  }

  return normalizeBitgetCandles(payload.data ?? [], symbol, interval);
};

export const fetchMexcFuturesCandles = async ({ symbol, interval, limit = DEFAULT_LIMIT }) => {
  const url = new URL(`${exchangeConfig.mexc.futuresCandles}/${normalizeMexcSymbol(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const payload = await fetchJson(url);
  if (payload.success !== true) {
    throw new Error(`MEXC returned an error: ${payload.code ?? "unknown"}`);
  }

  return normalizeMexcCandles(payload, symbol, interval).slice(-limit);
};

export const fetchExchangeCandles = async ({ exchange, symbol, interval, market, limit }) => {
  if (exchange === "bitget") {
    return fetchBitgetCandles({ symbol, interval, market, limit });
  }

  if (exchange === "mexc" && market === "futures") {
    return fetchMexcFuturesCandles({ symbol, interval, limit });
  }

  throw new Error(`Unsupported market combination: ${exchange}/${market}`);
};
