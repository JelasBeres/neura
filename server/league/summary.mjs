// node server/league/summary.mjs: a small digest of every packed league result for the home page's scroll sections
// (scoreboard, organism cards), so the page doesn't download all six full result files. Numbers are copied, never computed here.
import fs from "node:fs";
const P = new URL("../../_src/ui-preview/map/data/", import.meta.url).pathname;
const thin = (c, k = 60) => Array.from({ length: k }, (_, i) => c[Math.round((i / (k - 1)) * (c.length - 1))]);
const out = JSON.parse(fs.readFileSync(P + "league-index.json")).map(({ id }) => {
  const L = JSON.parse(fs.readFileSync(P + `league-${id}.json`));
  return { id, title: L.title, hold: L.bench.hold, random: L.bench.random, holdCurve: thin(L.eq.hold),
    orgs: Object.fromEntries(Object.entries(L.organisms).map(([k, o]) => [k, { ...o.stitched, gates: o.gates.filter((g) => g.pass).length, curve: thin(L.eq[k]) }])) };
});
fs.writeFileSync(P + "league-summary.json", JSON.stringify(out));
console.log(out.length, "experiments ·", (JSON.stringify(out).length / 1024).toFixed(0) + " KB");
