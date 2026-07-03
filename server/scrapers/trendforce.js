// Lane 3 auto-scraper — TrendForce memory-pricing press releases.
// Pulls the free Semiconductors RSS feed, keyword-filters memory-pricing items, fetches each
// article, and extracts {product, direction, QoQ %, quarter} from the prose. Writes:
//   • the TIMELINE (kind 'outlook'/'spot') for every memory-pricing article — always safe,
//     this is what keeps Lane 3 fresh automatically.
//   • rate-driver rows (kind 'contract') ONLY for clearly-CONVENTIONAL DRAM / NAND figures
//     that carry a quarter tag. Legacy/niche (DDR2, DDR3, NOR, SLC, LPDDR, HBM, eMMC) and
//     anything ambiguous stays display-only, because regex can't safely tell the representative
//     commodity contract from a niche one — and the contract lane is the heaviest MPDI input.
// Everything written here uses source='TrendForce-RSS'; the curated seed (source='TrendForce')
// stays authoritative for the quarters it covers (see getContractMonthlyRate dedup).
const { fetch } = require('undici');
const cheerio = require('cheerio');
const { getDbPromise, saveDb } = require('../db');
const { USER_AGENT } = require('../config');

const RSS = 'https://www.trendforce.com/feed/Semiconductors.html';
const SOURCE = 'TrendForce-RSS';
const MAX_ARTICLES = 22;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Title must look like a memory-pricing story: a memory product AND an explicit pricing word
// (price/contract/spot). Loose words like "surge"/"shortage" alone let in non-pricing news
// (e.g. "NVIDIA Cuts Vera CPU Memory Configuration"), so we require a hard pricing term.
const PRICE_KEYWORDS = /\b(DRAM|NAND|DDR\d|LPDDR|NOR Flash|SLC|eMMC|UFS|HBM|memory|flash)\b/i;
const PRICE_CONTEXT = /\b(price|prices|pricing|contract|spot)\b/i;

async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseRss(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item').each((_, el) => {
    const $i = $(el);
    items.push({
      title: $i.find('title').first().text().trim(),
      link: $i.find('link').first().text().trim(),
      desc: $i.find('description').first().text().trim(),
      pubDate: $i.find('pubDate').first().text().trim(),
    });
  });
  return items;
}

function isoDate(pubDate) {
  const d = new Date(pubDate); // e.g. "Tue, 30 Jun 2026 15:53:01 +0800"
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// "2Q26" / "Q2 2026" -> quarter-start date 'YYYY-MM-01'
function quarterToDate(s) {
  let m = s.match(/\b([1-4])Q\s?(\d{2,4})\b/);
  let q, y;
  if (m) { q = +m[1]; y = +m[2]; }
  else {
    m = s.match(/\bQ([1-4])\s?(\d{4})\b/);
    if (!m) return null;
    q = +m[1]; y = +m[2];
  }
  if (y < 100) y += 2000;
  const month = (q - 1) * 3 + 1;
  return `${y}-${String(month).padStart(2, '0')}-01`;
}

function direction(s) {
  if (/\b(rise|rising|rose|increase|increasing|increased|climb|surge|surged|jump|jumped|grow|growing|higher|up)\b/i.test(s)) return 'up';
  if (/\b(fall|falling|fell|decline|declining|declined|drop|dropped|decrease|decreasing|lower|down|soften|softening)\b/i.test(s)) return 'down';
  return null;
}

// Signed midpoint % + the position just past it (range "55–60%" -> 57.5, single "40%" -> 40).
// Returns { val, end } or null. `end` lets the caller read the quarter that follows the figure.
function magnitude(s, dir) {
  const m = s.match(/(\d+(?:\.\d+)?)\s*[–\-~to]+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%/i);
  if (!m) return null;
  const val = m[1] != null ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : parseFloat(m[3]);
  return { val: dir === 'down' ? -val : val, end: m.index + m[0].length };
}

// Returns {label, family} — family in 'DRAM'|'NAND'|null. family != null => rate-eligible
// (clearly conventional commodity). Legacy/niche keep a display label but family=null.
function classify(s) {
  const legacy = /\b(DDR2|DDR3|NOR Flash|SLC|HBM|LPDDR|eMMC|UFS|mobile DRAM|graphics)\b/i.exec(s);
  if (/\bNAND\b/i.test(s) && !/\bSLC\b/i.test(s)) return { label: 'NAND', family: 'NAND' };
  if (/\bclient SSD|enterprise SSD\b/i.test(s)) return { label: 'NAND', family: 'NAND' };
  if (/\b(conventional DRAM|PC DRAM|server DRAM|DDR5|DDR4|DRAM contract|general DRAM)\b/i.test(s) && !legacy) {
    return { label: 'DRAM', family: 'DRAM' };
  }
  if (legacy) return { label: legacy[1].toUpperCase().replace(' FLASH', '').replace('MOBILE DRAM', 'LPDDR'), family: null };
  if (/\bDRAM\b/i.test(s)) return { label: 'DRAM', family: null }; // DRAM but not clearly conventional
  if (/\bmemory\b/i.test(s)) return { label: 'Memory', family: null };
  return { label: 'Memory', family: null };
}

function extractFromArticle(title, articleDate, text) {
  const events = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set();

  for (const sent of sentences) {
    if (!/%/.test(sent)) continue;
    const dir = direction(sent) || direction(title);
    if (dir == null) continue;
    const m = magnitude(sent, dir);
    if (m == null) continue;
    const mag = m.val;

    const cls = classify(sent + ' ' + title);
    // Prefer the quarter that FOLLOWS the figure ("rise 55-60% in 2Q26"), not an earlier
    // context quarter ("following gains in 1Q26, ... will rise ... in 2Q26").
    const qDate = quarterToDate(sent.slice(m.end)) || quarterToDate(sent);
    const isSpot = /\bspot\b/i.test(sent) || /\bspot\b/i.test(title);
    const isContract = /\bcontract\b/i.test(sent);

    let kind, date, period;
    if (isContract && qDate && cls.family) { kind = 'contract'; date = qDate; period = 'quarterly'; }
    else if (isSpot) { kind = 'spot'; date = articleDate; period = 'weekly'; }
    else { kind = 'outlook'; date = qDate || articleDate; period = qDate ? 'quarterly' : 'monthly'; }

    const key = `${date}|${cls.label}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ date, product: cls.label, direction: dir, magnitude_pct: Math.round(mag * 10) / 10, period, kind });
  }

  // Always surface the article itself in the timeline, even with no parseable figure.
  if (!events.length) {
    events.push({ date: articleDate, product: classify(title).label, direction: direction(title) || 'up', magnitude_pct: null, period: 'monthly', kind: 'outlook' });
  }
  return events;
}

async function scrapeTrendforce() {
  const db = await getDbPromise();
  let items;
  try {
    items = parseRss(await get(RSS));
  } catch (err) {
    console.warn('  [trendforce] RSS fetch failed:', err.message);
    return { success: false, error: err.message };
  }

  const matches = items
    .filter((it) => PRICE_KEYWORDS.test(it.title) && PRICE_CONTEXT.test(it.title))
    .slice(0, MAX_ARTICLES);
  console.log(`  [trendforce] ${items.length} RSS items, ${matches.length} memory-pricing`);

  const allEvents = [];
  for (const it of matches) {
    const articleDate = isoDate(it.pubDate);
    if (!articleDate) continue;
    try {
      const html = await get(it.link);
      const $ = cheerio.load(html);
      let text = $('article').text() || $('.news-detail, .content, main').text() || $('body').text();
      text = text.replace(/\s+/g, ' ').trim();
      const events = extractFromArticle(it.title, articleDate, text);
      for (const e of events) allEvents.push({ ...e, headline: it.title, url: it.link });
    } catch (err) {
      console.warn(`    article failed (${it.link}): ${err.message}`);
    }
    await sleep(700); // polite
  }

  // Replace this source's rows wholesale so re-runs stay clean.
  db.run('DELETE FROM contract_events WHERE source = ?', [SOURCE]);
  let inserted = 0;
  for (const e of allEvents) {
    db.run(
      'INSERT OR REPLACE INTO contract_events (date, product, direction, magnitude_pct, period, kind, source, headline, url) VALUES (?,?,?,?,?,?,?,?,?)',
      [e.date, e.product, e.direction, e.magnitude_pct, e.period, e.kind, SOURCE, e.headline, e.url]
    );
    inserted++;
  }
  saveDb();
  const contractRows = allEvents.filter((e) => e.kind === 'contract').length;
  console.log(`  [trendforce] inserted ${inserted} events (${contractRows} conventional contract figures)`);
  return { success: inserted > 0, events: inserted, contractFigures: contractRows };
}

if (require.main === module) {
  scrapeTrendforce().then((r) => console.log(JSON.stringify(r, null, 2))).catch(console.error);
} else {
  module.exports = { scrapeTrendforce, extractFromArticle, quarterToDate, classify };
}
