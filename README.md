# Market Signal Bot

Первый MVP системы сигналов для криптовалют. Сейчас проект работает на демонстрационных данных и не отправляет реальные ордера.

## Запуск

```bash
pnpm start
```

Проверка:

```bash
pnpm run check
```

После запуска доступны:

- `GET /api/health`
- `GET /api/signals`
- `GET /api/live-signals?exchange=bitget&market=futures&interval=1H`
- `GET /api/candles?exchange=bitget&symbol=BTC%2FUSDT&market=futures&interval=1H`
- `GET /api/backtest?exchange=bitget&symbol=BTC%2FUSDT&market=futures&interval=1H&limit=200`
- `GET /api/stored-candles?exchange=bitget&symbol=BTC%2FUSDT&interval=1H`
- `GET /api/paper-portfolio`
- `POST /api/paper-trade` с JSON `{"action":"open","symbol":"BTC/USDT","side":"long","price":100,"quantity":1}`

Веб-панель открывается по адресу `http://localhost:3000/`.
В панели можно выбрать биржу и рынок, обновить live-сигналы и открыть виртуальную long/short-позицию.

## Текущий MVP

- инструменты: BTC/USDT, ETH/USDT, SOL/USDT, XAUT/USDT;
- биржи: MEXC и Bitget;
- базовые индикаторы: SMA и RSI;
- сигнал: BUY, SELL или HOLD;
- вероятности сценариев;
- подготовленная модель виртуальной позиции.
- публичная загрузка свечей Bitget для spot/futures и MEXC для futures.

Адаптеры бирж приводят свечи MEXC и Bitget к единому формату. Свечи сохраняются в локальное JSON-хранилище, а backtesting учитывает комиссию 0.1% на вход и выход.
Paper portfolio использует виртуальный баланс 10 000 USDT и поддерживает long/short позиции без реальных ордеров.
