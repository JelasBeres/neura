// The lab core: data, costs, folds, gates and the trading loop, with no Node-only code so the same file also runs in a browser.
// harness.mjs adds the ledger on top. Every experiment runs through the same rules so results can be compared and trusted:
//  - the last LOCK_BARS (about three months) are sealed; they are opened once, only for an experiment that passed every dev gate
//  - the rest is walk-forward: calibrate on everything before a fold, test on the fold, four folds in a row (no look-ahead)
//  - costs are paid on every unit of turnover; Sharpe and returns are net of costs
//  - the hypothesis and gates are written to the ledger before the run, so targets cannot move after the fact
import { Plate, mulberry } from "../solver.mjs";
import { load } from "../lib/load.mjs";
// globalThis.NEURA_HIST swaps in another price file with the same shape (the live forward test uses live/hist-live.json)
const H = await load(globalThis.NEURA_HIST || "hist-1h.json");
export const SYMS = Object.keys(H), n = SYMS.length;
export const COST = 0.003, BARS_YR = 252 * 7, LOCK_BARS = 63 * 7, FOLDS = 4, FIRST_TRAIN = 0.4;
export const GATES = [
  ["beats hold on return", (s, h) => s.ret > h.ret],
  ["beats hold on Sharpe", (s, h) => s.sharpe > h.sharpe],
  ["drawdown no worse than hold", (s, h) => s.maxDD <= h.maxDD],
  ["wins at least 3 of 4 folds", (s, h, folds) => folds.filter((f) => f.win).length >= 3],
];

// one clock: the stock market's hourly bars; ETH is read at its last close at or before each bar
const clock = H.SPY.map((p) => p[0]);
const px = SYMS.map((s) => { const a = H[s]; let j = 0; return clock.map((t) => { while (j + 1 < a.length && a[j + 1][0] <= t) j++; return a[j][1]; }); });
export const T = clock.length, DEV = T - LOCK_BARS;
const ret = px.map((a) => a.map((v, t) => (t ? v / a[t - 1] - 1 : 0)));
export const ctx = { SYMS, n, T, clock, px, ret };

function corr(a, b, t0, t1) { let ma = 0, mb = 0; for (let t = t0; t < t1; t++) { ma += a[t]; mb += b[t]; } ma /= t1 - t0; mb /= t1 - t0; let c = 0, va = 0, vb = 0; for (let t = t0; t < t1; t++) { c += (a[t] - ma) * (b[t] - mb); va += (a[t] - ma) ** 2; vb += (b[t] - mb) ** 2; } return c / Math.sqrt(va * vb); }
// tubes between assets: each links to its three most correlated neighbours, measured on the training span only
export function linksFor(t0, t1) {
  const links = [], seen = new Set();
  for (let i = 0; i < n; i++) SYMS.map((_, j) => [j === i ? -2 : corr(ret[i], ret[j], t0 + 1, t1), j]).sort((a, b) => b[0] - a[0]).slice(0, 3)
    .forEach(([c, j]) => { const k = Math.min(i, j) + "," + Math.max(i, j); if (!seen.has(k)) { seen.add(k); links.push([i, j, 1 + (1 - c) * 2]); } });
  return links;
}
/** run an allocator over [t0, t1): weights chosen at bar t earn bar t+1; returns metrics and net per-bar returns */
export function run(alloc, t0, t1) {
  let eq = 1, w = new Array(n).fill(0), peak = 1, dd = 0, turn = 0; const r = [];
  for (let t = t0; t < t1 - 1; t++) {
    const nw = alloc(t, w); let to = 0; for (let k = 0; k < n; k++) to += Math.abs(nw[k] - w[k]);
    turn += to; w = nw; let g = 0; for (let k = 0; k < n; k++) g += w[k] * ret[k][t + 1];
    const net = (1 - to * COST) * (1 + g) - 1; eq *= 1 + net; r.push(net); peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak);
    const tot = w.reduce((a, x, k) => a + x * (1 + ret[k][t + 1]), 0) + (1 - w.reduce((a, x) => a + x, 0)); w = w.map((x, k) => (x * (1 + ret[k][t + 1])) / tot);
  }
  return { ...metrics(r), turnover: turn / (r.length / BARS_YR), r };
}
export function metrics(r) {
  let eq = 1, peak = 1, dd = 0; for (const x of r) { eq *= 1 + x; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const m = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length) || 1e-9;
  return { ret: eq - 1, sharpe: (m / sd) * Math.sqrt(BARS_YR), maxDD: dd };
}
// benchmarks
export const hold = () => { let first = true; const eqw = new Array(n).fill(1 / n); return (t, w) => (first ? ((first = false), eqw) : w); };
export const random = (seed = 3) => { const rng = mulberry(seed); let cur = null; return (t) => { if (!cur || t % 35 === 0) { const r = SYMS.map(() => rng()), s = r.reduce((a, b) => a + b, 0); cur = r.map((x) => x / s); } return cur; }; };
/** the Physarum allocator: food[t][k] feeds the plate; rebalances every `every` bars when weights moved more than `band` */
export function physarum(food, links, o) {
  const plate = new Plate(n, links, o);
  return (t, w) => { const s = plate.step(food[t]); return t % o.every === 0 && s.weights.reduce((a, x, k) => a + Math.abs(x - w[k]), 0) > o.band ? s.weights : w; };
}

