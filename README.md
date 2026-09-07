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
- `GET /api/candles?exchange=bitget&symbol=BTC%2FUSDT&market=futures&interval=1H`

## Текущий MVP

- инструменты: BTC/USDT, ETH/USDT, SOL/USDT, XAUT/USDT;
- биржи: MEXC и Bitget;
- базовые индикаторы: SMA и RSI;
- сигнал: BUY, SELL или HOLD;
- вероятности сценариев;
- подготовленная модель виртуальной позиции.
- публичная загрузка свечей Bitget для spot/futures и MEXC для futures.

Адаптеры бирж приводят свечи MEXC и Bitget к единому формату. Следующий шаг — добавить хранение исторических данных и backtesting.
