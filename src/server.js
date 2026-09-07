import { createServer } from "node:http";
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

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Market signal bot is running on http://localhost:${port}`);
});
