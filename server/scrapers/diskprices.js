// Lane 2 (NAND) — retail SSD $/GB from diskprices.com.
// Verified live: fully static server-rendered HTML, one <table id="diskprices">
// of ~3000 <tr class="disk"> rows. Each row carries data-product-type,
// data-condition and data-capacity (per-unit GB). Consumer NVMe = "m2_nvme".
// A browser User-Agent is required (literal "curl"/"undici" UA -> 403).
const { fetch } = require('undici');
const cheerio = require('cheerio');
const { USER_AGENT } = require('../config');

const URL = 'https://diskprices.com/?locale=us';
const num = (s) => parseFloat(String(s).replace(/[^0-9.]/g, ''));

// Mainstream consumer tiers we build the index from (per-unit GB).
const TIERS = [1000, 2000];
const N_CHEAPEST = 10; // median of the cheapest N $/GB across mainstream tiers

async function fetchNandPricePerGb() {
  const res = await fetch(URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const perGb = [];
  $('#diskprices tbody tr.disk, #diskprices tr.disk').each((_, el) => {
    const $r = $(el);
    if ($r.attr('data-product-type') !== 'm2_nvme') return; // consumer NVMe only
    if ($r.attr('data-condition') !== 'new') return;
    const capGB = parseFloat($r.attr('data-capacity'));
    if (!TIERS.some((t) => Math.abs(capGB - t) < 1e-6)) return;

    const capDisplay = $r.find('td').eq(3).text().trim();
    if (/[x×]\s*\d+|\d+\s*[x×]/i.test(capDisplay)) return; // drop multipacks (ASCII x or Unicode ×)

    let ppg = num($r.find('td.price-per-gb').text());
    if (!ppg || ppg <= 0) {
      const ppt = num($r.find('td.price-per-tb').text());
      if (ppt > 0) ppg = ppt / 1000;
    }
    if (ppg > 0.01 && ppg < 5) perGb.push(ppg); // sane bounds
  });

  if (perGb.length === 0) throw new Error('no NVMe rows parsed');

  perGb.sort((a, b) => a - b);
  const cheapest = perGb.slice(0, Math.min(N_CHEAPEST, perGb.length));
  const median = cheapest[Math.floor((cheapest.length - 1) / 2)];
  return { pricePerGb: Math.round(median * 10000) / 10000, sampleSize: perGb.length };
}

module.exports = { fetchNandPricePerGb };
