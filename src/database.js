import pg from "pg";

const { Pool } = pg;
let pool;

export const getPool = () => {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
};

export const migrate = async () => {
  const database = getPool();
  if (!database) {
    return false;
  }

  await database.query(`
    CREATE TABLE IF NOT EXISTS market_candles (
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      open NUMERIC NOT NULL,
      high NUMERIC NOT NULL,
      low NUMERIC NOT NULL,
      close NUMERIC NOT NULL,
      volume NUMERIC NOT NULL,
      turnover NUMERIC NOT NULL,
      PRIMARY KEY (exchange, symbol, interval, timestamp)
    );
    CREATE TABLE IF NOT EXISTS portfolio_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  return true;
};
