# Memory Price Monitor

## Purpose
A **market-literacy dashboard for the DRAM & NAND memory cycle**. It is not just a retail
price tracker — it fuses four free data lanes that sit at different points in the memory
cycle's information chain, teaches how they lead/lag each other, and rolls them into one
0–100 cycle-heat gauge (MPDI) plus a buy/wait signal for buyers and a cycle-position call
for investors.

Audience: **both** investors (memory cycle → Micron/SK Hynix/Samsung, AI supply chain) and
buyers (when is RAM/SSD cheap vs expensive). Strictly **free** data sources — no paid feeds.

## Tech stack
- **Backend**: Node.js + Express (port **3002**), SQLite via `sql.js` (file `prices.db`),
  `undici` (fetch) + `cheerio` (scraping), `node-cron` (daily scrape).
- **Frontend**: React 18 + Vite 6 (dev port **5173**, proxies `/api` → `:3002`) + Tailwind 3 +
  Recharts 2.15. Dark "market terminal" theme.
- In production the Express server also serves the built `client/dist` (single origin).

## The four data lanes (lead → lag)
| Lane | Role | Source (free) | Cadence | Table |
|------|------|---------------|---------|-------|
| **Equity basket** | LEADING (~6–9mo ahead) | Yahoo Finance v8 chart API | daily | `equity_quotes` |
| **Contract direction** | TRUTH ANCHOR (wholesale) | TrendForce Semiconductors RSS (auto-scraped QoQ %) | monthly/quarterly | `contract_events` |
| **Retail $/GB** | LAGGING confirmation | Newegg (DDR4/DDR5), diskprices.com (NAND) | daily | `prices` |
| **SIA billings** | BACKDROP (macro) | semiconductors.org / WSTS | monthly (~6wk lag) | `sia_billings` |

Why no contract *levels*: $/unit contract prices are TrendForce's paywalled product. We use
their free press-release **direction** (QoQ %) as the anchor instead.

## Directory structure
```
server/
  index.js            Express app; mounts /api/prices + /api (analytics); serves client/dist
  db.js               sql.js init + schema (prices, equity_quotes, contract_events, sia_billings) + query() helper
  config.js           EQUITY_BASKET constituents/weights + all composite/cycle/buyer tunables + USER_AGENT
  lib/analytics.js    THE BRAIN: equity index, MPDI composite, cycle position, buy/wait signal
  scrapers/
    index.js          orchestrator — runs every lane, each fails INDEPENDENTLY (fail-soft)
    yahoo.js          equity basket (browser UA required; no crumb; query1/query2 rotation; 429 backoff)
    diskprices.js     NAND $/GB (table#diskprices, tr.disk, data-product-type=m2_nvme, median of cheapest)
    newegg.js         DDR4/DDR5 $/GB (.item-cell/.price-current; challenge detection; fail-soft)
    trendforce.js     contract-direction auto-scraper — Semiconductors RSS → article QoQ extraction
    sia.js            monthly global billings (crawls press-release index → regex lead paragraph)
  routes/
    prices.js         legacy retail endpoints (/api/prices/{daily,weekly,monthly,latest})
    analytics.js      /api/{composite,cycle,equity,contract,sia,buy-signal,overview}
  seed/
    historical.js     interpolated retail $/GB history 2016–2026 (source='estimated')
    events.js         contract_events + sia_billings seed (verified TrendForce/SIA data)
  jobs/scheduler.js   node-cron daily scrape at midnight
client/src/
  components/  Dashboard, Hero, MpdiGauge, CompositeHistory, LaneCard, EquityLane,
               RetailLane, ContractLane, SiaLane, CycleMap, BuyerPanel, Glossary,
               PriceChart, PriceTable, MemoryTypeSelector, TimeRangeSelector
  hooks/       useApi (generic GET), usePriceData (retail pivot)
  lib/laneInfo.js   design tokens, lane copy, cycle-phase + glossary text
  utils/formatters.js
```

## How to run
```bash
npm install            # root deps; client deps already installed in client/node_modules
npm run seed           # seed estimated retail history + contract events + SIA billings
npm run scrape         # pull all 6 lanes once (equities, NAND, DDR, contract/TrendForce, billings)
npm run dev            # server (3002) + vite client (5173); open http://localhost:5173
# production-style: cd client && npm run build, then `npm run server`, open http://localhost:3002
```
Individual seeds: `npm run seed:prices`, `npm run seed:events`. One lane on demand:
`npm run scrape:trendforce`. The cron in `scheduler.js` runs `runAllScrapers()` daily at midnight.

## Methodology (defaults in `config.js`)
- **MPDI** (0–100 cycle-heat gauge): each lane's trailing-3-month momentum → z-score over a
  rolling 36 months → weighted blend `Z = 0.35·zEquity + 0.35·zContract + 0.20·zRetail +
  0.10·zSIA` (weights renormalized over lanes available that month) → `MPDI = 100/(1+e^-Z)`.
  50 = flat, >65 rising hard, <35 falling hard.
- **Equity index**: equal-weight (config weights) compounded daily returns, rebased to 100,
  FX-agnostic (each ticker's own-currency returns; FX never enters the basket). Samsung is
  down-weighted (0.4) as a conglomerate.
- **Cycle position** {boom|peak|bust|trough}: from gE (6mo equity %), gR (3mo retail %),
  c (3mo avg signed monthly-equivalent contract %), P (retail percentile in 36mo). Peak/trough
  checked before boom/bust so the equity-vs-price divergence at turns is caught.
- **Buy/wait**: per product, current $/GB percentile vs trailing 24mo + 3mo momentum.

## Key architectural decisions
- **Generalized the data model** beyond the original `prices` table: kept `prices` as the retail
  lane, added `equity_quotes` / `contract_events` / `sia_billings`. Composite/cycle are computed
  live in `analytics.js` (no cache table) — cheap enough at this data size.
- **Replaced the dead Amazon scraper.** The original `scrapers/pcpartpicker.js` actually scraped
  `amazon.com/dp/<ASIN>` and gets CAPTCHA/503 from datacenter IPs. Removed it; NAND now comes
  from diskprices.com (static HTML, robust) and DDR from Newegg listing pages.
- **Honesty about estimated data.** Pre-live retail history is interpolated from dated market
  anchors and is always `source='estimated'`; live scraped points (`newegg`/`diskprices`) overlay
  it and the UI marks estimated with `*`. The final 2026 estimated anchors are aligned to the live
  scrape values so the lines join without a visible jump.
- **Fail-soft scrapers.** Each lane in `runAllScrapers()` is wrapped independently; a blocked
  retail scrape never takes down the equity lane, and a failed retail scrape keeps the prior value.

## Data provenance (gathered + adversarially verified 2026-06-30 via a 10-agent research workflow)
- Yahoo v8 chart endpoint, all 9 candidate tickers, JSON paths, and the required browser-UA were
  live-verified. diskprices + Newegg parse plans were live-verified (static HTML, not JS-rendered).
- 2026 cycle state confirmed: severe AI-driven boom, **still rising but decelerating** (late-boom).
  Q1'26 conventional DRAM contract rose **~90–95% QoQ** (a record), Q2'26 +58–63% DRAM / +70–75%
  NAND (NAND outpacing DRAM first time). June-2026 retail ≈ DDR4 $8–9/GB, DDR5 $14/GB, NAND $0.12/GB.
  The seed's earlier "+50% QoQ" anchor was corrected upward.

## Current status
- ✅ All four lanes pull **live real data** locally; backend + analytics verified; client builds
  clean (665 modules); dashboard renders with **zero console errors** (Playwright-verified).
- ✅ Passed a 5-agent adversarial code review (analytics math, scrapers, React, data flow).
  Fixed bugs incl.: contract half-period sign inversion; Yahoo retry counter overloaded with the
  host-rotation seed (half the basket got 0 retries); SIA YoY sign on declines; Newegg per-module
  vs kit capacity; first-vs-last-per-period mismatch between the retail chart and the composite;
  `events.js` wiping live-scraped SIA rows on re-seed; equity-basket calendar dilution; contract
  staleness cap; buy-signal gating on thin history; gauge phantom-50 + a11y; null-safety guards.
- Live snapshot (2026-06-30): MPDI ≈ 74 (rising-hard), cycle **BOOM (strong)**, all products **WAIT**.

## Known issues / fragilities
- **Newegg** runs Akamai Bot Manager and **may challenge a datacenter/Render IP** even though it
  works locally; on challenge it fails soft (keeps prior value). Documented fallback if it breaks
  unattended: Amazon Product Advertising API (PA-API 5.0) over the existing ASINs, or a 2nd Newegg
  query. diskprices' only gate is a UA substring filter (we send a browser UA).
- **Contract lane auto-scrapes** the free TrendForce Semiconductors RSS (`/feed/Semiconductors.html`),
  fetches each memory-pricing article, and regex-extracts {product, direction, QoQ %, quarter}.
  Deliberately conservative split (`trendforce.js`): it OWNS the press-release **timeline**
  (`source='TrendForce-RSS'`, refreshed wholesale each run, deduped by URL in the UI), but only
  emits composite **rate-driver** rows (`kind='contract'`) for *clearly-conventional* DRAM/NAND
  figures — legacy/niche (DDR2/NOR/SLC/LPDDR/HBM) and ambiguous text stay display-only, because
  regex can't safely pick the representative commodity contract. The curated seed
  (`source='TrendForce'`) stays authoritative per `(month,product)`; the auto-scraper only fills
  quarters the seed lacks (see the dedup in `getContractMonthlyRate`). RSS is a rolling recent
  window, so deep history still comes from the seed. Regex extraction is best-effort — a Claude-Haiku
  extractor could be swapped in for higher accuracy if needed.
- Contract lane has **short history** (events from late-2025), so its z-score uses a relaxed
  ≥4-obs minimum and contributes only from ~2026; MPDI history before that is equity+retail(+sia).
- The legacy Amazon `source='scraped'` rows were purged from `prices.db`; re-seeding does not
  reintroduce them (seed only touches `source='estimated'`).
- Recharts makes the JS bundle ~593kB (gzip 170kB) — fine for this app; code-split if it matters.
- Not deployed yet. Render blueprint + a scheduled headless scrape are the obvious next step.

## Conventions
- $/GB everywhere for retail (NAND $/TB ÷ 1000). Never average raw $/GB across DRAM and NAND
  (scales differ ~100×) — rebase to an index first (see `compoundIndex`).
- Tunables live in `config.js`, not as magic numbers in `analytics.js`.
- Scrapers send a browser `User-Agent` (`config.USER_AGENT`) and time out via `AbortSignal`.
