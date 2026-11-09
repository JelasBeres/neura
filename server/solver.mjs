// Physarum solver after Tero, Kobayashi & Nakagaki (2007) "A mathematical model for adaptive transport network in path finding by true slime mold".
// The plate: one inoculum (the core, held at pressure 1), one node per asset, and a rest sink (cash). Tubes run core -> asset and between
// correlated assets. Each asset drains to ground through its food conductance G = g0 * max(0, nutrient). Every step:
//   1. Kirchhoff: solve node pressures so flux in = flux out everywhere (Q_ij = D_ij / L_ij * (p_i - p_j)).
//   2. Adapt:     dD/dt = f(|Q|) - gamma * D, with f(Q) = Q^mu / (1 + Q^mu). Busy tubes thicken, idle ones thin.
//   3. Prune:     a tube thinner than dMin is gone; with rate `explore` per step a pseudopod regrows it at d0.
// What each asset absorbs (G_k * p_k) against what the rest sink takes is the allocation. No training, no network weights: just flow.
export const DEFAULTS = { gamma: 0.05, mu: 1.8, g0: 1, rest: 0.2, dMin: 0.02, d0: 0.15, explore: 0.01, linkLen: 2 };

function solve(A, b) {   // Gaussian elimination with partial pivoting, n is tiny (11)
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

export function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Plate {
  /** n assets; links: [[i, j, length]] tubes between assets; state: a saved plate to resume */
  constructor(n, links = [], opt = {}, state = null) {
    this.o = { ...DEFAULTS, ...opt }; this.n = n; this.links = links.map(([i, j, L]) => ({ i, j, L }));
    this.rng = mulberry(opt.seed ?? 7);
    this.dCore = state?.dCore ?? new Array(n).fill(this.o.d0);
    this.dLink = state?.dLink ?? this.links.map(() => this.o.d0);
  }
  /** one step: nutrient per asset (any real number), dt in steps. Returns pressures, fluxes, uptake, weights and what changed */
  step(nutrient, dt = 1) {
    const { g0, rest, gamma, mu, dMin, d0, explore } = this.o, n = this.n;
    const G = nutrient.map((v) => g0 * Math.max(0, v) + 1e-6);
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    for (let k = 0; k < n; k++) { A[k][k] += this.dCore[k] + G[k]; b[k] += this.dCore[k]; }   // core tubes have length 1
    this.links.forEach((l, e) => { const c = this.dLink[e] / l.L; A[l.i][l.i] += c; A[l.j][l.j] += c; A[l.i][l.j] -= c; A[l.j][l.i] -= c; });
    for (let k = 0; k < n; k++) if (A[k][k] < 1e-9) A[k][k] = 1e-9;
    const p = solve(A, b);
    const qCore = this.dCore.map((d, k) => d * (1 - p[k])), qLink = this.links.map((l, e) => this.dLink[e] / l.L * (p[l.i] - p[l.j]));
    const f = (q) => { const a = Math.abs(q) ** mu; return a / (1 + a); };
    const events = [];
    const adapt = (d, q, tag) => {
      if (d <= 0) { if (this.rng() < explore * dt) { events.push({ kind: "regrow", tag }); return d0; } return 0; }
      const nd = Math.max(0, d + (f(q) - gamma * d) * dt);
      if (nd < dMin) { events.push({ kind: "prune", tag }); return 0; }
      return nd;
    };
    this.dCore = this.dCore.map((d, k) => adapt(d, qCore[k], k));
    this.dLink = this.dLink.map((d, e) => adapt(d, qLink[e], `${this.links[e].i}-${this.links[e].j}`));
    const uptake = G.map((g, k) => g * p[k]), total = uptake.reduce((a, b) => a + b, 0) + rest;
    return { p, qCore, qLink, uptake, weights: uptake.map((u) => u / total), cash: rest / total, events, G };
  }
  save() { return { dCore: this.dCore, dLink: this.dLink }; }
}
