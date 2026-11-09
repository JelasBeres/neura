// A whole C. elegans nervous system as leaky integrate-and-fire neurons.
// Wiring: Cook et al. 2019 (302 neurons, chemical synapses + gap junctions). Parameters follow the LIF model
// used for whole-brain connectome simulation (Shiu et al. 2024): rest/reset -52 mV, threshold -45 mV,
// membrane tau 20 ms, synaptic tau 5 ms, 0.275 mV per synapse, 1.8 ms delay, 2.2 ms refractory.
import fs from "node:fs";
// Calibrated (random search, 10 seeds) so the wired circuit, not global runaway, decides the outcome:
// attractant input (AWA, ASEL) raises forward-side activity, repellent input (ASH, AWB, ASER) raises reverse-side activity.
export const P = { vRest: -52, vReset: -52, vTh: -45, tauM: 20, tauS: 5, wSyn: 0.275, delay: 1.8, tRef: 2.2, dt: 0.5, gGap: 0.012,
  wIn: 21.1, chemScale: 43.1, gapScale: 0.049, logW: true, adaptInc: 0.9, tauA: 150, bgRate: 0, wBg: 6, inNorm: 0.5, maxRate: 272 };
export function loadConnectome(file) {
  const C = JSON.parse(fs.readFileSync(file, "utf8")); const idx = new Map(C.neurons.map((n, i) => [n.id, i])); const N = C.neurons.length;
  const out = Array.from({ length: N }, () => []);
  for (const [a, b, w] of C.chem) { const i = idx.get(a), j = idx.get(b); out[i].push([j, w, (C.neurons[i].inhibitory ? -1 : 1)]); }
  const ov = new Map((C.signOverrides || []).map(([a, b, sg]) => [a + ">" + b, sg]));
  for (const [a, b] of (C.signOverrides || [])) { const i = idx.get(a), j = idx.get(b), e = out[i].find((x) => x[0] === j); if (e) e[2] = ov.get(a + ">" + b); }
  const gap = C.gap.map(([a, b, w]) => [idx.get(a), idx.get(b), w]);
  const inSum = new Float32Array(N); for (let i = 0; i < N; i++) for (const [j, w] of out[i]) inSum[j] += Math.log2(1 + w);
  return { inSum, C, N, idx, out, gap, ids: C.neurons.map((n) => n.id) };
}
let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
/** run one "sniff": input = { neuronIndex: rateHz }, gains = optional per-neuron output gain (learning). Returns spike counts. */
export function sniff(K, input, { ms = 400, gains = null, synMod = null, rngSeed = 1, raster = null } = {}) {
  seed = rngSeed >>> 0 || 1; const { N, out, gap, inSum } = K, dt = P.dt, steps = Math.round(ms / dt), D = Math.max(1, Math.round(P.delay / dt));
  const v = new Float32Array(N).fill(P.vRest), g = new Float32Array(N), ref = new Float32Array(N), spikes = new Uint16Array(N), ad = new Float32Array(N);
  const W = (w) => (P.logW ? Math.log2(1 + w) : w);
  const ring = Array.from({ length: D + 1 }, () => new Float32Array(N)); const inp = Object.entries(input).map(([i, r]) => [+i, r * dt / 1000]);
  const decM = Math.exp(-dt / P.tauM), decS = Math.exp(-dt / P.tauS), decA = Math.exp(-dt / P.tauA);
  for (let s = 0; s < steps; s++) {
    const arrive = ring[s % (D + 1)];
    for (let i = 0; i < N; i++) { g[i] = g[i] * decS + arrive[i]; arrive[i] = 0; ad[i] *= decA; }
    for (const [i, p] of inp) if (rnd() < p) g[i] += P.wIn;
    if (P.bgRate > 0) { const pb = P.bgRate * dt / 1000; for (let i = 0; i < N; i++) if (rnd() < pb) g[i] += P.wBg; }
    for (const [a, b, w] of gap) { const c = P.gGap * P.gapScale * w * (v[b] - v[a]) * dt; v[a] += c; v[b] -= c; }
    const send = ring[(s + D) % (D + 1)];
    for (let i = 0; i < N; i++) {
      if (ref[i] > 0) { ref[i] -= dt; continue; }
      v[i] = P.vRest + (v[i] - P.vRest) * decM + (g[i] - ad[i]) * (1 - decM);
      if (v[i] >= P.vTh) { v[i] = P.vReset; ref[i] = P.tRef; spikes[i]++; if (raster && raster.length < 12000) raster.push(Math.round(s * dt * 10), i); ad[i] += P.adaptInc; const k = gains ? gains[i] : 1, mi = synMod && synMod.get(i); for (const [j, w, sg] of out[i]) send[j] += P.wSyn * P.chemScale * W(w) * sg * k * (mi && mi.has(j) ? mi.get(j) : 1) / (P.inNorm ? Math.pow(Math.max(1, inSum[j]), P.inNorm) : 1); }
    }
  }
  return spikes;
}
