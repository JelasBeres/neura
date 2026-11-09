// node server/league/run.mjs [EXP-001,EXP-004,EXP-005] [physarum,worm,...]: the organism league.
// Same rules as the lab harness for every organism: walk-forward over four folds, each organism born fresh at the start of a fold,
// its setting chosen only on data before the fold (best training Sharpe out of the same 48-setting budget), costs on every trade,
// the last three months sealed. Each test is run with five seeds and their returns averaged (one fifth of the capital per seed).
// A blind twin (same setting, no food) shows whether the food matters at all.
import fs from "node:fs";
import os from "node:os";
import { Worker } from "node:worker_threads";
import { ctx, DEV, FOLDS, FIRST_TRAIN, GATES, LOCK_BARS, COST, run, metrics, hold, random } from "../lab/harness.mjs";
import { ORGS } from "./orgs.mjs";
import { EXPS, PREREG_NOTES } from "./foods.mjs";
const D = new URL("../../data/", import.meta.url).pathname, SEEDS = [1, 2, 3, 4, 5];
const exps = (process.argv[2] || Object.keys(EXPS).join(",")).split(","), orgs = (process.argv[3] || Object.keys(ORGS).join(",")).split(",");

// worker pool
const size = Math.max(2, Math.min(9, os.cpus().length - 1)), pool = [], queue = [], waiting = new Map(); let nextId = 0, done = 0;
for (let i = 0; i < size; i++) { const w = new Worker(new URL("./worker.mjs", import.meta.url)); w.busy = false; w.on("message", ({ id, out }) => { waiting.get(id)(out); waiting.delete(id); w.busy = false; done++; pump(); }); w.on("error", (e) => { console.error(e); process.exit(1); }); pool.push(w); }
function pump() { for (const w of pool) if (!w.busy && queue.length) { const { id, task } = queue.shift(); w.busy = true; w.postMessage({ id, task }); } }
const ev = (task) => new Promise((res) => { const id = nextId++; waiting.set(id, res); queue.push({ id, task }); pump(); });

// pre-registration
const DRY = !!process.env.DRY, OUT = D + (DRY ? "league/dry/" : "league/");   // DRY=1: smoke test, nothing registered
const LEDGER = D + "lab/ledger.json", L = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
for (const e of exps) { const id = "LEAGUE/" + e; if (!L.registered.find((x) => x.id === id)) L.registered.push({ id, at: new Date().toISOString(), hypothesis: EXPS[e].hypothesis, organisms: orgs, budget: "48 settings each, 5 seeds on test", notes: PREREG_NOTES, gates: GATES.map((g) => g[0]) }); }
if (!DRY) fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));

// each experiment walks forward over its own window: from its first usable bar (EXP-002 only has data since the chain launched)
const windowOf = (e) => { const s0 = EXPS[e].from ? Math.max(1, ctx.clock.findIndex((t) => t >= EXPS[e].from)) : 1, t0 = s0 + Math.floor((DEV - s0) * FIRST_TRAIN), fsz = Math.floor((DEV - t0) / FOLDS);
  return { s0, spans: Array.from({ length: FOLDS }, (_, f) => [t0 + f * fsz, f === FOLDS - 1 ? DEV : t0 + (f + 1) * fsz]) }; };
const clean = (m) => ({ ret: +m.ret.toFixed(4), sharpe: +m.sharpe.toFixed(3), maxDD: +m.maxDD.toFixed(4), ...(m.turnover != null ? { turnover: +m.turnover.toFixed(1) } : {}) });
const avg = (rs) => rs[0].map((_, i) => rs.reduce((a, r) => a + r[i], 0) / rs.length);
const down = (r, k = 400) => { const out = []; let eq = 1; const step = Math.max(1, Math.floor(r.length / k)); r.forEach((x, i) => { eq *= 1 + x; if (i % step === 0 || i === r.length - 1) out.push(+eq.toFixed(5)); }); return out; };
const started = Date.now();
setInterval(() => process.stdout.write(`\r${done} evaluations · ${queue.length} queued · ${((Date.now() - started) / 60000).toFixed(1)} min   `), 5000).unref();

async function league(exp) {
  const { s0, spans } = windowOf(exp);
  const bench = { hold: spans.map(([a, b]) => run(hold(), a, b)), random: spans.map(([a, b], f) => run(random(f + 3), a, b)) };
  const one = async (org) => {
    const G = ORGS[org].grid(), folds = [], test = [], blind = [], perSeed = SEEDS.map(() => []), frames = [];
    for (const [f, [a, b]] of spans.entries()) {
      const scored = (await Promise.all(G.map((p) => ev({ exp, org, p, seed: 1, t0: s0, t1: a, linkAt: a })))).map((s, i) => ({ p: G[i], s: s.sharpe })).sort((x, y) => y.s - x.s);
      const best = scored[0].p;
      const runs = await Promise.all(SEEDS.map((seed) => ev({ exp, org, p: best, seed, t0: a, t1: b, linkAt: a, record: seed === 1 })));
      const blinds = await Promise.all(SEEDS.map((seed) => ev({ exp, org, p: best, seed, t0: a, t1: b, linkAt: a, blind: true })));
      const r = avg(runs.map((x) => Array.from(x.r))), m = metrics(r), H = bench.hold[f];
      runs.forEach((x, i) => perSeed[i].push(...x.r)); test.push(...r); blind.push(...avg(blinds.map((x) => Array.from(x.r)))); frames.push(...runs[0].frames.map((fr) => ({ ...fr, fold: f + 1 })));
      folds.push({ from: ctx.clock[a], to: ctx.clock[b - 1], best, trainSharpe: +scored[0].s.toFixed(3), medianTrainSharpe: +scored[scored.length >> 1].s.toFixed(3), win: m.ret > H.ret && m.sharpe > H.sharpe, test: clean({ ...m, turnover: runs.reduce((s, x) => s + x.turnover, 0) / runs.length }) });
    }
    const S = metrics(test), Hs = metrics(bench.hold.flatMap((x) => x.r)), gates = GATES.map(([name, fn]) => ({ name, pass: fn(S, Hs, folds) }));
    console.log(`\n${exp} ${org}: ${(S.ret * 100).toFixed(1)}% sharpe ${S.sharpe.toFixed(2)} dd ${(S.maxDD * 100).toFixed(1)}% · gates ${gates.filter((g) => g.pass).length}/4`);
    return { org, folds, stitched: clean(S), seeds: perSeed.map((r) => clean(metrics(r))), blind: clean(metrics(blind)), gates, passedDev: gates.every((g) => g.pass), verdict: gates.every((g) => g.pass) ? "PROMISING" : "FAILED", curve: down(test), r: test, frames };
  };
  const res = await Promise.all(orgs.map(one));
  const books = { hold: bench.hold.flatMap((x) => x.r), random: bench.random.flatMap((x) => x.r), ...Object.fromEntries(res.map((x) => [x.org, x.r])) };
  const corr = (x, y) => { const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length; let c = 0, vx = 0, vy = 0; x.forEach((v, i) => { c += (v - mx) * (y[i] - my); vx += (v - mx) ** 2; vy += (y[i] - my) ** 2; }); return +(c / Math.sqrt(vx * vy || 1)).toFixed(3); };
  const keys = Object.keys(books), sim = keys.flatMap((a, i) => keys.slice(i + 1).map((b) => ({ a, b, corr: corr(books[a], books[b]) })));
  const out = { id: exp, ...EXPS[exp], food: undefined, guard: undefined, from: undefined, foodText: EXPS[exp].foodText, ranAt: new Date().toISOString(), window: { from: ctx.clock[s0], trainFrom: ctx.clock[s0], spans: spans.map(([a, b]) => [ctx.clock[a], ctx.clock[b - 1]]) }, rules: { folds: FOLDS, cost: COST, lockedBars: LOCK_BARS, seeds: SEEDS.length, budget: 48 },
    bench: { hold: clean(metrics(books.hold)), random: clean(metrics(books.random)), holdCurve: down(books.hold), randomCurve: down(books.random), holdFolds: bench.hold.map(clean) },
    notes: PREREG_NOTES, organisms: Object.fromEntries(res.map(({ r, ...x }) => [x.org, x])), sim };
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + `${exp}.json`, JSON.stringify(out));
}
for (const e of exps) await league(e);
console.log(`\ndone in ${((Date.now() - started) / 60000).toFixed(1)} min`); process.exit(0);
