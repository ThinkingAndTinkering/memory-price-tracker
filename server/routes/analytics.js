const express = require('express');
const { getDbPromise, query } = require('../db');
const { EQUITY_BASKET } = require('../config');
const {
  buildDailyEquityIndex,
  computeComposite,
  computeCycle,
  computeBuySignal,
} = require('../lib/analytics');

const router = express.Router();

// Composite MPDI history
router.get('/composite', async (req, res) => {
  await getDbPromise();
  res.json(computeComposite().series);
});

// Latest MPDI summary (gauge headline)
router.get('/composite/latest', async (req, res) => {
  await getDbPromise();
  res.json(computeComposite().latest || {});
});

// Cycle position
router.get('/cycle', async (req, res) => {
  await getDbPromise();
  res.json(computeCycle() || {});
});

// Equity basket index + constituents
router.get('/equity', async (req, res) => {
  await getDbPromise();
  const { series, constituents } = buildDailyEquityIndex();
  res.json({ series, constituents, basket: EQUITY_BASKET });
});

// Contract-direction events (truth anchor)
router.get('/contract', async (req, res) => {
  await getDbPromise();
  const { product } = req.query;
  let sql = 'SELECT * FROM contract_events';
  const params = [];
  if (product) { sql += ' WHERE product = ?'; params.push(product); }
  sql += ' ORDER BY date ASC';
  res.json(query(sql, params));
});

// SIA billings backdrop
router.get('/sia', async (req, res) => {
  await getDbPromise();
  res.json(query('SELECT * FROM sia_billings ORDER BY date ASC'));
});

// Buyer buy/wait signal
router.get('/buy-signal', async (req, res) => {
  await getDbPromise();
  res.json(computeBuySignal());
});

// One-shot overview payload for the hero (fewer round-trips)
router.get('/overview', async (req, res) => {
  await getDbPromise();
  const composite = computeComposite();
  res.json({
    composite: composite.latest,
    cycle: computeCycle(),
    buySignal: computeBuySignal(),
    latestPrices: query(`
      SELECT p.memory_type, p.date, p.price_per_gb, p.source FROM prices p
      INNER JOIN (SELECT memory_type, MAX(date) md FROM prices GROUP BY memory_type) l
        ON p.memory_type = l.memory_type AND p.date = l.md
    `),
  });
});

module.exports = router;
