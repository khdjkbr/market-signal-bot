const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
const formatPrice = (value) => Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const loadDashboard = async () => {
  const [signalsResponse, portfolioResponse] = await Promise.all([
    fetch("/api/signals"),
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
    </article>`).join("");
};

const renderPortfolio = (portfolio) => {
  document.querySelector("#balance").textContent = `${formatPrice(portfolio.balance)} USDT`;
  document.querySelector("#position-count").textContent = Object.keys(portfolio.positions).length;
  document.querySelector("#trade-count").textContent = portfolio.trades.length;
  document.querySelector("#updated-at").textContent = new Date().toLocaleTimeString("ru-RU");

  const positions = Object.values(portfolio.positions);
  document.querySelector("#positions").innerHTML = positions.length === 0 ? "Нет открытых позиций" : positions.map((position) => `
    <div class="row"><span>${position.symbol} · ${position.side}</span><strong>${formatPrice(position.entryPrice)}</strong></div>`).join("");
  document.querySelector("#trades").innerHTML = portfolio.trades.length === 0 ? "Нет сделок" : portfolio.trades.slice(-5).reverse().map((trade) => `
    <div class="row"><span>${trade.type === "open" ? "Открытие" : "Закрытие"} · ${trade.symbol}</span><strong>${trade.pnl === undefined ? "—" : `${formatPrice(trade.pnl)} USDT`}</strong></div>`).join("");
};

const refresh = async () => {
  const status = document.querySelector("#signal-status");
  status.textContent = "Загрузка…";
  try {
    const dashboard = await loadDashboard();
    renderSignals(dashboard.signals.signals);
    renderPortfolio(dashboard.portfolio);
    status.textContent = "Демо-режим";
  } catch (error) {
    status.textContent = error.message;
  }
};

document.querySelector("#refresh-button").addEventListener("click", refresh);
refresh();
