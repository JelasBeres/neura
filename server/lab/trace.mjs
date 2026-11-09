// node server/lab/trace.mjs EXP-001: replay an experiment's walk-forward test folds with each fold's chosen settings and record
// what the plate did (food in, tube thickness, weights out, equity) so the web can show it. Same rules as harness.run(); the
// stitched metrics are recomputed and compared with the stored result as a check.
import fs from "node:fs";
import { Plate } from "../solver.mjs";
import { ctx, SYMS, n, COST, linksFor, metrics, hold, random } from "./harness.mjs";
const id = process.argv[2], EVERY = 2;
const exp = (await import(`./exp/${id}.mjs`)).default, res = JSON.parse(fs.readFileSync(new URL(`../../data/lab/results/${id}.json`, import.meta.url)));
const { ret, clock } = ctx, at = (ts) => clock.indexOf(ts), r3 = (v) => +v.toFixed(3);

// one loop for any allocator, mirroring harness.run(); onBar sees the weights held after each bar
function play(alloc, t0, t1, onBar) {
  let w = new Array(n).fill(0); const r = [];
  for (let t = t0; t < t1 - 1; t++) {
    const nw = alloc(t, w); let to = 0; for (let k = 0; k < n; k++) to += Math.abs(nw[k] - w[k]);
    w = nw; let g = 0; for (let k = 0; k < n; k++) g += w[k] * ret[k][t + 1];
    r.push((1 - to * COST) * (1 + g) - 1); onBar?.(t, w);
    const tot = w.reduce((a, x, k) => a + x * (1 + ret[k][t + 1]), 0) + (1 - w.reduce((a, x) => a + x, 0)); w = w.map((x, k) => (x * (1 + ret[k][t + 1])) / tot);
  }
  return r;
}
const frames = [], links = [], rs = { physarum: [], hold: [], random: [] }; let eq = { physarum: 1, hold: 1, random: 1 };
res.folds.forEach((f, fi) => {
  const a = at(f.from), b = fi === res.folds.length - 1 ? ctx.T - 441 : at(f.to) + 1, p = f.best, L = linksFor(0, a), food = exp.food(ctx, p);
  const plate = new Plate(n, L, p); let last = null;
  const phys = (t, w) => { last = plate.step(food[t]); return t % p.every === 0 && last.weights.reduce((s, x, k) => s + Math.abs(x - w[k]), 0) > p.band ? last.weights : w; };
  const hw = [], rw = [];
  const rh = play(hold(), a, b, (t, w) => hw.push(w)), rr = play(random(fi + 3), a, b, (t, w) => rw.push(w));
  let i = 0;
  const rp = play(phys, a, b, (t, w) => {
    if (i % EVERY === 0) frames.push({ t: clock[t], fold: fi + 1, food: food[t].map(r3), w: w.map(r3), cash: r3(1 - w.reduce((s, x) => s + x, 0)), dCore: plate.dCore.map(r3), dLink: plate.dLink.map(r3), links: fi, hold: hw[i].map(r3), random: rw[i].map(r3), i: rs.physarum.length + i });
    i++;
  });
  links.push(L.map(([x, y]) => [x, y]));
  rs.physarum.push(...rp); rs.hold.push(...rh); rs.random.push(...rr);
});
const cum = (r) => { let e = 1; return r.map((x) => +(e *= 1 + x).toFixed(5)); };
const E = { physarum: cum(rs.physarum), hold: cum(rs.hold), random: cum(rs.random) };
frames.forEach((f) => { f.eq = { physarum: E.physarum[f.i], hold: E.hold[f.i], random: E.random[f.i] }; delete f.i; });
const m = Object.fromEntries(Object.entries(rs).map(([k, r]) => [k, metrics(r)]));
for (const k of ["physarum", "hold", "random"]) console.log(k, "replay", m[k].ret.toFixed(4), m[k].sharpe.toFixed(3), "| stored", res.stitched[k].ret, res.stitched[k].sharpe);
// decision similarity: correlation of net hourly returns between books over the whole test span
const corr = (x, y) => { const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length; let c = 0, vx = 0, vy = 0; x.forEach((v, i) => { c += (v - mx) * (y[i] - my); vx += (v - mx) ** 2; vy += (y[i] - my) ** 2; }); return c / Math.sqrt(vx * vy); };
const sim = [["physarum", "hold"], ["physarum", "random"], ["hold", "random"]].map(([a, b]) => ({ a, b, corr: r3(corr(rs[a], rs[b])) }));
console.log(sim);
const out = { id, syms: SYMS, every: EVERY, links, frames, sim, stitched: res.stitched, verdict: res.verdict, title: res.title, food: res.food, hypothesis: res.hypothesis, notes: res.notes, gates: res.gates, folds: res.folds.map(({ from, to, best, win, physarum, hold, random }) => ({ from, to, best, win, physarum, hold, random })) };
fs.writeFileSync(new URL(`../../data/lab/traces/${id}.json`, import.meta.url), JSON.stringify(out));
console.log("frames", frames.length, "bytes", JSON.stringify(out).length);
