// Lane 4 — SIA / WSTS monthly global semiconductor billings (the BACKDROP).
// Verified live: static HTML; a browser User-Agent is required (default UA -> 403).
// Slugs are title-derived (not date-predictable), so we crawl the press-release
// index to find the newest "global-semiconductor-sales..." post, then regex the
// lead paragraph. Memory is NOT broken out for free — this is macro weather only.
const { fetch } = require('undici');
const { USER_AGENT } = require('../config');

const INDEX = 'https://www.semiconductors.org/category/news/press-releases/';
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Parse the lead paragraph, e.g.:
// "global semiconductor sales were $110.5 billion during the month of April 2026,
//  an increase of 11% compared to the March 2026 total ... and 93.9% more than the
//  April 2025 total ..."
function parseBilling(text) {
  const dollar = text.match(/\$([0-9.]+)\s*billion[^.]*?month of\s+(\w+)\s+(\d{4})/i);
  if (!dollar) return null;
  const billions = parseFloat(dollar[1]);
  const month = MONTHS[dollar[2].toLowerCase()];
  const year = parseInt(dollar[3], 10);
  if (!month) return null;

  const mom = text.match(/(increase|decrease|increased|decreased|up|down)\s+of?\s*([0-9.]+)%\s*compared to the (?:previous month|\w+ \d{4})/i);
  const yoy = text.match(/([0-9.]+)%\s*(more|less|higher|lower|increase|greater) than the \w+ \d{4} total/i);

  const date = `${year}-${String(month).padStart(2, '0')}-01`;
  let momPct = mom ? parseFloat(mom[2]) : null;
  if (momPct != null && /decrease|down|lower/i.test(mom[1])) momPct = -momPct;

  let yoyPct = yoy ? parseFloat(yoy[1]) : null;
  if (yoyPct != null && /less|lower/i.test(yoy[2])) yoyPct = -yoyPct; // YoY can be a decline

  return { date, billings_usd_b: billions, mom_pct: momPct, yoy_pct: yoyPct };
}

async function fetchLatestBilling() {
  const index = await get(INDEX);
  const m = index.match(/href="(https:\/\/www\.semiconductors\.org\/global-semiconductor-sales[^"]+)"/i);
  if (!m) throw new Error('no global-semiconductor-sales slug found on index');
  const text = await get(m[1]);
  const parsed = parseBilling(text);
  if (!parsed) throw new Error('could not parse billing figures');
  return { ...parsed, url: m[1] };
}

module.exports = { fetchLatestBilling };
