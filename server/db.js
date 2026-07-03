const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prices.db');

let db = null;
let dbReady = null;

function getDbPromise() {
  if (!dbReady) {
    dbReady = initSqlJs().then((SQL) => {
      if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
      } else {
        db = new SQL.Database();
      }
      initSchema();
      return db;
    });
  }
  return dbReady;
}

function initSchema() {
  // ---- Lane 2: retail $/GB (the original table — kept as-is) ----
  db.run(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_type TEXT NOT NULL,
      date TEXT NOT NULL,
      price_per_gb REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'estimated',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(memory_type, date)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prices_type_date ON prices(memory_type, date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prices_date ON prices(date)`);

  // ---- Lane 1: memory-maker equity quotes (the LEADING signal) ----
  db.run(`
    CREATE TABLE IF NOT EXISTS equity_quotes (
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      close REAL NOT NULL,
      currency TEXT,
      UNIQUE(ticker, date)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_equity_ticker_date ON equity_quotes(ticker, date)`);

  // ---- Lane 3: contract-price-direction events (the TRUTH ANCHOR) ----
  db.run(`
    CREATE TABLE IF NOT EXISTS contract_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      product TEXT NOT NULL,          -- DRAM | DDR5 | DDR4 | NAND | LPDDR | HBM | eMMC/UFS | NOR | SLC ...
      direction TEXT NOT NULL,        -- up | down | flat
      magnitude_pct REAL,             -- SIGNED headline % move for the stated period (QoQ unless period says otherwise)
      period TEXT NOT NULL DEFAULT 'quarterly',  -- quarterly | monthly | half | spot
      kind TEXT NOT NULL DEFAULT 'contract',     -- contract | spot | earnings | outlook
      source TEXT,
      headline TEXT,
      url TEXT,
      UNIQUE(date, product, source)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_contract_date ON contract_events(date)`);

  // ---- Lane 4: SIA / WSTS monthly billings (the BACKDROP) ----
  db.run(`
    CREATE TABLE IF NOT EXISTS sia_billings (
      date TEXT NOT NULL,             -- YYYY-MM-01 of the reported month
      billings_usd_b REAL NOT NULL,   -- 3-month moving average, $B
      yoy_pct REAL,
      mom_pct REAL,
      UNIQUE(date)
    )
  `);
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Convenience: run a SELECT and return an array of plain row objects.
function query(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

module.exports = { getDbPromise, saveDb, query };
