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

ML endpoints:

- `GET /api/model/train?symbol=BTC%2FUSDT&interval=1H`
- `GET /api/model/predict?symbol=BTC%2FUSDT&interval=1H`

Сбор свечей и переобучение запускаются каждые 15 минут на Render. Telegram включается переменными `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`.

Для запуска backend с PostgreSQL:

```bash
docker compose up --build
```

Без Docker проект использует локальное JSON-хранилище. При заданной `DATABASE_URL` автоматически используется PostgreSQL.

## Облачный backend

Файл `render.yaml` описывает Node web-service и PostgreSQL для Render. Render подключает репозиторий из GitHub, выполняет миграцию базы и автоматически разворачивает новые коммиты. Для live-режима после создания сервиса нужно указать его URL в `public/app.js` как `API_BASE_URL`.

GitHub Pages публикует статическую версию dashboard: `https://khdjkbr.github.io/market-signal-bot/`. В Pages используется demo-режим, а paper-портфель сохраняется в браузере. Live API требует отдельного постоянно работающего backend.

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
