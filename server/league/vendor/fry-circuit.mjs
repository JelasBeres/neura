// FRYBRAIN circuit: eleven leaky integrate-and-fire cells, one per asset, imaged through a simulated GCaMP6s calcium indicator (the green sensor used for larval zebrafish).
// Each cycle runs SIM_MS of model time. Market drive enters as input current; cells excite each other through
// Hebbian synapses ("fire together, wire together") and share one inhibitory pool, so they compete.
// Calcium follows spikes with GCaMP6s-like kinetics (fast rise, decay on the order of a second; Chen et al., Nature 2013), sampled as dF/F.

// Membrane voltages follow larval zebrafish recordings: rest -67 mV, the mean of larval vestibulospinal neurons
// (Hamling, Harmon & Schoppik, eNeuro 2023, Table 1: -67 +/- 5 mV, input resistance 236 MOhm, rheobase 111.8 pA).
// Threshold is rest + rheobase x input resistance = -67 + 26.4 = -40.6 mV, an estimate from those same means.
// Every other voltage (drive, noise, synapses) is in the same units; K converts from the original 15 mV rest-to-threshold gap,
// so the model behaves exactly as before the change, only expressed in measured larval units.
const GAP = 0.1118 * 236, K = GAP / 15;   // 26.4 mV / 15 mV
export const P = {
  dt: 0.5,            // ms
  simMs: 6000,        // model time per cycle
  tauM: 20,           // membrane time constant, ms (larval zebrafish tectal neurons: 21 +/- 7 ms, Grama & Engert 2012)
  vRest: -67, vReset: -67, vTh: -67 + GAP, tRef: 2,
  mu0: 10.9 * K,      // resting drive in mV (below threshold: firing at rest comes from noise)
  muGain: 8.4 * K,    // mV per unit of market drive
  sigma: 3.6 * K,     // membrane noise, mV
  wInh: 0.35 * K,     // mV taken from every other cell per spike (shared inhibitory pool)
  wMax: 1.6 * K,      // mV, largest learned excitatory synapse
  eta: 0.05 * K,      // Hebbian rate, mV per cycle at full co-activity
  wDecay: 0.015,      // synapse decay per cycle
  rRest: 6,           // Hz, activity at or below this does not wire anything
  rRef: 20,           // Hz above rest treated as "fully active" for Hebbian products
  // GCaMP6s, measured in vivo per single spike (Chen et al., Nature 2013, Supplementary Table 3, mouse V1):
  // dF/F 23 +/- 3.2 %, half-decay 550 +/- 52 ms, rise to peak 179 +/- 23 ms. Modelled as a double exponential
  // with tauCa = 550 / ln 2 and tauRise solved so the peak lands at 179 ms; caStep is that 23 % peak.
  tauCa: 550 / Math.LN2,   // 793.5 ms
  tauRise: 65.99,          // ms
  caStep: 0.23,            // dF/F at the peak of one spike
  caMax: 16.8,             // dF/F ceiling: GCaMP6s dynamic range, 1680 +/- 48 % at 160 APs (Chen et al. 2013, Supplementary Table 1)
  caEvery: 50,        // ms between dF/F samples (120 samples per cycle)
  vEvery: 10,         // ms between membrane-voltage samples (600 per cycle, for the lab's live circuit)
  wScale: K,          // synapses learned before this change were in the old units; engine.mjs rescales them once
};

let seed = 1;
// mulberry32: a plain LCG made the noise visibly periodic in the raster
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

export const newCircuit = (n) => ({ W: Array.from({ length: n }, () => new Array(n).fill(0)), L: new Array(n).fill(0) });

/**
 * Run one cycle.
 * drive: per-cell market drive in [-1, 1]; L: learned value per cell in [-1, 1] (scales positive drive, biases negative).
 * Returns rates (Hz), spike times (ms) per cell, and dF/F traces.
 */
export function run(C, drive, opts = {}) {
  seed = (opts.seed ?? 1) >>> 0 || 1;
  const n = drive.length, { dt } = P, steps = Math.round(P.simMs / dt);
  const V = new Float64Array(n).fill(P.vRest), ref = new Float64Array(n), ca = new Float64Array(n), caR = new Float64Array(n);
  const spikes = Array.from({ length: n }, () => []), traces = Array.from({ length: n }, () => []), volts = Array.from({ length: n }, () => []);
  const mu = drive.map((d, k) => {
    const L = C.L[k] || 0, g = d > 0 ? d * (1 + 0.8 * L) : d * (1 - 0.4 * L);
    return P.mu0 + P.muGain * Math.max(-1.6, Math.min(1.8, g));
  });
  const noiseK = P.sigma * Math.sqrt(2 * dt / P.tauM), caDecay = Math.exp(-dt / P.tauCa), riseDecay = Math.exp(-dt / P.tauRise);
  const tPk = (P.tauCa * P.tauRise / (P.tauCa - P.tauRise)) * Math.log(P.tauCa / P.tauRise), kick = P.caStep / (Math.exp(-tPk / P.tauCa) - Math.exp(-tPk / P.tauRise));
  const sampleEvery = Math.round(P.caEvery / dt), vSampleEvery = Math.round(P.vEvery / dt);
  let fired = [];
  for (let s = 0; s < steps; s++) {
    const t = s * dt;
    // synaptic kicks from last step's spikes
    if (fired.length) {
      for (const j of fired) for (let k = 0; k < n; k++) if (k !== j) V[k] += C.W[j][k] - P.wInh;
    }
    const now = [];
    for (let k = 0; k < n; k++) {
      ca[k] *= caDecay; caR[k] *= riseDecay;
      if (ref[k] > 0) { ref[k] -= dt; continue; }
      V[k] += (dt / P.tauM) * (P.vRest + mu[k] - V[k]) + noiseK * gauss();
      if (V[k] >= P.vTh) { V[k] = P.vReset; ref[k] = P.tRef; spikes[k].push(+t.toFixed(1)); ca[k] += kick; caR[k] += kick; now.push(k); }
    }
    fired = now;
    if (s % sampleEvery === 0) for (let k = 0; k < n; k++) traces[k].push(+Math.min(P.caMax, ca[k] - caR[k]).toFixed(3));
    if (s % vSampleEvery === 0) for (let k = 0; k < n; k++) volts[k].push(+Math.min(P.vTh, V[k]).toFixed(1));
  }
  const rates = spikes.map((x) => x.length / (P.simMs / 1000));
  return { rates, spikes, traces, volts, mu };
}

/** Hebbian update: co-active cells strengthen their mutual synapses, every synapse decays a little. */
export function hebb(C, rates) {
  const n = rates.length, r = rates.map((x) => Math.min(1.5, Math.max(0, x - P.rRest) / P.rRef));
  for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    if (j === k) continue;
    const w = C.W[j][k] * (1 - P.wDecay) + P.eta * r[j] * r[k];
    C.W[j][k] = Math.min(P.wMax, Math.max(0, w));
  }
}
