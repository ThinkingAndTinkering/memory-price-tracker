const { getDbPromise, saveDb } = require('../db');

// Known price anchor points (date, $/GB) based on real market data.
// 2024-2026 reflects the massive price surge driven by HBM/AI demand,
// production cuts by Samsung/SK Hynix/Micron, and supply tightening.
// 2026 anchors corrected against live sources (2026-06-30): Q1'26 conventional DRAM
// contract rose ~90-95% QoQ (a record — NOT the ~50% earlier assumed); by June 2026
// retail sat near DDR4 ~$9/GB, DDR5 ~$14/GB, NAND ~$0.14/GB.
// Sources: TrendForce, Tom's Hardware, TweakTown/SigmaIntel, diskprices, Micron/SK Hynix earnings.
// NOTE: every point inserted here is source='estimated' — interpolated from these
// anchors, NOT a measured price. Live scraped points (newegg/diskprices) overlay it.
const DDR4_ANCHORS = [
  ['2016-02-01', 3.50],
  ['2016-08-01', 4.00],
  ['2017-02-01', 5.50],
  ['2017-08-01', 7.00],
  ['2018-02-01', 7.80],
  ['2018-06-01', 8.00],  // 2017-2018 peak (crypto/smartphone boom)
  ['2018-10-01', 6.50],
  ['2019-02-01', 4.50],
  ['2019-06-01', 3.20],
  ['2019-10-01', 3.00],
  ['2020-02-01', 2.80],
  ['2020-06-01', 3.10],
  ['2020-10-01', 2.90],
  ['2021-02-01', 3.20],
  ['2021-06-01', 3.40],
  ['2021-10-01', 2.80],
  ['2022-02-01', 2.50],
  ['2022-06-01', 2.20],
  ['2022-10-01', 1.80],
  ['2023-02-01', 1.50],
  ['2023-06-01', 1.40],  // Bottom of the cycle
  ['2023-10-01', 1.60],
  ['2024-02-01', 1.80],
  ['2024-05-01', 2.00],
  ['2024-08-01', 2.30],  // Prices firming up as production shifts to HBM
  ['2024-11-01', 2.80],
  ['2025-02-01', 3.10],
  ['2025-05-01', 3.20],  // Brief stability before surge
  ['2025-07-01', 4.00],  // AI/HBM-driven supply crunch hits DDR4
  ['2025-09-01', 5.50],  // Manufacturers halting DDR4 production
  ['2025-11-01', 7.00],  // Severe shortage
  ['2025-12-01', 7.50],  // Near 2018 peak levels
  ['2026-02-01', 8.50],  // Q1 2026: conventional DRAM contract +90-95% QoQ (record)
  ['2026-04-01', 8.40],
  ['2026-06-01', 8.20],  // aligns to live Newegg median ~$8.1/GB (Jun 2026); rampriceindex ~$9
];

const DDR5_ANCHORS = [
  ['2021-11-01', 7.50],  // Launch premium
  ['2022-02-01', 6.80],
  ['2022-06-01', 5.50],
  ['2022-10-01', 4.20],
  ['2023-02-01', 3.20],
  ['2023-06-01', 2.80],  // DDR5 bottom
  ['2023-10-01', 2.50],
  ['2024-02-01', 2.80],
  ['2024-05-01', 3.10],
  ['2024-08-01', 3.40],  // Spot prices rising
  ['2024-11-01', 3.80],
  ['2025-02-01', 3.50],
  ['2025-05-01', 3.00],  // Brief dip before surge
  ['2025-07-01', 4.50],  // Supply crunch begins
  ['2025-09-01', 6.00],  // 91% retail spike Oct-Nov
  ['2025-10-01', 7.50],
  ['2025-12-01', 10.00], // DDR5-6000 32GB kits ~$320
  ['2026-01-01', 11.50],
  ['2026-02-01', 12.50], // Q1 2026: PC DRAM contract >100% QoQ
  ['2026-04-01', 14.00],
  ['2026-06-01', 15.20], // aligns to live Newegg median ~$15.3/GB; 32GB floor ~$375 (Tom's Hardware)
];

// NAND pricing per GB (based on 1TB NVMe SSD retail ÷ 1000)
const NAND_ANCHORS = [
  ['2016-02-01', 0.28],
  ['2016-08-01', 0.30],
  ['2017-02-01', 0.35],
  ['2017-06-01', 0.38],
  ['2017-10-01', 0.33],
  ['2018-02-01', 0.30],
  ['2018-06-01', 0.25],
  ['2018-10-01', 0.18],
  ['2019-02-01', 0.13],
  ['2019-06-01', 0.11],
  ['2019-10-01', 0.10],
  ['2020-02-01', 0.11],
  ['2020-06-01', 0.10],
  ['2020-10-01', 0.09],
  ['2021-02-01', 0.10],
  ['2021-06-01', 0.09],
  ['2021-10-01', 0.08],
  ['2022-02-01', 0.09],
  ['2022-06-01', 0.08],
  ['2022-10-01', 0.07],
  ['2023-02-01', 0.055],
  ['2023-06-01', 0.050],  // NAND bottom
  ['2023-10-01', 0.060],
  ['2024-02-01', 0.070],
  ['2024-05-01', 0.10],   // Q2 2024: 13-18% QoQ increase
  ['2024-08-01', 0.105],
  ['2024-11-01', 0.095],
  ['2025-02-01', 0.080],
  ['2025-05-01', 0.055],  // Brief low before surge
  ['2025-07-01', 0.065],
  ['2025-09-01', 0.075],
  ['2025-11-01', 0.095],  // 246% NAND wafer increase, 70% in last 60 days
  ['2025-12-01', 0.110],
  ['2026-02-01', 0.130],  // Q1 2026: NAND +55-60% QoQ (upgraded), client SSD +40%+
  ['2026-04-01', 0.130],
  ['2026-06-01', 0.124],  // aligns to live diskprices mainstream NVMe ~$124/TB (Jun 2026)
];

function parseDate(str) {
  return new Date(str + 'T00:00:00Z');
}

function daysBetween(d1, d2) {
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function interpolateAnchors(anchors, noisePercent = 0.05) {
  const points = anchors.map(([dateStr, price]) => ({
    date: parseDate(dateStr),
    price,
  }));

  const allDays = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const totalDays = daysBetween(start.date, end.date);

    for (let d = 0; d < totalDays; d++) {
      const t = d / totalDays;
      const smoothT = t * t * (3 - 2 * t);
      const price = start.price + (end.price - start.price) * smoothT;
      const noise = 1 + (Math.random() * 2 - 1) * noisePercent;
      const date = addDays(start.date, d);
      allDays.push({
        date: formatDate(date),
        price: Math.round(price * noise * 10000) / 10000,
      });
    }
  }

  const last = points[points.length - 1];
  allDays.push({ date: formatDate(last.date), price: last.price });

  return allDays;
}

async function seed() {
  const db = await getDbPromise();
  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
  const tenYearsAgo = new Date(now);
  tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);

  console.log('Generating historical price data...');

  const datasets = [
    { type: 'DDR4', anchors: DDR4_ANCHORS },
    { type: 'DDR5', anchors: DDR5_ANCHORS },
    { type: 'NAND', anchors: NAND_ANCHORS },
  ];

  // Clear existing estimated data
  db.run("DELETE FROM prices WHERE source = 'estimated'");

  for (const { type, anchors } of datasets) {
    console.log(`  Generating ${type} data...`);
    const daily = interpolateAnchors(anchors);

    let count = 0;
    const seenMonths = new Set();

    for (const entry of daily) {
      const entryDate = parseDate(entry.date);

      if (entryDate < tenYearsAgo) continue;
      if (entryDate > now) continue;

      if (entryDate < fiveYearsAgo) {
        // Monthly for 6-10 years ago
        const monthKey = entry.date.slice(0, 7);
        if (!seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);
          db.run(
            "INSERT OR REPLACE INTO prices (memory_type, date, price_per_gb, source) VALUES (?, ?, ?, 'estimated')",
            [type, entry.date, entry.price]
          );
          count++;
        }
      } else {
        // Weekly for last 5 years (Mondays)
        const d = parseDate(entry.date);
        if (d.getUTCDay() === 1) {
          db.run(
            "INSERT OR REPLACE INTO prices (memory_type, date, price_per_gb, source) VALUES (?, ?, ?, 'estimated')",
            [type, entry.date, entry.price]
          );
          count++;
        }
      }
    }

    console.log(`    ${count} data points for ${type}`);
  }

  saveDb();

  const result = db.exec('SELECT COUNT(*) as c FROM prices');
  console.log(`Seed complete! Total rows: ${result[0].values[0][0]}`);
}

if (require.main === module) {
  seed().catch(console.error);
} else {
  module.exports = { seed };
}
