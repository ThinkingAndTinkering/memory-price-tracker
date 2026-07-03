const { fetch } = require('undici');
const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Amazon product ASINs for representative memory products.
// Each target tracks multiple ASINs for redundancy (in case one goes OOS).
// We scrape the first available price and compute $/GB.
const TARGETS = [
  {
    type: 'DDR4',
    capacityGB: 16,
    asins: [
      'B015FXXBW0', // G.Skill Ripjaws V 16GB (2x8GB) DDR4-3200
      'B0143UM4TC', // Corsair Vengeance LPX 16GB (2x8GB) DDR4-3200
      'B08C56KXQJ', // Crucial Ballistix 16GB (2x8GB) DDR4-3200
    ],
  },
  {
    type: 'DDR5',
    capacityGB: 32,
    asins: [
      'B0CTHXMYL8', // Crucial Pro 32GB (2x16GB) DDR5-6000 CL36
      'B0BFGB2D2Z', // G.Skill Flare X5 32GB (2x16GB) DDR5-6000
      'B0BZHTVHN5', // Corsair Vengeance 32GB (2x16GB) DDR5-6000
    ],
  },
  {
    type: 'NAND',
    capacityGB: 1000,
    asins: [
      'B0BHJF2VRN', // Samsung 990 Pro 1TB NVMe
      'B0B25LQQPC', // WD Black SN850X 1TB NVMe (fallback if 990 Pro unavailable)
    ],
  },
];

async function scrapeAmazonPrice(asin) {
  const url = `https://www.amazon.com/dp/${asin}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract prices from .a-offscreen elements (Amazon's hidden price text)
  // Use median of first few prices for stability across sellers/variants
  const candidates = [];

  $('.a-price .a-offscreen').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/\$(\d{1,4}\.\d{2})/);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 10 && val <= 2000) candidates.push(val);
    }
  });

  if (candidates.length > 0) {
    // Take median of first 5 unique prices for stability
    const unique = [...new Set(candidates)].slice(0, 5).sort((a, b) => a - b);
    return unique[Math.floor(unique.length / 2)];
  }

  // Fallback: regex scan for dollar amounts
  const priceMatches = html.match(/\$(\d{1,4}\.\d{2})/g);
  if (priceMatches) {
    const fallback = priceMatches
      .map((m) => parseFloat(m.replace('$', '')))
      .filter((p) => p >= 10 && p <= 2000);
    if (fallback.length > 0) {
      const sorted = [...new Set(fallback)].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }
  }

  return null;
}

async function scrapeAllPrices() {
  const results = [];

  for (const target of TARGETS) {
    try {
      console.log(`  Scraping ${target.type} from Amazon...`);

      let price = null;

      // Try each ASIN until we get a price
      for (const asin of target.asins) {
        try {
          price = await scrapeAmazonPrice(asin);
          if (price) {
            console.log(`    ASIN ${asin}: $${price}`);
            break;
          }
        } catch (err) {
          console.warn(`    ASIN ${asin} failed: ${err.message}`);
        }
      }

      if (price) {
        const pricePerGb =
          Math.round((price / target.capacityGB) * 10000) / 10000;

        results.push({
          type: target.type,
          pricePerGb,
          rawPrice: price,
          source: 'amazon',
        });

        console.log(
          `    ${target.type}: $${price} / ${target.capacityGB}GB = $${pricePerGb}/GB`
        );
      } else {
        console.warn(`    No price found for ${target.type}`);
      }

      // Rate limit: wait 2s between product types to avoid blocks
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`    Error scraping ${target.type}:`, err.message);
    }
  }

  return results;
}

module.exports = { scrapeAllPrices };
