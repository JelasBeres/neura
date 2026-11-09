// The lab harness: lab/core.mjs (data, rules, trading loop) plus the pre-registration ledger and the original Physarum runner.
import fs from "node:fs";
import { ctx, T, DEV, LOCK_BARS, COST, FOLDS, FIRST_TRAIN, GATES, run, metrics, linksFor, hold, random, physarum } from "./core.mjs";
export * from "./core.mjs";
const DIR = new URL("../../data/", import.meta.url).pathname, { clock } = ctx;

const LEDGER = DIR + "lab/ledger.json";
const ledger = () => (fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { registered: [], holdoutOpened: [] });
const down = (r, k = 400) => { const out = []; let eq = 1; const step = Math.max(1, Math.floor(r.length / k)); r.forEach((x, i) => { eq *= 1 + x; if (i % step === 0 || i === r.length - 1) out.push(+eq.toFixed(5)); }); return out; };

export function runExperiment(exp, { holdout = false } = {}) {
  const L = ledger();
  if (!L.registered.find((e) => e.id === exp.id)) { L.registered.push({ id: exp.id, at: new Date().toISOString(), hypothesis: exp.hypothesis, gates: GATES.map((g) => g[0]) }); fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1)); }
  const foodCache = new Map(), food = (p) => { const k = JSON.stringify(exp.foodKey ? exp.foodKey(p) : p); if (!foodCache.has(k)) foodCache.set(k, exp.food(ctx, p)); return foodCache.get(k); };
  const grid = exp.grid();
  const t0 = Math.floor(DEV * FIRST_TRAIN), size = Math.floor((DEV - t0) / FOLDS), folds = [];
  for (let f = 0; f < FOLDS; f++) {
    const a = t0 + f * size, b = f === FOLDS - 1 ? DEV : a + size, links = linksFor(0, a);
    const scored = grid.map((p) => ({ p, s: run(physarum(food(p), links, p), 1, a).sharpe })).sort((x, y) => y.s - x.s);
    const best = scored[0].p, S = run(physarum(food(best), links, best), a, b), Hd = run(hold(), a, b), R = run(random(f + 3), a, b);
    folds.push({ from: clock[a], to: clock[b - 1], best, trainSharpe: +scored[0].s.toFixed(3), medianTrainSharpe: +scored[scored.length >> 1].s.toFixed(3), win: S.ret > Hd.ret && S.sharpe > Hd.sharpe, S, H: Hd, R });
  }
  const st = (k) => metrics(folds.flatMap((f) => f[k].r)), S = st("S"), Hs = st("H"), Rs = st("R");
  const gates = GATES.map(([name, fn]) => ({ name, pass: fn(S, Hs, folds) }));
  const passedDev = gates.every((g) => g.pass);
  let lock = null;
  if (holdout) {
    if (!passedDev) throw new Error("holdout stays sealed: the experiment did not pass every dev gate");
    if (L.holdoutOpened.length) throw new Error(`holdout already opened by ${L.holdoutOpened[0].id}`);
    const links = linksFor(0, DEV), grid2 = grid.map((p) => ({ p, s: run(physarum(food(p), links, p), 1, DEV).sharpe })).sort((x, y) => y.s - x.s), best = grid2[0].p;
    const S2 = run(physarum(food(best), links, best), DEV, T), H2 = run(hold(), DEV, T);
    lock = { best, S: { ...S2, r: undefined, curve: down(S2.r) }, H: { ...H2, r: undefined, curve: down(H2.r) }, pass: S2.ret > H2.ret && S2.sharpe > H2.sharpe && S2.maxDD <= H2.maxDD };
    L.holdoutOpened.push({ id: exp.id, at: new Date().toISOString() }); fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
  }
  const clean = (m) => ({ ret: +m.ret.toFixed(4), sharpe: +m.sharpe.toFixed(3), maxDD: +m.maxDD.toFixed(4), ...(m.turnover != null ? { turnover: +m.turnover.toFixed(1) } : {}) });
  const out = {
    id: exp.id, title: exp.title, food: exp.foodText, hypothesis: exp.hypothesis, registeredAt: L.registered.find((e) => e.id === exp.id).at, ranAt: new Date().toISOString(),
    data: { from: clock[0], to: clock[T - 1], bars: T, devBars: DEV, lockedBars: LOCK_BARS, cost: COST, gridSize: grid.length },
    folds: folds.map((f) => ({ from: f.from, to: f.to, best: f.best, trainSharpe: f.trainSharpe, medianTrainSharpe: f.medianTrainSharpe, win: f.win, physarum: clean(f.S), hold: clean(f.H), random: clean(f.R) })),
    stitched: { physarum: clean(S), hold: clean(Hs), random: clean(Rs) },
    curves: { physarum: down(folds.flatMap((f) => f.S.r)), hold: down(folds.flatMap((f) => f.H.r)), random: down(folds.flatMap((f) => f.R.r)) },
    gates, passedDev, holdout: lock,
    verdict: lock ? (lock.pass ? "PASSED" : "FAILED") : passedDev ? "PROMISING" : "FAILED",
    notes: exp.notes || null,
  };
  fs.writeFileSync(DIR + `lab/results/${exp.id}.json`, JSON.stringify(out));
  return out;
}
