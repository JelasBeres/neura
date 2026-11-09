// node server/league/pack.mjs: slim the league results for the web (_src/ui-preview/map/data/league-<EXP>.json).
// Adds what the runner did not store: the food each organism saw at each frame (recomputed from its fold's chosen lookback)
// and the hold / random books' weights over the same test span.
import fs from "node:fs";
import { ctx, DEV, FOLDS, FIRST_TRAIN, n, hold, random, run } from "../lab/harness.mjs";
import { EXPS } from "./foods.mjs";
const D = new URL("../../data/league/", import.meta.url).pathname, OUT = new URL("../../_src/ui-preview/map/data/", import.meta.url).pathname, EVERY = 4;
const t0 = Math.floor(DEV * FIRST_TRAIN), fsz = Math.floor((DEV - t0) / FOLDS), SPANS = Array.from({ length: FOLDS }, (_, f) => [t0 + f * fsz, f === FOLDS - 1 ? DEV : t0 + (f + 1) * fsz]);
const at = new Map(ctx.clock.map((t, i) => [t, i])), r3 = (v) => +(+v).toFixed(3);
const benchW = (spans, mk) => { const out = new Map(); spans.forEach(([a, b], f) => { const al = mk(f); run((t, w) => { const nw = al(t, w); if ((t - a) % 2 === 0) out.set(ctx.clock[t], nw.map(r3)); return nw; }, a, b); }); return out; };
const index = [];
for (const exp of ["EXP-001", "EXP-002", "EXP-003", "EXP-004", "EXP-005", "EXP-006"]) {
  if (!fs.existsSync(D + exp + ".json")) continue;
  const R = JSON.parse(fs.readFileSync(D + exp + ".json")), spans = R.window ? R.window.spans.map(([a, b]) => [at.get(a), at.get(b) + 1]) : SPANS,
    HW = benchW(spans, () => hold()), RW = benchW(spans, (f) => random(f + 3)), foodCache = new Map(), food = (look) => { if (!foodCache.has(look)) foodCache.set(look, EXPS[exp].food(ctx, { look })); return foodCache.get(look); };
  const ts = R.organisms[Object.keys(R.organisms)[0]].frames.map((f) => f.t).filter((_, i) => i % (EVERY / 2) === 0);
  const orgs = Object.fromEntries(Object.entries(R.organisms).map(([k, o]) => {
    const byT = new Map(o.frames.map((f) => [f.t, f]));
    const frames = ts.map((t) => { const f = byT.get(t); const look = o.folds[f.fold - 1].best.look; return { w: f.w, inner: f.inner, food: food(look)[at.get(t)].map(r3) }; });
    return [k, { stitched: o.stitched, seeds: o.seeds, blind: o.blind, gates: o.gates, verdict: o.verdict, folds: o.folds, curve: o.curve, frames }];
  }));
  const eq = (curve) => ts.map((_, i) => curve[Math.min(curve.length - 1, Math.round((i / (ts.length - 1)) * (curve.length - 1)))]);
  const out = { id: exp, title: R.title, hypothesis: R.hypothesis, foodText: R.foodText, rules: R.rules, notes: R.notes, syms: ctx.SYMS, t: ts, fold: ts.map((t) => spans.findIndex(([a, b]) => at.get(t) >= a && at.get(t) < b) + 1),
    bench: { ...R.bench, holdW: ts.map((t) => HW.get(t)), randomW: ts.map((t) => RW.get(t)) }, organisms: orgs, sim: R.sim,
    eq: { hold: eq(R.bench.holdCurve), random: eq(R.bench.randomCurve), ...Object.fromEntries(Object.entries(R.organisms).map(([k, o]) => [k, eq(o.curve)])) } };
  fs.writeFileSync(OUT + `league-${exp}.json`, JSON.stringify(out)); index.push({ id: exp, title: R.title });
  console.log(exp, (JSON.stringify(out).length / 1024).toFixed(0) + " KB");
}
fs.writeFileSync(OUT + "league-index.json", JSON.stringify(index));
