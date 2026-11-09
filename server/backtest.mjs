// node server/backtest.mjs: calibrate the Physarum plate on the first 70% of two years of hourly bars, then test it on the last 30%.
// Benchmarks on the same bars and costs: equal-weight hold, random allocation, and plain momentum (top 3 by the same nutrient).
import fs from "node:fs";
import { Plate, mulberry } from "./solver.mjs";
const H = JSON.parse(fs.readFileSync(new URL("../data/hist-1h.json", import.meta.url)));
const SYMS = Object.keys(H), n = SYMS.length, COST = 0.003, BARS_YR = 252 * 7;

// one clock: the stock market's hourly bars; ETH is read at the last close at or before each bar
const clock = H.SPY.map((p) => p[0]);
const px = SYMS.map((s) => { const a = H[s]; let j = 0; return clock.map((t) => { while (j + 1 < a.length && a[j + 1][0] <= t) j++; return a[j][1]; }); });
const T = clock.length, split = Math.floor(T * 0.7);
const ret = px.map((a) => a.map((v, t) => (t ? v / a[t - 1] - 1 : 0)));

// tubes between assets: each asset links to its three most correlated neighbours (from the training half only), longer when less alike
function corr(a, b, t0, t1) { let ma = 0, mb = 0; for (let t = t0; t < t1; t++) { ma += a[t]; mb += b[t]; } ma /= t1 - t0; mb /= t1 - t0; let c = 0, va = 0, vb = 0; for (let t = t0; t < t1; t++) { c += (a[t] - ma) * (b[t] - mb); va += (a[t] - ma) ** 2; vb += (b[t] - mb) ** 2; } return c / Math.sqrt(va * vb); }
const C = SYMS.map((_, i) => SYMS.map((_, j) => (i === j ? 1 : corr(ret[i], ret[j], 1, split))));
const links = []; const seen = new Set();
for (let i = 0; i < n; i++) C[i].map((c, j) => [c, j]).filter(([, j]) => j !== i).sort((a, b) => b[0] - a[0]).slice(0, 3).forEach(([c, j]) => { const k = [Math.min(i, j), Math.max(i, j)].join(); if (!seen.has(k)) { seen.add(k); links.push([i, j, 1 + (1 - c) * 2]); } });

// nutrient: risk-adjusted momentum, the lookback return in units of its own volatility
function nutrients(look) {
  return Array.from({ length: T }, (_, t) => SYMS.map((_, k) => {
    if (t < look + 1) return 0; let s = 0; for (let u = t - look + 1; u <= t; u++) s += ret[k][u] ** 2;
    const sd = Math.sqrt(s / look) * Math.sqrt(look) || 1; return Math.log(px[k][t] / px[k][t - look]) / sd;
  }));
}
// run an allocator over [t0, t1): weights decided at bar t earn bar t+1's return; turnover pays COST
function run(alloc, t0, t1) {
  let eq = 1, w = new Array(n).fill(0), peak = 1, dd = 0, turn = 0; const r = [];
  for (let t = t0; t < t1 - 1; t++) {
    const nw = alloc(t, w); let to = 0; for (let k = 0; k < n; k++) to += Math.abs(nw[k] - w[k]);
    eq *= 1 - to * COST; turn += to; w = nw;
    let g = 0; for (let k = 0; k < n; k++) g += w[k] * ret[k][t + 1];
    eq *= 1 + g; r.push((1 - to * COST) * (1 + g) - 1); peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak);
    // weights drift with prices until the next rebalance
    const tot = w.reduce((a, b, k) => a + b * (1 + ret[k][t + 1]), 0) + (1 - w.reduce((a, b) => a + b, 0)); w = w.map((x, k) => (x * (1 + ret[k][t + 1])) / tot);
  }
  const m = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
  return { ret: eq - 1, sharpe: (m / sd) * Math.sqrt(BARS_YR), maxDD: dd, turnover: turn / (r.length / BARS_YR) };
}
const NUT = {};
const physarum = (o) => { const N = NUT[o.look] ??= nutrients(o.look); const plate = new Plate(n, links, o); return (t, w) => { const s = plate.step(N[t]); const nw = s.weights; return t % o.every === 0 && nw.reduce((a, x, k) => a + Math.abs(x - w[k]), 0) > o.band ? nw : w; }; };
const hold = () => { const eqw = new Array(n).fill(1 / n); let first = true; return (t, w) => (first ? ((first = false), eqw) : w); };
const random = () => { const rng = mulberry(3); let cur = null; return (t, w) => { if (!cur || t % 35 === 0) { const r = SYMS.map(() => rng()); const s = r.reduce((a, b) => a + b, 0); cur = r.map((x) => x / s); } return cur; }; };
const momentum = (look, every = 7) => { const N = NUT[look] ??= nutrients(look); return (t, w) => { if (t % every) return w; const top = N[t].map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(([v]) => v > 0); const nw = new Array(n).fill(0); top.forEach(([, k]) => (nw[k] = 1 / 3)); return nw; }; };

// calibration grid, scored on the training span only
const grid = [];
for (const look of [14, 35, 70, 140]) for (const gamma of [0.02, 0.05, 0.12]) for (const mu of [1, 1.8]) for (const g0 of [0.5, 2]) for (const rest of [0.05, 0.3]) for (const every of [7, 35]) for (const band of [0.1, 0.25]) grid.push({ look, gamma, mu, g0, rest, every, band, seed: 7 });
const scored = grid.map((o) => ({ o, tr: run(physarum(o), 1, split) })).sort((a, b) => b.tr.sharpe - a.tr.sharpe);
const best = scored[0].o;
const f = (x) => `${(x.ret * 100).toFixed(1).padStart(6)}%  sharpe ${x.sharpe.toFixed(2).padStart(5)}  maxDD ${(x.maxDD * 100).toFixed(1).padStart(5)}%  turnover/yr ${x.turnover.toFixed(1)}`;
console.log(`bars ${T} (${new Date(clock[0] * 1000).toISOString().slice(0, 10)} → ${new Date(clock[T - 1] * 1000).toISOString().slice(0, 10)}), train ${split}, test ${T - split}, cost ${COST * 100}% per unit turnover`);
console.log("links", links.map(([i, j, L]) => `${SYMS[i]}-${SYMS[j]}(${L.toFixed(2)})`).join(" "));
console.log("best on train:", JSON.stringify(best));
console.log("top 5 train sharpe:", scored.slice(0, 5).map((s) => s.tr.sharpe.toFixed(2)).join(", "), "· median", scored[scored.length >> 1].tr.sharpe.toFixed(2));
for (const [name, mk] of [["physarum", () => physarum(best)], ["hold eq-wt", hold], ["random", random], [`momentum top3 (${best.look})`, () => momentum(best.look, best.every)]]) {
  console.log(name.padEnd(22), "train", f(run(mk(), 1, split)));
  console.log("".padEnd(22), "TEST ", f(run(mk(), split, T)));
}
fs.writeFileSync(new URL("../data/calibration.json", import.meta.url), JSON.stringify({ at: Date.now(), best, links: links.map(([i, j, L]) => [SYMS[i], SYMS[j], +L.toFixed(3)]) }, null, 1));
