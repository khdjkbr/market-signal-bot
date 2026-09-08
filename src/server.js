import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { getPool } from "./database.js";
import { trainModel, predictModel } from "./model.js";
import { startScheduler } from "./scheduler.js";
import { fetchExchangeCandles } from "./market-data.js";
import { runBacktest } from "./backtest.js";
import { closePosition, createPortfolio, openPosition } from "./paper-portfolio.js";
import { createSignal } from "./signals.js";
import { getSampleMarketData } from "./sample-data.js";
import { loadCandles, saveCandles } from "./storage.js";
import { loadModel, loadPortfolio, saveModel, savePortfolio } from "./storage.js";
import { analyzeSpotPair, formatSpotAnalysis } from "./spot-analysis.js";
import { handleTelegramUpdate } from "./telegram.js";

const port = Number(process.env.PORT ?? 3000);
const staticFiles = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XAUT/USDT"];

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": process.env.FRONTEND_URL ?? "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};

const serveStatic = async (request, response) => {
  const requestedPath = request.url === "/" ? "index.html" : request.url.slice(1);
  if (requestedPath.includes("..") || !staticFiles[extname(requestedPath)]) {
    return false;
  }

  try {
    const body = await readFile(`public/${requestedPath}`);
    response.writeHead(200, { "Content-Type": staticFiles[extname(requestedPath)] });
    response.end(body);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return false;
  }
};

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (request.method === "GET" && (request.url === "/" || request.url?.startsWith("/app.") || request.url?.startsWith("/styles."))) {
    serveStatic(request, response).catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }
  if (request.url === "/api/health") {
    sendJson(response, 200, { status: "ok", mode: process.env.DATABASE_URL ? "postgres" : "json", database: Boolean(getPool()) });
    return;
  }

  if (request.url === "/api/telegram/webhook" && request.method === "POST") {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const receivedSecret = request.headers["x-telegram-bot-api-secret-token"];
    if (expectedSecret && receivedSecret !== expectedSecret) {
      sendJson(response, 403, { error: "Invalid Telegram webhook secret" });
      return;
    }
    readBody(request)
      .then((update) => {
        sendJson(response, 200, { ok: true });
        return handleTelegramUpdate(update);
      })
      .catch((error) => {
        console.error(`Telegram webhook failed: ${error.message}`);
        if (!response.writableEnded) sendJson(response, 400, { error: error.message });
      });
    return;
  }

  if (request.url?.startsWith("/api/spot-analysis")) {
    const url = new URL(request.url, "http://localhost");
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    analyzeSpotPair({ symbol, exchange: "bitget" })
      .then((analysis) => sendJson(response, 200, { analysis, message: formatSpotAnalysis(analysis) }))
      .catch((error) => sendJson(response, 400, { error: error.message }));
    return;
  }

  if (request.url === "/api/signals") {
    const signals = getSampleMarketData().map((market) => createSignal({
      ...market,
      horizon: "24h",
    }));
    sendJson(response, 200, { source: "demo", signals });
    return;
  }

  if (request.url?.startsWith("/api/live-signals")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const market = url.searchParams.get("market") ?? "futures";
    const interval = url.searchParams.get("interval") ?? "1H";
    Promise.allSettled(symbols.map(async (symbol) => {
      const candles = await fetchExchangeCandles({ exchange, symbol, interval, market, limit: 100 });
      await saveCandles(candles);
      return createSignal({ symbol, prices: candles.map((candle) => candle.close), horizon: interval });
    })).then((results) => sendJson(response, 200, {
      source: exchange,
      market,
      signals: results.filter((result) => result.status === "fulfilled").map((result) => result.value),
      errors: results.filter((result) => result.status === "rejected").map((result) => result.reason.message),
    })).catch((error) => sendJson(response, 502, { error: error.message }));
    return;
  }

  if (request.url?.startsWith("/api/model/train")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    const market = url.searchParams.get("market") ?? "futures";
    fetchExchangeCandles({ exchange, symbol, interval, market, limit: 500 })
      .then(async (candles) => {
        await saveCandles(candles);
        const model = trainModel({ candles, symbol, interval });
        await saveModel(model);
        sendJson(response, 200, { model, signal: predictModel({ model, candles }) });
      })
      .catch((error) => sendJson(response, 400, { error: error.message }));
    return;
  }

  if (request.url?.startsWith("/api/model/predict")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    const market = url.searchParams.get("market") ?? "futures";
    Promise.all([
      loadModel({ symbol, interval }),
      fetchExchangeCandles({ exchange, symbol, interval, market, limit: 100 }),
    ]).then(([model, candles]) => {
      if (!model) {
        throw new Error(`No trained model for ${symbol}/${interval}`);
      }
      sendJson(response, 200, { signal: predictModel({ model, candles }) });
    }).catch((error) => sendJson(response, 400, { error: error.message }));
    return;
  }

  if (request.url?.startsWith("/api/candles")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    const market = url.searchParams.get("market") ?? "futures";
    const limit = Number(url.searchParams.get("limit") ?? 100);

    fetchExchangeCandles({ exchange, symbol, interval, market, limit })
      .then(async (candles) => {
        await saveCandles(candles);
        sendJson(response, 200, { source: exchange, market, candles });
      })
      .catch((error) => sendJson(response, 502, { error: error.message }));
    return;
  }

  if (request.url?.startsWith("/api/backtest")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    const market = url.searchParams.get("market") ?? "futures";
    const limit = Number(url.searchParams.get("limit") ?? 200);

    fetchExchangeCandles({ exchange, symbol, interval, market, limit })
      .then(async (candles) => {
        await saveCandles(candles);
        sendJson(response, 200, { source: exchange, market, result: runBacktest({ candles }) });
      })
      .catch((error) => sendJson(response, 502, { error: error.message }));
    return;
  }

  if (request.url?.startsWith("/api/stored-candles")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    loadCandles({ exchange, symbol, interval })
      .then((candles) => sendJson(response, 200, { exchange, symbol, interval, candles }))
      .catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }

  if (request.url === "/api/paper-portfolio" && request.method === "GET") {
    loadPortfolio()
      .then((portfolio) => sendJson(response, 200, portfolio ?? createPortfolio()))
      .catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }

  if (request.url === "/api/paper-trade" && request.method === "POST") {
    readBody(request)
      .then(async (trade) => {
        const portfolio = (await loadPortfolio()) ?? createPortfolio();
        const updated = trade.action === "open"
          ? openPosition(portfolio, trade)
          : trade.action === "close"
            ? closePosition(portfolio, trade)
            : (() => { throw new Error("Action must be open or close"); })();
        await savePortfolio(updated);
        sendJson(response, 200, updated);
      })
      .catch((error) => sendJson(response, 400, { error: error.message }));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Market signal bot is running on port ${port}`);
  startScheduler();
});
