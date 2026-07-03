// Lane 2 (DRAM) — retail DDR4/DDR5 $/GB from Newegg listing pages.
// Verified live: static HTML listing, ~48 .item-cell modules per page; price split
// across .price-current strong (dollars) + sup (.cents); capacity + DDR type in the
// .item-title. We take the page-median $/GB for stability across the SKU set.
// Newegg runs Akamai Bot Manager and MAY challenge datacenter IPs — this scraper
// fails soft (returns null) so the caller keeps the prior/estimated value instead.
const { fetch } = require('undici');
const cheerio = require('cheerio');
const { USER_AGENT } = require('../config');

const QUERIES = {
  DDR4: 'https://www.newegg.com/p/pl?d=DDR4+desktop+memory&PageSize=96',
  DDR5: 'https://www.newegg.com/p/pl?d=DDR5+desktop+memory&PageSize=96',
};

async function scrapeNeweggType(type) {
  const res = await fetch(QUERIES[type], {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.newegg.com/',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (/are you a human|access denied|just a moment/i.test(html.slice(0, 5000))) {
    throw new Error('newegg_challenge'); // bot wall — fail soft
  }

  const $ = cheerio.load(html);
  const perGb = [];
  $('.item-cell').each((_, el) => {
    const title = $(el).find('.item-title').text().trim();
    if (!title) return;
    const t = /DDR5/i.test(title) ? 'DDR5' : /DDR4/i.test(title) ? 'DDR4' : null;
    if (t !== type) return;

    const dollars = $(el).find('.price-current strong').first().text().replace(/,/g, '');
    const cents = $(el).find('.price-current sup').first().text().replace(/[^.\d]/g, '');
    if (!dollars) return; // sponsored tiles have no price
    const price = parseFloat(dollars + (cents || ''));

    // Kit-aware capacity: prefer the explicit "(N x MGB)" kit form so we get the TOTAL,
    // not the per-module size; otherwise fall back to the largest GB number in the title
    // (the total) rather than the first, which may be a single stick.
    let cap = null;
    const kit = title.match(/\((\d+)\s*x\s*(\d+)\s*GB\)/i);
    if (kit) {
      cap = parseInt(kit[1], 10) * parseInt(kit[2], 10);
    } else {
      const all = [...title.matchAll(/(\d+)\s*GB/gi)].map((x) => parseInt(x[1], 10));
      if (all.length) cap = Math.max(...all);
    }
    if (cap >= 4 && cap <= 256 && price >= 10 && price <= 2000) perGb.push(price / cap);
  });

  if (perGb.length < 5) throw new Error(`too few modules (${perGb.length})`);
  perGb.sort((a, b) => a - b);
  const median = perGb[Math.floor(perGb.length / 2)];
  return { pricePerGb: Math.round(median * 10000) / 10000, sampleSize: perGb.length };
}

module.exports = { scrapeNeweggType };
