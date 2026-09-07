import { createServer } from "node:http";
import { fetchExchangeCandles } from "./market-data.js";
import { createSignal } from "./signals.js";
import { getSampleMarketData } from "./sample-data.js";

const port = Number(process.env.PORT ?? 3000);

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
};

const server = createServer((request, response) => {
  if (request.url === "/api/health") {
    sendJson(response, 200, { status: "ok", mode: "demo" });
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

  if (request.url?.startsWith("/api/candles")) {
    const url = new URL(request.url, "http://localhost");
    const exchange = url.searchParams.get("exchange") ?? "bitget";
    const symbol = url.searchParams.get("symbol") ?? "BTC/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";
    const market = url.searchParams.get("market") ?? "futures";
    const limit = Number(url.searchParams.get("limit") ?? 100);

    fetchExchangeCandles({ exchange, symbol, interval, market, limit })
      .then((candles) => sendJson(response, 200, { source: exchange, market, candles }))
      .catch((error) => sendJson(response, 502, { error: error.message }));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Market signal bot is running on http://localhost:${port}`);
});
