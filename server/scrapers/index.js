const { getDbPromise, saveDb } = require('../db');
const { scrapeEquities } = require('./yahoo');
const { fetchNandPricePerGb } = require('./diskprices');
const { scrapeNeweggType } = require('./newegg');
const { fetchLatestBilling } = require('./sia');
const { scrapeTrendforce } = require('./trendforce');

// Runs every data lane. Each lane fails independently — a blocked retail scrape
// never takes down the equity lane, and vice-versa.
async function runAllScrapers() {
  console.log('Starting scrape run...');
  const today = new Date().toISOString().slice(0, 10);
  const db = await getDbPromise();
  const report = { date: today, lanes: {} };

  // ---- Lane 1: equities (Yahoo) ----
  try {
    console.log('  [equities] fetching memory-maker basket...');
    const summary = await scrapeEquities();
    const ok = summary.filter((s) => !s.error).length;
    report.lanes.equities = { success: ok > 0, tickers: summary };
  } catch (err) {
    console.error('  [equities] failed:', err.message);
    report.lanes.equities = { success: false, error: err.message };
  }

  // ---- Lane 2 (NAND): diskprices ----
  try {
    console.log('  [retail/NAND] diskprices.com...');
    const { pricePerGb, sampleSize } = await fetchNandPricePerGb();
    db.run(
      "INSERT OR REPLACE INTO prices (memory_type, date, price_per_gb, source) VALUES ('NAND', ?, ?, 'diskprices')",
      [today, pricePerGb]
    );
    console.log(`    NAND $${pricePerGb}/GB (n=${sampleSize})`);
    report.lanes.nand = { success: true, pricePerGb, sampleSize };
  } catch (err) {
    console.warn('  [retail/NAND] failed:', err.message);
    report.lanes.nand = { success: false, error: err.message };
  }

  // ---- Lane 2 (DRAM): Newegg (fail-soft) ----
  for (const type of ['DDR4', 'DDR5']) {
    try {
      console.log(`  [retail/${type}] Newegg...`);
      const { pricePerGb, sampleSize } = await scrapeNeweggType(type);
      db.run(
        "INSERT OR REPLACE INTO prices (memory_type, date, price_per_gb, source) VALUES (?, ?, ?, 'newegg')",
        [type, today, pricePerGb]
      );
      console.log(`    ${type} $${pricePerGb}/GB (n=${sampleSize})`);
      report.lanes[type.toLowerCase()] = { success: true, pricePerGb, sampleSize };
    } catch (err) {
      console.warn(`  [retail/${type}] failed (kept prior value):`, err.message);
      report.lanes[type.toLowerCase()] = { success: false, error: err.message };
    }
  }

  // ---- Lane 3: contract-direction events (TrendForce RSS, fail-soft) ----
  try {
    console.log('  [contract] TrendForce RSS...');
    const tf = await scrapeTrendforce();
    report.lanes.contract = tf;
  } catch (err) {
    console.warn('  [contract] failed:', err.message);
    report.lanes.contract = { success: false, error: err.message };
  }

  // ---- Lane 4: SIA billings (fail-soft) ----
  try {
    console.log('  [billings] SIA...');
    const b = await fetchLatestBilling();
    db.run(
      'INSERT OR REPLACE INTO sia_billings (date, billings_usd_b, yoy_pct, mom_pct) VALUES (?, ?, ?, ?)',
      [b.date, b.billings_usd_b, b.yoy_pct, b.mom_pct]
    );
    console.log(`    ${b.date}: $${b.billings_usd_b}B (YoY ${b.yoy_pct}%)`);
    report.lanes.sia = { success: true, ...b };
  } catch (err) {
    console.warn('  [billings] failed:', err.message);
    report.lanes.sia = { success: false, error: err.message };
  }

  saveDb();
  const okLanes = Object.values(report.lanes).filter((l) => l.success).length;
  report.success = okLanes > 0;
  console.log(`Scrape complete. ${okLanes} lane(s) updated for ${today}.`);
  return report;
}

module.exports = { runAllScrapers };
