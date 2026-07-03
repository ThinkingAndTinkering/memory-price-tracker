// Central configuration for the memory-price monitor.
// Tunable constants live here rather than being scattered as magic numbers.

// ---- Lane 1: memory-maker equity basket (the LEADING signal) ----
// Weights tilt toward memory-pure names; Samsung is down-weighted because memory
// is only one slice of the conglomerate (per the research methodology caveat).
// All math uses each ticker's OWN-currency returns, so mixing KRW/TWD/JPY/USD is
// fine — daily returns are unitless and FX never enters the basket.
const EQUITY_BASKET = [
  { ticker: 'MU', name: 'Micron', country: 'US', segment: 'DRAM+NAND', weight: 1.0 },
  { ticker: '000660.KS', name: 'SK Hynix', country: 'KR', segment: 'DRAM+NAND+HBM', weight: 1.0 },
  { ticker: '005930.KS', name: 'Samsung', country: 'KR', segment: 'DRAM+NAND (conglomerate)', weight: 0.4 },
  { ticker: '2408.TW', name: 'Nanya', country: 'TW', segment: 'DRAM', weight: 0.7 },
  { ticker: '285A.T', name: 'Kioxia', country: 'JP', segment: 'NAND', weight: 0.7 },
  { ticker: 'SNDK', name: 'Sandisk', country: 'US', segment: 'NAND', weight: 0.7 },
];

// ---- Composite (MPDI) + cycle tunables ----
const COMPOSITE = {
  // weighted z-score blend: leader + truth-anchor dominate, retail confirms, billings light
  weights: { equity: 0.35, contract: 0.35, retail: 0.20, sia: 0.10 },
  momentumMonths: 3, // trailing window for per-lane momentum
  zWindowMonths: 36, // rolling window for standardization / percentile (~one memory cycle)
  zClip: 3, // clip z-scores to [-clip, +clip]
  logisticK: 1.0, // steepness of the 0-100 logistic squash
  minObs: 12, // require >= this many monthly obs before showing a live gauge
};

const CYCLE = {
  equityLookbackMonths: 6, // gE
  retailLookbackMonths: 3, // gR
  contractLookbackMonths: 3, // c (avg signed monthly-equivalent contract %)
  percentileWindowMonths: 36, // P
  flat: { equity: 0.03, retail: 0.02, contract: 1.0 }, // |gE|<3%, |gR|<2%, |c|<1%/mo => treat as 0
  strong: { equity: 0.15, contract: 3.0 }, // |gE|>15% or |c|>3%/mo => STRONG
};

const BUYER = {
  percentileWindowMonths: 24, // P24 over trailing 2 years
  momentumMonths: 3, // d3
  flatBand: 0.02, // |d3| < 2% => flat
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = { EQUITY_BASKET, COMPOSITE, CYCLE, BUYER, USER_AGENT };
