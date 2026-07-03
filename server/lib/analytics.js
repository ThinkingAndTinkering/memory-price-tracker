// The brain of the monitor: turns the four raw data lanes into the composite
// Memory Price Direction Index (MPDI), the cycle-position call, and the per-product
// buy/wait signal. Pure functions over the SQLite tables; no network.
//
// Methodology (defaults in config.js):
//   MPDI = 100 / (1 + exp(-k * Z)),  Z = Σ wᵢ·zᵢ over available lanes (weights renormalized)
//   where each lane's monthly momentum is z-scored over a rolling 36-month window.
//   Equity (leader) + contract (truth anchor) dominate; retail confirms; SIA is light.
const { query } = require('../db');
const { EQUITY_BASKET, COMPOSITE, CYCLE, BUYER } = require('../config');

// ---------- small stats helpers ----------
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const clip = (x, c) => Math.max(-c, Math.min(c, x));
const monthKey = (date) => String(date).slice(0, 7); // 'YYYY-MM'
const monthDate = (key) => `${key}-01`;

// All month keys from `first` to `last` inclusive (contiguous).
function monthRange(first, last) {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// Map {monthKey -> value} -> contiguous forward-filled array aligned to `months`.
function forwardFill(map, months) {
  const out = [];
  let last = null;
  for (const k of months) {
    if (map.has(k)) last = map.get(k);
    out.push(last);
  }
  return out;
}

// Compound an equal-weight index (=100 at first month) from one or more monthly
// level series, counting only series present in both the current and prior month.
function compoundIndex(levelMaps, months) {
  const idx = [];
  let val = 100;
  for (let i = 0; i < months.length; i++) {
    if (i > 0) {
      const rets = [];
      for (const map of levelMaps) {
        const cur = map.get(months[i]);
        const prev = map.get(months[i - 1]);
        if (cur != null && prev != null && prev > 0) rets.push(cur / prev - 1);
      }
      if (rets.length) val *= 1 + mean(rets);
    }
    idx.push(val);
  }
  return idx;
}

// ---------- Lane 1: equity basket ----------
// Daily equal-weight (config-weighted) index rebased to 100, FX-agnostic (uses each
// ticker's own-currency returns). Weights renormalize over tickers trading that day.
function buildDailyEquityIndex() {
  const rows = query('SELECT ticker, date, close FROM equity_quotes ORDER BY date ASC');
  if (!rows.length) return { series: [], constituents: [] };

  const byTicker = new Map(); // ticker -> Map(date->close)
  for (const r of rows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, new Map());
    byTicker.get(r.ticker).set(r.date, r.close);
  }
  const weightOf = new Map(EQUITY_BASKET.map((c) => [c.ticker, c.weight]));
  const tickers = [...byTicker.keys()].filter((t) => weightOf.has(t));

  const allDates = [...new Set(rows.map((r) => r.date))].sort();
  // forward-fill each ticker's close across the union calendar
  const filled = new Map();
  for (const t of tickers) {
    const src = byTicker.get(t);
    let last = null;
    const arr = allDates.map((d) => {
      if (src.has(d)) last = src.get(d);
      return last;
    });
    filled.set(t, arr);
  }

  const series = [];
  let val = 100;
  for (let i = 0; i < allDates.length; i++) {
    if (i > 0) {
      let wRet = 0;
      let wSum = 0;
      for (const t of tickers) {
        // Only count a ticker on days it ACTUALLY traded — otherwise a forward-filled
        // (market-closed) day contributes a fake 0% return that dilutes the real movers
        // whenever the KRW/TWD/JPY/USD calendars diverge.
        if (!byTicker.get(t).has(allDates[i])) continue;
        const cur = filled.get(t)[i];
        const prev = filled.get(t)[i - 1];
        if (cur != null && prev != null && prev > 0) {
          const w = weightOf.get(t);
          wRet += w * (cur / prev - 1);
          wSum += w;
        }
      }
      if (wSum > 0) val *= 1 + wRet / wSum;
    }
    series.push({ date: allDates[i], value: Math.round(val * 100) / 100 });
  }
  const constituents = EQUITY_BASKET.filter((c) => byTicker.has(c.ticker)).map((c) => ({
    ...c,
    obs: byTicker.get(c.ticker).size,
  }));
  return { series, constituents };
}

// month-end (last obs per month) of a [{date,value}] series -> Map(monthKey->value)
function toMonthly(series) {
  const m = new Map();
  for (const p of series) m.set(monthKey(p.date), p.value); // ascending -> last wins
  return m;
}

// ---------- Lane 2: retail ----------
function getRetailMonthlyByType() {
  const rows = query('SELECT memory_type, date, price_per_gb FROM prices ORDER BY date ASC');
  const byType = { DDR4: new Map(), DDR5: new Map(), NAND: new Map() };
  for (const r of rows) {
    if (byType[r.memory_type]) byType[r.memory_type].set(monthKey(r.date), r.price_per_gb);
  }
  return byType;
}

// ---------- Lane 3: contract events -> signed monthly-equivalent % series ----------
// QoQ headline % -> monthly-equivalent compounded %: ((1+q)^(1/3) - 1).
function getContractMonthlyRate(months) {
  const rows = query(
    "SELECT date, product, magnitude_pct, period, source FROM contract_events WHERE kind = 'contract' AND magnitude_pct IS NOT NULL ORDER BY date ASC"
  );
  // Dedup per (month, product): the curated seed (source != 'TrendForce-RSS') is authoritative
  // for the quarters it covers; the auto-scraper only fills (month, product) the seed lacks.
  const byKey = new Map(); // `${month}|${product}` -> { rate(%/mo), month, seed }
  for (const r of rows) {
    const q = r.magnitude_pct / 100;
    let monthlyEq;
    if (r.period === 'monthly') monthlyEq = q;
    else if (r.period === 'half') monthlyEq = Math.sign(1 + q) * (Math.abs(1 + q) ** (1 / 6) - 1);
    else monthlyEq = Math.sign(1 + q) * (Math.abs(1 + q) ** (1 / 3) - 1); // quarterly default
    const month = monthKey(r.date);
    const key = `${month}|${r.product}`;
    const seed = r.source !== 'TrendForce-RSS';
    const prev = byKey.get(key);
    if (!prev || (seed && !prev.seed)) byKey.set(key, { rate: monthlyEq * 100, month, seed });
  }
  // average the (deduped) per-product rates within each month
  const byMonth = new Map();
  for (const { rate, month } of byKey.values()) {
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(rate);
  }
  const rateMap = new Map([...byMonth].map(([k, v]) => [k, mean(v)]));
  const filled = forwardFill(rateMap, months); // %/month, forward-filled across the quarter
  // Staleness cap: a quarterly settlement applies for ~3 months. Beyond that we emit null
  // so the contract lane drops OUT of the renormalized weighted-Z blend rather than asserting
  // an old QoQ rate as live momentum if data collection ever lapses.
  const keys = [...rateMap.keys()].sort();
  const lastKey = keys[keys.length - 1];
  if (!lastKey) return filled;
  return months.map((m, i) => (monthsApart(lastKey, m) > 3 ? null : filled[i]));
}

// signed month difference b - a for 'YYYY-MM' keys
function monthsApart(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ---------- Lane 4: SIA billings ----------
function getSiaMonthly() {
  const rows = query('SELECT date, billings_usd_b FROM sia_billings ORDER BY date ASC');
  const m = new Map();
  for (const r of rows) m.set(monthKey(r.date), r.billings_usd_b);
  return m;
}

// trailing log-momentum over `n` months on a contiguous filled array
function logMomentum(arr, n) {
  return arr.map((v, i) => {
    const p = arr[i - n];
    if (v == null || p == null || p <= 0 || v <= 0) return null;
    return Math.log(v / p);
  });
}

// rolling z-score of a momentum series over trailing `win` (expanding until >=minObs)
function rollingZ(mom, win, minObs, clipC) {
  return mom.map((v, i) => {
    if (v == null) return null;
    const hist = [];
    for (let j = Math.max(0, i - win + 1); j <= i; j++) if (mom[j] != null) hist.push(mom[j]);
    if (hist.length < minObs) return null;
    const s = std(hist);
    if (s === 0) return 0;
    return clip((v - mean(hist)) / s, clipC);
  });
}

// ---------- Composite MPDI ----------
function computeComposite() {
  const eq = buildDailyEquityIndex();
  const eqMonthly = toMonthly(eq.series);
  const retailByType = getRetailMonthlyByType();
  const sia = getSiaMonthly();

  // month range: from when the equity + retail lanes both have data
  const starts = [];
  if (eqMonthly.size) starts.push([...eqMonthly.keys()].sort()[0]);
  const retailKeys = [
    ...retailByType.DDR4.keys(), ...retailByType.DDR5.keys(), ...retailByType.NAND.keys(),
  ].sort();
  if (retailKeys.length) starts.push(retailKeys[0]);
  if (!starts.length) return { series: [], latest: null };
  const start = starts.sort().reverse()[0]; // later of the two starts
  const allEnds = [
    eqMonthly.size ? [...eqMonthly.keys()].sort().pop() : start,
    retailKeys.length ? retailKeys[retailKeys.length - 1] : start,
  ];
  const end = allEnds.sort().pop();
  const months = monthRange(start, end);

  // build contiguous filled level arrays
  const eqArr = forwardFill(eqMonthly, months);
  const retailComposite = compoundIndex(
    [retailByType.DDR4, retailByType.DDR5, retailByType.NAND],
    months
  );
  const siaArr = forwardFill(sia, months);
  const contractRate = getContractMonthlyRate(months); // %/month, signed

  // per-lane momentum
  const n = COMPOSITE.momentumMonths;
  const mE = logMomentum(eqArr, n);
  const mR = logMomentum(retailComposite, n);
  const mS = logMomentum(siaArr, n);
  const mC = contractRate.map((r) => (r == null ? null : (n * r) / 100)); // 3-month basis

  // z-scores
  const { zWindowMonths: W, minObs, zClip } = COMPOSITE;
  const zE = rollingZ(mE, W, minObs, zClip);
  const zR = rollingZ(mR, W, minObs, zClip);
  const zS = rollingZ(mS, W, minObs, zClip);
  const zC = rollingZ(mC, W, Math.min(minObs, 4), zClip); // contract lane is young; allow >=4 obs

  const w = COMPOSITE.weights;
  const lanes = [
    ['equity', zE, w.equity],
    ['contract', zC, w.contract],
    ['retail', zR, w.retail],
    ['sia', zS, w.sia],
  ];

  const series = [];
  for (let i = 0; i < months.length; i++) {
    let wz = 0;
    let wsum = 0;
    const z = {};
    for (const [name, arr, weight] of lanes) {
      z[name] = arr[i];
      if (arr[i] != null) { wz += weight * arr[i]; wsum += weight; }
    }
    if (wsum === 0) continue; // need at least one lane
    const Z = wz / wsum;
    const mpdi = 100 / (1 + Math.exp(-COMPOSITE.logisticK * Z));
    series.push({
      date: monthDate(months[i]),
      mpdi: Math.round(mpdi * 10) / 10,
      zEquity: round2(z.equity), zContract: round2(z.contract),
      zRetail: round2(z.retail), zSIA: round2(z.sia),
      lanesUsed: wsum / Object.values(w).reduce((a, b) => a + b, 0),
    });
  }

  const latest = series.length ? series[series.length - 1] : null;
  let summary = null;
  if (latest) {
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const delta = prev ? Math.round((latest.mpdi - prev.mpdi) * 10) / 10 : 0;
    summary = { mpdi: latest.mpdi, delta_mom: delta, zone: zoneOf(latest.mpdi), headline: headlineOf(latest.mpdi, delta), date: latest.date };
  }
  return { series, latest: summary };
}

function zoneOf(m) {
  if (m < 35) return 'falling-hard';
  if (m < 45) return 'cooling';
  if (m <= 55) return 'flat';
  if (m <= 65) return 'warming';
  return 'rising-hard';
}
function headlineOf(m, delta) {
  const dir = m > 55 ? 'RISING — memory getting more expensive'
    : m < 45 ? 'FALLING — memory getting cheaper'
    : 'FLAT — memory prices steady';
  const sign = delta > 0 ? '+' : '';
  return `${dir} (MPDI ${Math.round(m)}, ${sign}${delta} MoM)`;
}
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// ---------- Cycle position ----------
function percentileRank(arr, value) {
  const valid = arr.filter((x) => x != null);
  if (!valid.length) return null;
  const le = valid.filter((x) => x <= value).length;
  return Math.round((100 * le) / valid.length);
}

function computeCycle() {
  const eqMonthly = toMonthly(buildDailyEquityIndex().series);
  const retailByType = getRetailMonthlyByType();
  if (!eqMonthly.size) return null;

  const start = [...eqMonthly.keys()].sort()[0];
  const end = [...eqMonthly.keys()].sort().pop();
  const months = monthRange(start, end);
  const eqArr = forwardFill(eqMonthly, months);
  const retailComposite = compoundIndex(
    [retailByType.DDR4, retailByType.DDR5, retailByType.NAND],
    months
  );
  const contractRate = getContractMonthlyRate(months);

  const i = months.length - 1;
  const gE = pctChange(eqArr, i, CYCLE.equityLookbackMonths);
  const gR = pctChange(retailComposite, i, CYCLE.retailLookbackMonths);
  const cArr = contractRate.slice(Math.max(0, i - CYCLE.contractLookbackMonths + 1), i + 1).filter((x) => x != null);
  const c = cArr.length ? mean(cArr) : 0; // %/month
  const window = retailComposite.slice(Math.max(0, i - CYCLE.percentileWindowMonths + 1), i + 1);
  const P = percentileRank(window, retailComposite[i]);

  // flat bands
  const f = CYCLE.flat;
  const gEf = Math.abs(gE) < f.equity ? 0 : gE;
  const gRf = Math.abs(gR) < f.retail ? 0 : gR;
  const cf = Math.abs(c) < f.contract ? 0 : c;

  // Turns (peak/trough) are checked before trends so the leading-equity-vs-price divergence
  // is caught. The bust/boom confirmation lanes are deliberately asymmetric: a DOWN-cycle
  // shows up in retail $/GB first (channel discounting), while an UP-cycle shows up in the
  // leading equities first — so bust requires retail confirmation and boom requires equity.
  let phase;
  if (P >= 70 && gEf < -f.equity) phase = 'peak';
  else if (P <= 30 && gEf > f.equity) phase = 'trough';
  else if (cf < -f.contract && gRf < -f.retail) phase = 'bust';
  else if (cf > f.contract && gEf > f.equity) phase = 'boom';
  else phase = mpdiFallbackPhase(P);

  const strong = Math.abs(gE) > CYCLE.strong.equity || Math.abs(c) > CYCLE.strong.contract;
  return {
    phase,
    strength: strong ? 'strong' : 'mild',
    inputs: {
      gE: round3(gE), gR: round3(gR), c: round2(c), P,
      equityLabel: `${(gE * 100).toFixed(1)}% / ${CYCLE.equityLookbackMonths}mo`,
      retailLabel: `${(gR * 100).toFixed(1)}% / ${CYCLE.retailLookbackMonths}mo`,
      contractLabel: `${c >= 0 ? '+' : ''}${c.toFixed(1)}%/mo`,
      percentileLabel: `${P}th pct of ${CYCLE.percentileWindowMonths}mo`,
    },
  };
}
function mpdiFallbackPhase(P) {
  return P != null && P < 50 ? 'trough' : 'peak';
}
function pctChange(arr, i, n) {
  const cur = arr[i];
  const prev = arr[i - n];
  if (cur == null || prev == null || prev === 0) return 0;
  return cur / prev - 1;
}
const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------- Buyer buy/wait signal ----------
function computeBuySignal() {
  const retailByType = getRetailMonthlyByType();
  const out = [];
  for (const product of ['DDR4', 'DDR5', 'NAND']) {
    const map = retailByType[product];
    if (!map.size) continue;
    const keys = [...map.keys()].sort();
    const months = monthRange(keys[0], keys[keys.length - 1]);
    const arr = forwardFill(map, months);
    const i = arr.length - 1;
    const current = arr[i];
    if (current == null) continue;

    const win = arr.slice(Math.max(0, i - BUYER.percentileWindowMonths + 1), i + 1).filter((x) => x != null);
    const enoughHistory = win.length >= 12;
    const P24 = percentileRank(win, current);
    const d3 = pctChange(arr, i, BUYER.momentumMonths);
    const fairRef = median(win);
    const headroom = fairRef ? current / fairRef - 1 : 0;

    out.push({
      product,
      current_per_gb: Math.round(current * 10000) / 10000,
      P24,
      d3: round3(d3),
      fair_ref: fairRef ? Math.round(fairRef * 10000) / 10000 : null,
      headroom: round3(headroom),
      // Don't issue a firm BUY/WAIT off a tiny window — percentile is meaningless then.
      verdict: enoughHistory ? buyVerdict(P24, d3) : { tier: 'UNKNOWN', label: 'Not enough history yet' },
      enoughHistory,
    });
  }
  return out;
}
function buyVerdict(P24, d3) {
  if (P24 == null) return { tier: 'UNKNOWN', label: 'Not enough history' };
  const rising = d3 > BUYER.flatBand;
  const falling = d3 < -BUYER.flatBand;
  let tier;
  if (P24 <= 20) tier = 'BUY';
  else if (P24 <= 40) tier = 'LEAN BUY';
  else if (P24 <= 60) tier = 'FAIR';
  else if (P24 <= 80) tier = 'LEAN WAIT';
  else tier = 'WAIT';

  const cheap = tier === 'BUY' || tier === 'LEAN BUY';
  const pricey = tier === 'WAIT' || tier === 'LEAN WAIT';
  let label;
  if (cheap && rising) label = 'Cheap but turning up — window closing';
  else if (cheap && falling) label = 'Cheap and still easing — no urgency';
  else if (cheap) label = 'Near 2-yr lows — a reasonable entry';
  else if (pricey && falling) label = 'Expensive but easing — better prices likely';
  else if (pricey && rising) label = 'Expensive and climbing — buy only if you must';
  else if (pricey) label = 'Near 2-yr highs and holding — little reason to rush';
  else label = 'Fair — buy on need, not on price';
  return { tier, label };
}

module.exports = {
  buildDailyEquityIndex,
  computeComposite,
  computeCycle,
  computeBuySignal,
};
