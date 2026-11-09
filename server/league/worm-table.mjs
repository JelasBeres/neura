// node server/league/worm-table.mjs: run the whole 302-neuron worm brain (copied from WORMBRAIN, unchanged) on a grid of inputs once,
// so the league can replay the real brain's answers instead of re-simulating 7.7 ms per sniff hundreds of thousands of times.
// Grid: 11 assets (each has its own scent neurons) x 21 smell levels in [-1, 1] x 9 learned values in [-1, 1] x 6 noise seeds.
// The encoder, readout and learning-to-synapse mapping are copied from wormbrain/server/engine.mjs.
import fs from "node:fs";
import { loadConnectome, sniff, P } from "./vendor/worm-brain.mjs";
const D = new URL("../../data/", import.meta.url).pathname;
const K = loadConnectome(D + "league/connectome.json"), assets = JSON.parse(fs.readFileSync(D + "assets.json")).assets;
const ix = (n) => K.idx.get(n), LR = (c) => (K.idx.has(c) ? [c] : [c + "L", c + "R"]);
const FW = ["AIYL", "AIYR", "RIBL", "RIBR", "AVBL", "AVBR", "PVCL", "PVCR"].map(ix), RV = ["AIBL", "AIBR", "AIZL", "AIZR", "RIML", "RIMR", "AVAL", "AVAR", "AVDL", "AVDR", "AVEL", "AVER"].map(ix);
const ATT = ["AWAL", "AWAR", "ASEL"].map(ix), REP = ["ASHL", "ASHR", "AWBL", "AWBR", "ASER"].map(ix);
const APP = new Set(["AIYL", "AIYR", "AIAL", "AIAR"].map(ix)), AVO = new Set(["AIBL", "AIBR", "AIZL", "AIZR"].map(ix));
const SCENT = assets.map((a) => a.scent.flatMap(LR).map(ix)), SCENT_HZ = 40;
const encode = (s) => { if (Math.abs(s) < 0.05) return {}; const ids = s > 0 ? ATT : REP, fr = s > 0 ? 0.55 + 0.25 * Math.min(1, s) : 0.68 + 0.42 * Math.min(1, -s); return Object.fromEntries(ids.map((i) => [i, fr * P.maxRate])); };
const readout = (sp) => { const f = FW.reduce((t, i) => t + sp[i], 0), r = RV.reduce((t, i) => t + sp[i], 0); return (f - r) / (f + r + 4); };
const synMod = (k, L) => { if (!L) return null; const m = new Map(); for (const i of SCENT[k]) { const mm = new Map(); for (const [j, , sg] of K.out[i]) { const t = APP.has(j) ? 1 : AVO.has(j) ? -1 : 0; if (!t) continue; const fwd = t * sg > 0; mm.set(j, fwd ? 1 + 3 * Math.max(0, L) - 0.8 * Math.max(0, -L) : 1 + 3 * Math.max(0, -L) - 0.8 * Math.max(0, L)); } m.set(i, mm); } return m; };
export const S_LEVELS = 21, L_LEVELS = 9, SEEDS = 6;
const t0 = Date.now(), v = {};
for (const [k, a] of assets.entries()) {
  const rows = [];
  for (let si = 0; si < S_LEVELS; si++) for (let li = 0; li < L_LEVELS; li++) {
    const s = -1 + (2 * si) / (S_LEVELS - 1), L = -1 + (2 * li) / (L_LEVELS - 1), inp = { ...encode(s) };
    for (const i of SCENT[k]) inp[i] = (inp[i] || 0) + SCENT_HZ;
    for (let q = 0; q < SEEDS; q++) rows.push(+readout(sniff(K, inp, { synMod: synMod(k, L), rngSeed: (k * 100003 + si * 1009 + li * 101 + q * 7 + 1) >>> 0 })).toFixed(4));
  }
  v[a.sym] = rows; console.log(a.sym, ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
fs.writeFileSync(D + "league/worm-table.json", JSON.stringify({ source: "wormbrain brain.mjs + engine.mjs encoder/readout, Cook et al. 2019 connectome", S_LEVELS, L_LEVELS, SEEDS, v }));
