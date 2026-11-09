import { load } from "../lib/load.mjs";
// The experiments of the league: what counts as food, and how the organism's choice becomes a portfolio.
// Hypotheses are fixed here before the league runs and copied into the ledger at registration.
const momentum = ({ T, n, px, ret }, look, sign = 1) => Array.from({ length: T }, (_, t) => Array.from({ length: n }, (_, k) => {
  if (t < look + 1) return 0; let s = 0; for (let u = t - look + 1; u <= t; u++) s += ret[k][u] ** 2;
  return (sign * Math.log(px[k][t] / px[k][t - look])) / (Math.sqrt(s) || 1);
}));
// EXP-002: net USDG buy flow in the asset's Robinhood Chain pool over the lookback, from data/flow-1h.json. An hourly bucket counts
// only once it has closed by the bar's close (bucket start <= bar start), so nothing from the future leaks in.
const FLOW = await load("flow-1h.json"), flowFood = ({ T, n, SYMS, clock }, look) => {
  const H = SYMS.map((s) => FLOW.hours[s] || []), out = Array.from({ length: T }, () => new Array(n).fill(0));
  H.forEach((rows, k) => { let lo = 0, hi = 0, B = 0, S = 0;
    for (let t = look; t < T; t++) { const end = clock[t], start = clock[t - look];
      while (hi < rows.length && rows[hi][0] <= end) { B += rows[hi][1]; S += rows[hi][2]; hi++; }
      while (lo < hi && rows[lo][0] <= start) { B -= rows[lo][1]; S -= rows[lo][2]; lo++; }
      out[t][k] = (3 * (B - S)) / (B + S + 500 * ((end - start) / 3600)); } });
  return out;
};
// EXP-003: GDELT daily news tone, from data/news-1d.json. At a bar only days that have fully ended count (yesterday and before);
// food is yesterday's tone against its own recent normal (z-score over the lookback, in trading days = bars / 7).
const NEWS = await load("news-1d.json"), newsFood = ({ T, n, SYMS, clock }, look) => {
  const days = Math.max(3, Math.round(look / 7)), out = Array.from({ length: T }, () => new Array(n).fill(0));
  SYMS.forEach((s, k) => { const rows = NEWS.days[s] || []; let j = 0;
    for (let t = 0; t < T; t++) { const today = Math.floor(clock[t] / 86400) * 86400; while (j < rows.length && rows[j][0] < today) j++;
      if (j < days + 1) continue; const y = rows[j - 1][1], prev = rows.slice(j - 1 - days, j - 1).map((r) => r[1]);
      const m = prev.reduce((a, b) => a + b, 0) / prev.length, sd = Math.sqrt(prev.reduce((a, b) => a + (b - m) ** 2, 0) / prev.length) || 1;
      out[t][k] = Math.max(-3, Math.min(3, (y - m) / sd)); } });
  return out;
};
// the first hour at which at least 3 of the 11 pools had traded: EXP-002 cannot start before its data exists. Only 7 pools traded at all
// before the holdout (SPY, QQQ, META, COIN opened later), so waiting for 8 would leave no window; pools with no swaps yet have zero food
const flowFrom = FLOW ? Object.values(FLOW.hours).map((r) => r[0]?.[0] ?? Infinity).sort((a, b) => a - b)[2] : null;
export const EXPS = {
  "EXP-001": { title: "Momentum as food", food: (c, p) => momentum(c, p.look), guard: false,
    foodText: "Risk-adjusted momentum: lookback return divided by volatility. Positive values are food.",
    hypothesis: "An organism that grows toward rising assets beats equal-weight hold after costs." },
  "EXP-002": { title: "On-chain flow as food", food: (c, p) => flowFood(c, p.look), guard: false, from: flowFrom,
    foodText: "Net USDG buying minus selling in each asset's Uniswap v3 pool on Robinhood Chain over the lookback, scaled by volume.",
    hypothesis: "Assets that on-chain traders are net buying are food; following real buy pressure beats equal-weight hold after costs. Swaps in these pools only began on 8 Jul 2026 and 4 of the 11 pools (SPY, QQQ, META, COIN) had no swaps before the sealed holdout, so the dev window is about 5 weeks (~140 bars, test folds of ~20 bars). Too short to conclude anything either way; this run checks the pipeline on real data." },
  "EXP-003": { title: "News as food", food: (c, p) => newsFood(c, p.look), guard: false,
    foodText: "GDELT news tone for each asset: yesterday's average tone compared with its own recent normal. Better-than-usual news is food.",
    hypothesis: "Assets whose news turned better than usual keep rising for the next days; feeding on that beats equal-weight hold after costs." },
  "EXP-004": { title: "Mean reversion as food", food: (c, p) => momentum(c, p.look, -1), guard: false,
    foodText: "The opposite of EXP-001: assets that fell the most relative to their volatility are the food.",
    hypothesis: "Hourly mega-cap moves reverse (EXP-001 failed for that reason), so feeding on recent losers beats hold after costs." },
  "EXP-005": { title: "Organism as risk guard", food: (c, p) => momentum(c, p.look), guard: true,
    foodText: "Momentum food, but the organism only decides how much to invest; whatever it invests is spread equally over all 11 assets.",
    hypothesis: "EXP-001's only success was a lower drawdown from resting in cash. Using the organism purely as an in/out switch keeps that and beats hold on Sharpe." },
  "EXP-006": { title: "Hold with a mean-reversion tilt", food: (c, p) => momentum(c, p.look, -1), guard: false, overlay: 0.3,
    foodText: "EXP-004's food (recent losers relative to their volatility), but the organism only steers 30% of the capital; 70% always sits in equal-weight hold. Checked for a rebalance at most once a day.",
    hypothesis: "EXP-004 had the only real edge (Fry beat hold on return, Sharpe and drawdown) but lost folds by sitting in cash while the market rallied. Keeping 70% in equal-weight hold and letting the organism steer 30% with the same food keeps up with rallies and beats hold after costs. Designed after seeing EXP-001 to EXP-005 on the same dev data; registered and run once, with no dry run." },
};

// Disclosed before registration: a DRY smoke run on the dev folds (no holdout) showed ants trading the noise of 200 sampled
// head counts (turnover ~90-130x a year). Fixed by trading the colony's expected choice. No setting or food was changed.
export const PREREG_NOTES = ["Ant colony trades its expected allocation (pheromone share) instead of sampled head counts; found in a dry smoke run on dev folds before registration."];
