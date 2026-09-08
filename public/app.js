const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
const formatPrice = (value) => Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 });
const isStaticMode = window.location.hostname.endsWith("github.io");
const demoSignals = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XAUT/USDT"].map((symbol, index) => ({
  symbol,
  signal: index % 2 === 0 ? "HOLD" : "BUY",
  currentPrice: [64000, 3200, 145, 2350][index],
  probabilities: { growth: index % 2 === 0 ? 0.25 : 0.65, decline: index % 2 === 0 ? 0.25 : 0.2, sideways: index % 2 === 0 ? 0.5 : 0.15 },
}));
const defaultPortfolio = { balance: 10000, positions: {}, trades: [] };

const getStaticPortfolio = () => JSON.parse(localStorage.getItem("paper-portfolio") ?? JSON.stringify(defaultPortfolio));
const saveStaticPortfolio = (portfolio) => localStorage.setItem("paper-portfolio", JSON.stringify(portfolio));

const loadDashboard = async () => {
  if (isStaticMode) {
    return { signals: { signals: demoSignals, errors: [] }, portfolio: getStaticPortfolio() };
  }
  const exchange = document.querySelector("#exchange").value;
  const market = document.querySelector("#market").value;
  const [signalsResponse, portfolioResponse] = await Promise.all([
    fetch(`/api/live-signals?exchange=${exchange}&market=${market}&interval=1H`),
    fetch("/api/paper-portfolio"),
  ]);
  if (!signalsResponse.ok || !portfolioResponse.ok) {
    throw new Error("Не удалось загрузить данные dashboard");
  }
  return { signals: await signalsResponse.json(), portfolio: await portfolioResponse.json() };
};

const renderSignals = (signals) => {
  const container = document.querySelector("#signals");
  container.innerHTML = signals.map((item) => `
    <article class="signal">
      <h3>${item.symbol}</h3>
      <div class="signal-value ${item.signal.toLowerCase()}">${item.signal}</div>
      <div class="probability"><span>Рост</span><strong>${formatPercent(item.probabilities.growth)}</strong></div>
      <div class="probability"><span>Падение</span><strong>${formatPercent(item.probabilities.decline)}</strong></div>
      <div class="probability"><span>Боковик</span><strong>${formatPercent(item.probabilities.sideways)}</strong></div>
      <div class="trade-actions"><button class="trade-button" data-action="open" data-side="long" data-symbol="${item.symbol}" data-price="${item.currentPrice}">Long</button><button class="trade-button" data-action="open" data-side="short" data-symbol="${item.symbol}" data-price="${item.currentPrice}">Short</button></div>
    </article>`).join("");
  container.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => executeTrade(button.dataset)));
};

const executeTrade = async ({ action, side, symbol, price }) => {
  const quantity = Number(document.querySelector("#quantity").value);
  if (isStaticMode) {
    const portfolio = getStaticPortfolio();
    if (action === "open") {
      if (portfolio.positions[symbol]) {
        throw new Error(`Позиция ${symbol} уже открыта`);
      }
      portfolio.positions[symbol] = { symbol, side, entryPrice: Number(price), quantity, openedAt: Date.now() };
      portfolio.trades.push({ type: "open", symbol, side, price: Number(price), quantity, timestamp: Date.now() });
    } else {
      const position = portfolio.positions[symbol];
      if (!position) {
        throw new Error(`Нет открытой позиции ${symbol}`);
      }
      const pnl = position.side === "long" ? (Number(price) - position.entryPrice) * position.quantity : (position.entryPrice - Number(price)) * position.quantity;
      portfolio.balance = Number((portfolio.balance + pnl).toFixed(6));
      delete portfolio.positions[symbol];
      portfolio.trades.push({ type: "close", symbol, price: Number(price), pnl, timestamp: Date.now() });
    }
    saveStaticPortfolio(portfolio);
    await refresh();
    return;
  }
  const response = await fetch("/api/paper-trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, side, symbol, price: Number(price), quantity }) });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error);
  }
  await refresh();
};

const renderPortfolio = (portfolio, signals) => {
  const currentPrices = new Map(signals.map((signal) => [signal.symbol, signal.currentPrice]));
  document.querySelector("#balance").textContent = `${formatPrice(portfolio.balance)} USDT`;
  document.querySelector("#position-count").textContent = Object.keys(portfolio.positions).length;
  document.querySelector("#trade-count").textContent = portfolio.trades.length;
  document.querySelector("#updated-at").textContent = new Date().toLocaleTimeString("ru-RU");

  const positions = Object.values(portfolio.positions);
  document.querySelector("#positions").innerHTML = positions.length === 0 ? "Нет открытых позиций" : positions.map((position) => `
    <div class="row"><span>${position.symbol} · ${position.side}</span><span><strong>${formatPrice(position.entryPrice)}</strong> <button class="trade-button" data-action="close" data-symbol="${position.symbol}" data-price="${currentPrices.get(position.symbol) ?? position.entryPrice}">Закрыть</button></span></div>`).join("");
  document.querySelectorAll("#positions button").forEach((button) => button.addEventListener("click", () => executeTrade(button.dataset)));
  document.querySelector("#trades").innerHTML = portfolio.trades.length === 0 ? "Нет сделок" : portfolio.trades.slice(-5).reverse().map((trade) => `
    <div class="row"><span>${trade.type === "open" ? "Открытие" : "Закрытие"} · ${trade.symbol}</span><strong>${trade.pnl === undefined ? "—" : `${formatPrice(trade.pnl)} USDT`}</strong></div>`).join("");
};

const refresh = async () => {
  const status = document.querySelector("#signal-status");
  status.textContent = "Загрузка…";
  try {
    const dashboard = await loadDashboard();
    renderSignals(dashboard.signals.signals);
    renderPortfolio(dashboard.portfolio, dashboard.signals.signals);
    status.textContent = isStaticMode ? "GitHub Pages demo" : dashboard.signals.errors?.length ? `Ошибок: ${dashboard.signals.errors.length}` : "Live-данные";
  } catch (error) {
    status.textContent = error.message;
  }
};

document.querySelector("#refresh-button").addEventListener("click", refresh);
document.querySelector("#exchange").addEventListener("change", refresh);
document.querySelector("#market").addEventListener("change", refresh);
refresh();
