// The six organisms of the league. Each turns the same food (one number per asset per hour) into a target portfolio with
// its own published mechanism. Every organism gets the same 48-setting budget: 4 food lookbacks x 12 settings of its own.
// step(t) returns the book it wants; the runner trades it (see run.mjs). inner() exposes one state number per asset for the web.
import { Plate, mulberry } from "../solver.mjs";
import { run as fryRun, hebb, newCircuit } from "./vendor/fry-circuit.mjs";
import { load } from "../lib/load.mjs";
const WT = await load("league/worm-table.json");
const LOOKS = [14, 35, 70, 140];
const grid = (own) => LOOKS.flatMap((look) => own.map((o) => ({ look, ...o })));
const cross = (a) => Object.entries(a).reduce((acc, [k, vs]) => acc.flatMap((o) => vs.map((v) => ({ ...o, [k]: v }))), [{}]);
const clip = (v, a, b) => Math.max(a, Math.min(b, v));

// a book an organism keeps itself (worm, fry): weights drift with prices between its own trades
const book = (n, ret) => { const w = new Array(n).fill(0); return { w, drift(t) { const tot = w.reduce((a, x, k) => a + x * (1 + ret[k][t]), 0) + (1 - w.reduce((a, x) => a + x, 0)); for (let k = 0; k < n; k++) w[k] = (w[k] * (1 + ret[k][t])) / tot; } }; };

export const ORGS = {
  // Tero, Kobayashi & Nakagaki 2007: tubes thicken with flux, wither without it (solver.mjs)
  physarum: {
    mode: "rebalance", inner: "tube conductivity core→asset",
    grid: () => grid(cross({ gamma: [0.02, 0.05, 0.12], rest: [0.05, 0.3], every: [7, 35] }).map((o) => ({ ...o, mu: 1.8, g0: 1 }))),
    make({ n, links }, food, p, seed) { const plate = new Plate(n, links, { ...p, seed }); let s = null; return { step: (t) => (s = plate.step(food[t])).weights, inner: () => plate.dCore.slice() }; },
  },
  // WORMBRAIN rules (engine.mjs crawl/learn) on the real 302-neuron brain, answers replayed from worm-table.json
  worm: {
    mode: "direct", inner: "learned value L per patch",
    grid: () => grid(cross({ scale: [1, 3], buy: [0.3, 0.4, 0.5], halfLife: [6, 24] })),
    make({ n, ret, px, SYMS }, food, p, seed) {
      const rng = mulberry(seed), B = book(n, ret), L = new Array(n).fill(0), pend = [], tr = { at: 0, dir: 1, dwell: 0 }, dec = Math.pow(0.5, 1 / p.halfLife);
      const v = (k, s, l) => { const T = WT.v[SYMS[k]], si = Math.round((clip(s, -1, 1) + 1) * 10), li = Math.round((l + 1) * 4); return T[(si * WT.L_LEVELS + li) * WT.SEEDS + Math.floor(rng() * WT.SEEDS)]; };
      return {
        step(t) {
          B.drift(t); for (let k = 0; k < n; k++) L[k] *= dec;
          for (const q of pend.splice(0)) { const r = px[q.k][t] / q.px - 1; L[q.k] = clip(L[q.k] + 0.35 * Math.tanh(r / 0.01), -1, 1); if (B.w[q.k] > 1e-4) pend.push({ k: q.k, px: px[q.k][t] }); }
          const k = tr.at; let z = 0; for (let q = 0; q < 6; q++) z += rng();
          const o = v(k, Math.tanh(food[t][k] / p.scale) + (z - 3) * 0.3 * Math.SQRT2, L[k]);
          if (o > 0.35) tr.dwell++; else tr.dwell = 0; if (o < -0.35) tr.dir *= -1;
          const held = B.w[k] > 1e-4, sum = B.w.reduce((a, x) => a + x, 0);
          if (held && o < -0.4) B.w[k] = 0;
          else if (tr.dwell >= 2 && o > p.buy && sum + 0.05 <= 1 && B.w[k] < 0.2) { B.w[k] = Math.min(0.2, B.w[k] + 0.05); pend.push({ k, px: px[k][t] }); }
          if (tr.dwell === 0) tr.at = (tr.at + tr.dir + n) % n;
          return B.w.slice();
        },
        inner: () => L.slice(),
      };
    },
  },
  // FRYBRAIN rules (engine.mjs decide/learn) on its 11 LIF cells with Hebbian synapses, simulated in full every hour
  fry: {
    mode: "direct", inner: "firing rate (Hz)",
    grid: () => grid(cross({ scale: [1, 2, 4], halfLife: [6, 24], buyHz: [15, 20] })),
    make({ n, ret, px }, food, p, seed) {
      const C = newCircuit(n), B = book(n, ret), st = new Array(n).fill(0), pend = [], dec = Math.pow(0.5, 1 / p.halfLife); let rates = new Array(n).fill(0);
      return {
        step(t) {
          B.drift(t); for (let k = 0; k < n; k++) C.L[k] *= dec;
          for (const q of pend.splice(0)) { const r = px[q.k][t] / q.px - 1; C.L[q.k] = clip(C.L[q.k] + 0.35 * Math.tanh(r / 0.01), -1, 1); if (B.w[q.k] > 1e-4) pend.push({ k: q.k, px: px[q.k][t] }); }
          const out = fryRun(C, food[t].map((f) => Math.tanh(f / p.scale)), { seed: (t * 7919 + seed * 104729) >>> 0 }); hebb(C, out.rates); rates = out.rates;
          rates.forEach((r, k) => (st[k] = r >= p.buyHz ? st[k] + 1 : 0));
          let acts = 0;
          for (const k of [...Array(n).keys()].filter((k) => B.w[k] > 1e-4 && rates[k] <= 2).sort((a, b) => rates[a] - rates[b])) { if (acts >= 2) break; B.w[k] = 0; acts++; }
          for (const k of [...Array(n).keys()].filter((k) => st[k] >= 2).sort((a, b) => rates[b] - rates[a])) {
            if (acts >= 2) break; const sum = B.w.reduce((a, x) => a + x, 0); if (sum + 0.05 > 1 || B.w[k] >= 0.2) continue;
            B.w[k] = Math.min(0.2, B.w[k] + 0.05); pend.push({ k, px: px[k][t] }); st[k] = 0; acts++;
          }
          return B.w.slice();
        },
        inner: () => rates.map((r) => +r.toFixed(1)),
      };
    },
  },
  // ant colony optimisation (Dorigo & Gambardella 1997, MAX-MIN bounds of Stützle & Hoos 2000): smell guides the choice,
  // pheromone is laid in proportion to the profit actually found, and evaporates
  ant: {
    mode: "rebalance", inner: "pheromone",
    grid: () => grid(cross({ rho: [0.02, 0.1, 0.3], beta: [1, 3], every: [7, 35] })),
    make({ n, ret }, food, p, seed) {
      const rng = mulberry(seed), N = 200, tau = new Array(n + 1).fill(1), cnt = new Array(n + 1).fill(0);
      return {
        step(t) {
          for (let k = 0; k <= n; k++) { const gain = k < n ? Math.max(0, ret[k][t]) / 0.01 : 0; tau[k] = clip((1 - p.rho) * tau[k] + (cnt[k] / N) * gain, 0.05, 5); }
          const att = tau.map((tk, k) => tk * Math.pow(k < n ? Math.max(0, food[t][k]) + 0.05 : 0.3, p.beta)), S = att.reduce((a, b) => a + b, 0);
          cnt.fill(0); for (let a = 0; a < N; a++) { let u = rng() * S, k = 0; while (k < n && (u -= att[k]) > 0) k++; cnt[k]++; }
          // the colony trades its expected choice (trail share), not the sampled head count, which only adds sampling noise
          return att.slice(0, n).map((x) => x / S);
        },
        inner: () => tau.slice(0, n).map((x) => +x.toFixed(3)),
      };
    },
  },
  // honeybee nest-site selection (Seeley & Buhrman 1999; Passino & Seeley 2006): scouts dance in proportion to site quality,
  // recruits follow dances, dancing fades, and the swarm only moves to sites that reach a quorum
  bee: {
    mode: "rebalance", inner: "scouts at site",
    grid: () => grid(cross({ quorum: [0.1, 0.2, 0.35], explore: [0.05, 0.2], every: [7, 35] })),
    make({ n }, food, p, seed) {
      const rng = mulberry(seed), S = 100, site = new Array(S).fill(-1), d = new Array(S).fill(0), cnt = new Array(n).fill(0);
      return {
        step(t) {
          const q = food[t].map((f) => clip(f / 3, 0, 1)), dance = new Array(n).fill(0);
          for (let s = 0; s < S; s++) if (site[s] >= 0) { d[s]--; if (d[s] <= 0 || q[site[s]] <= 0) site[s] = -1; else dance[site[s]] += d[s]; }
          const DT = dance.reduce((a, b) => a + b, 0);
          for (let s = 0; s < S; s++) if (site[s] < 0) {
            let k = -1;
            if (rng() < p.explore || DT <= 0) k = Math.floor(rng() * n); else { let u = rng() * DT; k = 0; while (k < n - 1 && (u -= dance[k]) > 0) k++; }
            if (q[k] > 0) { site[s] = k; d[s] = Math.max(1, Math.round(q[k] * 10)); }
          }
          cnt.fill(0); site.forEach((k) => k >= 0 && cnt[k]++);
          return cnt.map((c) => (c >= p.quorum * S ? c / S : 0));
        },
        inner: () => cnt.slice(),
      };
    },
  },
  // E. coli run-and-tumble (Berg & Brown 1972; temporal comparison, Macnab & Koshland 1972): each cell compares the food
  // where it is now with a short memory; improving -> keep running, worse -> tumble to a random site (cash is a site too)
  ecoli: {
    mode: "rebalance", inner: "cells at site",
    grid: () => grid(cross({ mem: [0.5, 0.8, 0.95], pHigh: [0.15, 0.4], every: [7, 35] })),
    make({ n }, food, p, seed) {
      const rng = mulberry(seed), B = 200, site = Array.from({ length: B }, () => Math.floor(rng() * (n + 1))), m = new Array(B).fill(0), cnt = new Array(n + 1).fill(0);
      return {
        step(t) {
          for (let b = 0; b < B; b++) {
            const c = site[b] < n ? food[t][site[b]] : 0, dc = c - m[b]; m[b] = p.mem * m[b] + (1 - p.mem) * c;
            if (rng() < (dc > 0 ? 0.02 : p.pHigh)) site[b] = Math.floor(rng() * (n + 1));
          }
          cnt.fill(0); site.forEach((k) => cnt[k]++);
          return cnt.slice(0, n).map((c) => c / B);
        },
        inner: () => cnt.slice(0, n),
      };
    },
  },
};
