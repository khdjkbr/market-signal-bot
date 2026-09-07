import test from "node:test";
import assert from "node:assert/strict";
import { closePosition, createPortfolio, openPosition } from "../src/paper-portfolio.js";

test("opens and closes a profitable long paper position", () => {
  const portfolio = createPortfolio(1000);
  openPosition(portfolio, { symbol: "BTC/USDT", side: "long", price: 100, quantity: 1 });
  closePosition(portfolio, { symbol: "BTC/USDT", price: 110 });

  assert.equal(Object.keys(portfolio.positions).length, 0);
  assert.ok(portfolio.balance > 1000);
  assert.equal(portfolio.trades.length, 2);
});

test("calculates profit for a short paper position", () => {
  const portfolio = createPortfolio(1000);
  openPosition(portfolio, { symbol: "ETH/USDT", side: "short", price: 100, quantity: 1 });
  closePosition(portfolio, { symbol: "ETH/USDT", price: 90 });

  assert.ok(portfolio.balance > 1000);
});
