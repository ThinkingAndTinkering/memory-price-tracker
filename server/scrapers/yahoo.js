// Lane 1 — memory-maker equity basket.
// Fetches daily closes from Yahoo Finance's free, key-free v8 chart endpoint.
// Verified live: a browser User-Agent is REQUIRED (no UA -> HTTP 429 "Edge: Too
// Many Requests"); no cookie/crumb is needed for this endpoint. query1/query2 are
// interchangeable mirrors — we alternate to spread load.
const { fetch } = require('undici');
const { getDbPromise, saveDb } = require('../db');
const { EQUITY_BASKET, USER_AGENT } = require('../config');

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch ~5y of daily closes for one symbol. Returns [{date:'YYYY-MM-DD', close, currency}].
// hostSeed alternates query1/query2 per basket index; attempt is the independent 429-retry
// counter so EVERY ticker gets a full 1s/2s/4s backoff schedule (not just index 0).
async function fetchDailyCloses(symbol, hostSeed = 0, attempt = 0) {
  const host = HOSTS[(hostSeed + attempt) % HOSTS.length];
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 429) {
    if (attempt < 3) {
      await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
      return fetchDailyCloses(symbol, hostSeed, attempt + 1);
    }
    throw new Error('rate-limited (429) after retries');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json.chart.error) throw new Error(json.chart.error.description || 'chart error');

  const r = json.chart.result[0];
  const currency = r.meta && r.meta.currency;
  const ts = r.timestamp || [];
  const close = (r.indicators.quote[0] && r.indicators.quote[0].close) || [];

  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    if (close[i] == null) continue; // holidays / halts come back null
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    rows.push({ date, close: close[i], currency });
  }
  return rows;
}

async function scrapeEquities() {
  const db = await getDbPromise();
  const summary = [];

  for (let i = 0; i < EQUITY_BASKET.length; i++) {
    const { ticker } = EQUITY_BASKET[i];
    try {
      const rows = await fetchDailyCloses(ticker, i); // seed host alternation with i
      for (const row of rows) {
        db.run(
          'INSERT OR REPLACE INTO equity_quotes (ticker, date, close, currency) VALUES (?, ?, ?, ?)',
          [ticker, row.date, row.close, row.currency || null]
        );
      }
      const last = rows[rows.length - 1];
      summary.push({ ticker, count: rows.length, last: last && last.date });
      console.log(`    ${ticker}: ${rows.length} closes (latest ${last && last.date} = ${last && last.close})`);
    } catch (err) {
      summary.push({ ticker, error: err.message });
      console.warn(`    ${ticker} failed: ${err.message}`);
    }
    await sleep(1200); // ~1 req/sec, polite from a shared egress IP
  }

  saveDb();
  return summary;
}

module.exports = { scrapeEquities, fetchDailyCloses };
