import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const dataFile = process.env.DATA_FILE ?? "data/market-data.json";

const readStore = async () => {
  try {
    return JSON.parse(await readFile(dataFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { candles: {} };
    }
    throw error;
  }
};

export const saveCandles = async (candles) => {
  if (candles.length === 0) {
    return 0;
  }

  const store = await readStore();
  const firstCandle = candles[0];
  const key = `${firstCandle.exchange}:${firstCandle.symbol}:${firstCandle.interval}`;
  const existing = store.candles[key] ?? [];
  const merged = new Map(existing.map((candle) => [candle.timestamp, candle]));

  for (const candle of candles) {
    merged.set(candle.timestamp, candle);
  }

  store.candles[key] = [...merged.values()].sort((first, second) => first.timestamp - second.timestamp);
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return candles.length;
};

export const loadCandles = async ({ exchange, symbol, interval }) => {
  const store = await readStore();
  return store.candles[`${exchange}:${symbol}:${interval}`] ?? [];
};
