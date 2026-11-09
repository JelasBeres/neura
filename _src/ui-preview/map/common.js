// Shared bits for the map and the specimen pages: the books, the mechanism links, the league loader.
import { ORGS } from "../landing/g/specimens.js";
export { ORGS };
export const BOOKS = {
  ...Object.fromEntries(Object.entries(ORGS).map(([k, o]) => [k, { ...o, kind: "org" }])),
  hold: { name: "Hold", latin: "equal weight, never trades", color: "#8b8f98", kind: "bench" },
  random: { name: "Random", latin: "reshuffles every 5 days", color: "#5d616a", kind: "bench" },
};
// shared biological principles, the only links that need no data
export const MECH = [
  ["physarum", "ant", "Positive feedback", "Both reinforce the path that pays: thicker tube, stronger trail. Unused routes fade."],
  ["ant", "bee", "No leader", "Colony and swarm decide collectively; no single individual sees the whole picture."],
  ["worm", "fry", "Spiking neurons", "Both decide with real neuron models: cells charge, fire and pass the signal on."],
  ["physarum", "worm", "Chemotaxis", "Both move up a food gradient: the blob by flow, the worm by smell neurons ASE and AWC."],
  ["ecoli", "physarum", "Single cell", "One cell, no neurons. Both decide with chemistry alone: the blob by flow, the bacterium by receptors."],
  ["ecoli", "worm", "Biased random walk", "The worm's pirouettes work like bacterial tumbles: turn more often when food is dropping (Pierce-Shimomura et al. 1999)."],
  ["bee", "fry", "Threshold", "A swarm moves at a quorum; a fry cell fires at a voltage threshold. Same idea, different scale."],
];
// what each organism's inner number means (one per asset, from server/league/orgs.mjs)
export const INNER = { physarum: "tube conductivity", worm: "learned value L", fry: "firing rate, Hz", ant: "pheromone", bee: "scouts at site", ecoli: "cells at site" };
const cache = new Map();
export const EXPS = fetch(new URL("data/league-index.json", import.meta.url)).then((r) => r.json());
export const league = (id) => { if (!cache.has(id)) cache.set(id, fetch(new URL(`data/league-${id}.json`, import.meta.url)).then((r) => r.json())); return cache.get(id); };
export const pct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(1) + "%";
export const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
export const weights = (L, k, i) => (k === "hold" ? L.bench.holdW[i] : k === "random" ? L.bench.randomW[i] : L.organisms[k]?.frames[i].w);
export const stats = (L, k) => (k === "hold" || k === "random" ? L.bench[k] : L.organisms[k]?.stitched);
export const status = (L, k) => (BOOKS[k].kind === "bench" ? "BENCH" : L.organisms[k] ? L.organisms[k].verdict : "PENDING");
