const { getDbPromise, saveDb } = require('../db');

// ---------------------------------------------------------------------------
// Lane 3 — contract-price-direction events (the TRUTH ANCHOR), seeded from
// verified TrendForce press releases + earnings (gathered & adversarially
// verified 2026-06-30). Two roles:
//   kind='contract'  -> clean ONE-per-product-per-quarter QoQ figure that drives
//                       the composite's contract-momentum series + the bar chart.
//                       magnitude_pct is the SIGNED QoQ midpoint of the cited range.
//   kind in (outlook|earnings|spot) -> the richer dated press-release timeline,
//                       shown as markers/log only (excluded from the rate series).
// All ranges are stored as their midpoint; the raw headline is kept for the tooltip.
// ---------------------------------------------------------------------------

// Clean per-quarter contract settlements (signed QoQ %, dated quarter-start).
const CONTRACT = [
  ['2025-10-01', 'DRAM', 18, 'Late-2025: shortage begins, conventional DRAM contract turns up'],
  ['2025-10-01', 'NAND', 12, 'Late-2025: NAND contract firming on production cuts'],
  ['2026-01-01', 'DRAM', 92.5, '1Q26 conventional DRAM contract +90-95% QoQ (record)'],
  ['2026-01-01', 'NAND', 57.5, '1Q26 NAND contract +55-60% QoQ (upgraded); client SSD +40%+'],
  ['2026-04-01', 'DRAM', 60.5, '2Q26 conventional DRAM contract +58-63% QoQ'],
  ['2026-04-01', 'NAND', 72.5, '2Q26 NAND contract +70-75% QoQ (NAND outpaces DRAM)'],
];

// Dated press-release / earnings timeline (display-only).
const TIMELINE = [
  ['2025-11-17', 'DRAM/NAND', 'up', null, 'outlook', 'Rising memory prices weigh on consumer markets; 2026 smartphone/notebook outlook revised down', 'https://www.trendforce.com/presscenter/news/20251117-12784.html'],
  ['2026-01-05', 'DRAM', 'up', 57.5, 'outlook', '1Q26: makers prioritize servers, +55-60% conventional DRAM across the board', 'https://www.trendforce.com/presscenter/news/20260105-12860.html'],
  ['2026-02-02', 'DRAM', 'up', 92.5, 'outlook', '1Q26 outlook sharply upgraded; PC DRAM >100%, server ~90% QoQ — record highs', 'https://www.trendforce.com/presscenter/news/20260202-12911.html'],
  ['2026-03-31', 'DRAM', 'up', 60.5, 'outlook', '2Q26: AI-server demand drives DRAM +58-63% / NAND +70-75% via CSP long-term agreements', 'https://www.trendforce.com/presscenter/news/20260331-12995.html'],
  ['2026-04-23', 'Memory', 'up', null, 'earnings', 'SK Hynix posts record Q1 profit as memory prices climb (HBM demand)', 'https://www.cnbc.com/2026/04/23/sk-hynix-earnings-ai-memory-shortage-hbm-demand.html'],
  ['2026-05-14', 'LPDDR', 'up', 90, 'outlook', 'Mobile DRAM contract prices keep rising in 2Q26 (~+100% QoQ), pressuring smartphones', 'https://www.trendforce.com/presscenter/news/20260514-13044.html'],
  ['2026-06-01', 'DRAM', 'up', 95.5, 'outlook', '1Q26 actual: DRAM contract +93-98% QoQ; DRAM industry revenue +81% QoQ to $97B', 'https://www.trendforce.com/presscenter/news/20260601-13070.html'],
  ['2026-06-03', 'DDR4', 'up', 3.57, 'spot', 'DDR4/DDR5 spot prices extend gains (DDR4 $34.8/module, +3.57% WoW) — but higher quotes temper demand', 'https://www.trendforce.com/news/2026/06/03/insights-memory-spot-price-update-ddr4-and-ddr5-extend-gains-though-higher-quotes-temper-procurement-demand/'],
  ['2026-06-16', 'SLC NAND', 'up', 140, 'outlook', 'SLC NAND/NOR contract +100-150% in 1H26; structural shortage keeps them rising in 2H26', 'https://www.trendforce.com/presscenter/news/20260616-13102.html'],
  ['2026-06-22', 'DDR2', 'up', 57.5, 'outlook', 'Consumer DRAM shortage spreads to DDR2 (+55-60% in 2Q26; +35-40% forecast 3Q26)', 'https://www.trendforce.com/presscenter/news/20260622-13112.html'],
  ['2026-06-24', 'Memory', 'up', null, 'earnings', 'Micron record fiscal Q3 2026 across DRAM/NAND/HBM; entire CY2026 HBM supply sold out (incl. HBM4)', 'https://investors.micron.com/'],
  ['2026-06-25', 'LPDDR5X', 'up', 89, 'spot', 'Q2 actuals: LPDDR5X +89%, LPDDR4X +75%, DDR4 16GB +51% (SigmaIntel via TweakTown)', 'https://www.tweaktown.com/news/112358/'],
];

// ---------------------------------------------------------------------------
// Lane 4 — SIA / WSTS monthly global billings (BACKDROP). Real anchors: April 2025
// ~$56.9B, March 2026 $99.5B, April 2026 $110.5B (+11% MoM / +93.9% YoY). Months
// between anchors are linearly interpolated (coarse macro weather, not memory-specific).
// ---------------------------------------------------------------------------
const SIA_ANCHORS = [
  ['2024-01', 48.0], ['2024-06', 50.5], ['2024-12', 58.0],
  ['2025-04', 56.9], ['2025-08', 64.0], ['2025-12', 80.0],
  ['2026-01', 86.0], ['2026-02', 92.0], ['2026-03', 99.5], ['2026-04', 110.5],
];

function interpolateSia() {
  const out = [];
  for (let i = 0; i < SIA_ANCHORS.length - 1; i++) {
    const [k0, v0] = SIA_ANCHORS[i];
    const [k1, v1] = SIA_ANCHORS[i + 1];
    let [y, m] = k0.split('-').map(Number);
    const [y1, m1] = k1.split('-').map(Number);
    const span = (y1 - y) * 12 + (m1 - m);
    for (let s = 0; s < span; s++) {
      const v = v0 + ((v1 - v0) * s) / span;
      out.push([`${y}-${String(m).padStart(2, '0')}-01`, Math.round(v * 10) / 10]);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  }
  const last = SIA_ANCHORS[SIA_ANCHORS.length - 1];
  out.push([`${last[0]}-01`, last[1]]);
  return out;
}

async function seedEvents() {
  const db = await getDbPromise();

  db.run('DELETE FROM contract_events');
  for (const [date, product, mag, headline] of CONTRACT) {
    db.run(
      "INSERT OR REPLACE INTO contract_events (date, product, direction, magnitude_pct, period, kind, source, headline, url) VALUES (?,?,?,?,'quarterly','contract','TrendForce',?, 'https://www.trendforce.com/presscenter/news')",
      [date, product, mag >= 0 ? 'up' : 'down', mag, headline]
    );
  }
  for (const [date, product, direction, mag, kind, headline, url] of TIMELINE) {
    db.run(
      'INSERT OR REPLACE INTO contract_events (date, product, direction, magnitude_pct, period, kind, source, headline, url) VALUES (?,?,?,?,?,?,?,?,?)',
      [date, product, direction, mag, kind === 'spot' ? 'weekly' : 'quarterly', kind, 'TrendForce', headline, url]
    );
  }

  // sia_billings is ALSO a live scraper target, so only clear the interpolated range
  // (<= last anchor month); months the scraper added beyond it must survive a re-seed.
  const lastAnchorDate = `${SIA_ANCHORS[SIA_ANCHORS.length - 1][0]}-01`;
  db.run('DELETE FROM sia_billings WHERE date <= ?', [lastAnchorDate]);
  const sia = interpolateSia();
  for (let i = 0; i < sia.length; i++) {
    const [date, b] = sia[i];
    const prev = i > 0 ? sia[i - 1][1] : null;
    const yearAgo = i >= 12 ? sia[i - 12][1] : null;
    const mom = prev ? Math.round((b / prev - 1) * 1000) / 10 : null;
    const yoy = yearAgo ? Math.round((b / yearAgo - 1) * 1000) / 10 : null;
    db.run('INSERT OR REPLACE INTO sia_billings (date, billings_usd_b, yoy_pct, mom_pct) VALUES (?,?,?,?)', [date, b, yoy, mom]);
  }

  saveDb();
  const c = db.exec('SELECT COUNT(*) FROM contract_events')[0].values[0][0];
  const s = db.exec('SELECT COUNT(*) FROM sia_billings')[0].values[0][0];
  console.log(`Seeded ${c} contract events and ${s} SIA billings months.`);
}

if (require.main === module) {
  seedEvents().catch(console.error);
} else {
  module.exports = { seedEvents };
}
