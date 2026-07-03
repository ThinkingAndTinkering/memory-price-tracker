const express = require('express');
const { getDbPromise } = require('../db');

const router = express.Router();

// GET /api/prices - All prices, filterable
router.get('/', async (req, res) => {
  const db = await getDbPromise();
  const { type, from, to } = req.query;

  let sql = 'SELECT * FROM prices WHERE 1=1';
  const params = [];

  if (type) {
    sql += ' AND memory_type = ?';
    params.push(type);
  }
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date ASC';

  const result = db.exec(sql, params);
  res.json(formatResults(result));
});

// GET /api/prices/latest - Latest price for each type
router.get('/latest', async (req, res) => {
  const db = await getDbPromise();
  const result = db.exec(`
    SELECT p.* FROM prices p
    INNER JOIN (
      SELECT memory_type, MAX(date) as max_date
      FROM prices
      GROUP BY memory_type
    ) latest ON p.memory_type = latest.memory_type AND p.date = latest.max_date
    ORDER BY p.memory_type
  `);
  res.json(formatResults(result));
});

// GET /api/prices/daily - Daily prices (recent scraped data)
router.get('/daily', async (req, res) => {
  const db = await getDbPromise();
  const { type, from, to } = req.query;

  let sql = 'SELECT * FROM prices WHERE 1=1';
  const params = [];

  if (type) {
    sql += ' AND memory_type = ?';
    params.push(type);
  }
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date ASC';

  const result = db.exec(sql, params);
  res.json(formatResults(result));
});

// GET /api/prices/weekly - Weekly aggregated (last 5 years)
router.get('/weekly', async (req, res) => {
  const db = await getDbPromise();
  const { type } = req.query;

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const fromDate = fiveYearsAgo.toISOString().slice(0, 10);

  let sql = `
    SELECT memory_type,
           date,
           price_per_gb,
           source
    FROM prices
    WHERE date >= ?
  `;
  const params = [fromDate];

  if (type) {
    sql += ' AND memory_type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date ASC';

  const result = db.exec(sql, params);
  const rows = formatResults(result);

  // Group by week — keep the LAST (freshest) entry per week (rows are ascending) so the
  // current week reflects the live scraped point and agrees with the gauge/composite.
  const weeklyMap = new Map();
  for (const row of rows) {
    const d = new Date(row.date + 'T00:00:00Z');
    const weekStart = new Date(d);
    weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const weekKey = `${row.memory_type}-${weekStart.toISOString().slice(0, 10)}`;
    weeklyMap.set(weekKey, row);
  }

  res.json(Array.from(weeklyMap.values()));
});

// GET /api/prices/monthly - Monthly aggregated (last 10 years)
router.get('/monthly', async (req, res) => {
  const db = await getDbPromise();
  const { type } = req.query;

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const fromDate = tenYearsAgo.toISOString().slice(0, 10);

  let sql = `
    SELECT memory_type,
           date,
           price_per_gb,
           source
    FROM prices
    WHERE date >= ?
  `;
  const params = [fromDate];

  if (type) {
    sql += ' AND memory_type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date ASC';

  const result = db.exec(sql, params);
  const rows = formatResults(result);

  // Group by month — keep the LAST (freshest) entry per month (rows ascending) to match
  // the analytics composite's last-per-month resample, so chart/gauge/composite agree.
  const monthlyMap = new Map();
  for (const row of rows) {
    const monthKey = `${row.memory_type}-${row.date.slice(0, 7)}`;
    monthlyMap.set(monthKey, row);
  }

  res.json(Array.from(monthlyMap.values()));
});

// Helper to convert sql.js result format to row objects
function formatResults(result) {
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

module.exports = router;
