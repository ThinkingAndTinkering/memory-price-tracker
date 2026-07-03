// Shared design tokens + editorial copy for the market-literacy dashboard.

export const TYPE_COLORS = { DDR4: '#60a5fa', DDR5: '#a78bfa', NAND: '#34d399' };

// The four data lanes, ordered by where they sit in the information chain.
export const LANES = {
  equity: {
    tag: 'LEADING',
    tagColor: '#fbbf24',
    title: 'Memory-Maker Equity Basket',
    explainer:
      'Memory-maker stocks move 6–9 months ahead of prices — investors bet on supply discipline and the next up/down-cycle before it hits the financials. Treat this lane as the early-warning siren, not today’s price.',
  },
  retail: {
    tag: 'LAGGING',
    tagColor: '#60a5fa',
    title: 'Retail $/GB — DDR4 · DDR5 · NAND',
    explainer:
      'What you actually pay at retail. It lags wholesale by weeks-to-months because shops sell through inventory bought at older prices and smooth their margins — confirmation, not a forecast.',
  },
  contract: {
    tag: 'TRUTH ANCHOR',
    tagColor: '#34d399',
    title: 'Contract-Price Direction',
    explainer:
      'The monthly wholesale price negotiated in bulk between makers and big OEMs — the closest thing to ground truth for where the cycle actually is. (Spot price is daily, small-lot and noisy; contract is monthly, bulk, and sets the real trend — we anchor on contract.)',
  },
  sia: {
    tag: 'BACKDROP',
    tagColor: '#94a3b8',
    title: 'Global Semiconductor Billings (SIA)',
    explainer:
      'Total global chip sales (3-month average). Not memory-specific and smoothed/lagging — it’s the industry weather that tells you whether memory’s move is part of a broader up- or down-cycle.',
  },
};

export const CYCLE_PHASES = {
  boom: {
    label: 'Boom',
    color: '#10b981',
    blurb: 'Contract prices rising and maker stocks leading higher — the up-cycle is underway.',
  },
  peak: {
    label: 'Peak',
    color: '#f59e0b',
    blurb: 'Prices near cycle highs, but the leading stocks have already rolled over — late innings.',
  },
  bust: {
    label: 'Bust',
    color: '#ef4444',
    blurb: 'Contract prices falling and retail confirming the fall — the down-cycle.',
  },
  trough: {
    label: 'Trough',
    color: '#38bdf8',
    blurb: 'Prices near cycle lows, but maker stocks have already turned up — the bottom may be in.',
  },
};

// MPDI gauge color by 0-100 level.
export function mpdiColor(m) {
  if (m == null) return '#64748b';
  if (m < 35) return '#3b82f6'; // cold / falling hard
  if (m < 45) return '#38bdf8';
  if (m <= 55) return '#94a3b8'; // flat
  if (m <= 65) return '#f59e0b'; // warming
  return '#ef4444'; // rising hard
}

export const BUY_TIER_COLORS = {
  BUY: '#10b981',
  'LEAN BUY': '#34d399',
  FAIR: '#94a3b8',
  'LEAN WAIT': '#f59e0b',
  WAIT: '#ef4444',
  UNKNOWN: '#64748b',
};

export const GLOSSARY = [
  {
    term: 'Spot vs. contract price',
    body: 'Spot is the daily open-market price for small lots — fast and volatile. Contract is the monthly price big OEMs negotiate in bulk; it sets ~90% of makers’ revenue and is the real trend. This monitor anchors on contract direction.',
  },
  {
    term: 'The lead–lag chain',
    body: 'Maker equities lead (investors price the cycle early) → contract settlements are ground truth for now → retail $/GB lags (channel inventory) → billings confirm the macro backdrop. Reading them together is the whole point.',
  },
  {
    term: 'MPDI (Memory Price Direction Index)',
    body: 'A 0–100 cycle-heat gauge. Each lane’s 3-month momentum is z-scored over a rolling 36 months, blended (equity 0.35, contract 0.35, retail 0.20, billings 0.10) and squashed through a logistic curve. 50 = flat; >65 = rising hard; <35 = falling hard.',
  },
  {
    term: 'Cycle position',
    body: 'Boom / Peak / Bust / Trough — inferred from the divergence between the leading equity basket and the price level. At a true peak the stocks are already falling while prices are still high; at a trough the stocks turn up while prices are still cheap.',
  },
  {
    term: 'Buy / Wait signal',
    body: 'For each product, today’s $/GB is ranked against its trailing 24 months (percentile) and combined with 3-month momentum. Near 2-year lows → BUY; near 2-year highs → WAIT; the momentum tweak distinguishes “cheap and still falling” from “cheap but turning up”.',
  },
];

export const SOURCES = [
  { name: 'Yahoo Finance (equities)', note: 'free chart API — MU, SK Hynix, Samsung, Nanya, Kioxia, Sandisk' },
  { name: 'diskprices.com (NAND $/GB)', note: 'mainstream NVMe, median of cheapest drives' },
  { name: 'Newegg (DDR4/DDR5 $/GB)', note: 'listing-page median' },
  { name: 'TrendForce press releases', note: 'contract-price direction (QoQ)' },
  { name: 'SIA / WSTS', note: 'monthly global semiconductor billings' },
];
