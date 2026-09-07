const DEFAULT_BALANCE = 10_000;

const round = (value) => Number(value.toFixed(6));

export const createPortfolio = (balance = DEFAULT_BALANCE) => ({
  balance,
  positions: {},
  trades: [],
});

export const openPosition = (portfolio, { symbol, side, price, quantity, feeRate = 0.001, timestamp = Date.now() }) => {
  if (!symbol || !["long", "short"].includes(side) || price <= 0 || quantity <= 0) {
    throw new Error("Invalid paper position parameters");
  }

  if (portfolio.positions[symbol]) {
    throw new Error(`A position for ${symbol} is already open`);
  }

  const notional = price * quantity;
  const fee = notional * feeRate;
  if (portfolio.balance < fee) {
    throw new Error("Insufficient paper balance for fee");
  }

  portfolio.balance = round(portfolio.balance - fee);
  portfolio.positions[symbol] = { symbol, side, entryPrice: price, quantity, fee, openedAt: timestamp };
  portfolio.trades.push({ type: "open", symbol, side, price, quantity, fee: round(fee), timestamp });
  return portfolio;
};

export const closePosition = (portfolio, { symbol, price, feeRate = 0.001, timestamp = Date.now() }) => {
  const position = portfolio.positions[symbol];
  if (!position || price <= 0) {
    throw new Error(`No open position for ${symbol}`);
  }

  const notional = price * position.quantity;
  const fee = notional * feeRate;
  const grossPnl = position.side === "long"
    ? (price - position.entryPrice) * position.quantity
    : (position.entryPrice - price) * position.quantity;
  const netPnl = grossPnl - fee;

  portfolio.balance = round(portfolio.balance + netPnl);
  delete portfolio.positions[symbol];
  portfolio.trades.push({
    type: "close",
    symbol,
    side: position.side,
    entryPrice: position.entryPrice,
    price,
    quantity: position.quantity,
    fee: round(fee),
    pnl: round(netPnl),
    timestamp,
  });
  return portfolio;
};
