import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getPool } from "./database.js";

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

  const firstCandle = candles[0];
  const database = getPool();
  if (database) {
    await database.query("BEGIN");
    try {
      for (const candle of candles) {
        await database.query(`
          INSERT INTO market_candles (exchange, symbol, interval, timestamp, open, high, low, close, volume, turnover)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (exchange, symbol, interval, timestamp) DO UPDATE SET open=$5, high=$6, low=$7, close=$8, volume=$9, turnover=$10
        `, [candle.exchange, candle.symbol, candle.interval, candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.turnover]);
      }
      await database.query("COMMIT");
      return candles.length;
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    }
  }

  const store = await readStore();
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
  const database = getPool();
  if (database) {
    const result = await database.query(`SELECT exchange, symbol, interval, timestamp, open, high, low, close, volume, turnover FROM market_candles WHERE exchange=$1 AND symbol=$2 AND interval=$3 ORDER BY timestamp`, [exchange, symbol, interval]);
    return result.rows.map((row) => ({ ...row, timestamp: Number(row.timestamp), open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume), turnover: Number(row.turnover) }));
  }
  const store = await readStore();
  return store.candles[`${exchange}:${symbol}:${interval}`] ?? [];
};

export const loadPortfolio = async () => {
  const database = getPool();
  if (database) {
    const result = await database.query("SELECT state FROM portfolio_state WHERE id=1");
    return result.rows[0]?.state ?? null;
  }
  const store = await readStore();
  return store.portfolio ?? null;
};

export const savePortfolio = async (portfolio) => {
  const database = getPool();
  if (database) {
    await database.query("INSERT INTO portfolio_state (id, state) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET state=$1, updated_at=NOW()", [portfolio]);
    return portfolio;
  }
  const store = await readStore();
  store.portfolio = portfolio;
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return portfolio;
};

export const saveModel = async (model) => {
  const id = `${model.symbol}:${model.interval}`;
  const database = getPool();
  if (database) {
    await database.query("INSERT INTO model_state (id, model) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET model=$2, updated_at=NOW()", [id, model]);
    return model;
  }
  const store = await readStore();
  store.models ??= {};
  store.models[id] = model;
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return model;
};

export const loadModel = async ({ symbol, interval }) => {
  const id = `${symbol}:${interval}`;
  const database = getPool();
  if (database) {
    const result = await database.query("SELECT model FROM model_state WHERE id=$1", [id]);
    return result.rows[0]?.model ?? null;
  }
  const store = await readStore();
  return store.models?.[id] ?? null;
};
