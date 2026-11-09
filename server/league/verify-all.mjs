// node server/league/verify-all.mjs [orgs]: recompute every published league result from scratch and compare, fold by fold.
// Same check as the site's "Recompute" button (verify.mjs), for all experiments at once. Fry takes about a minute per experiment.
import fs from "node:fs";
import { verify } from "./verify.mjs";
const P = new URL("../../_src/ui-preview/map/data/", import.meta.url), orgs = (process.argv[2] || "physarum,worm,fry,ant,bee,ecoli").split(",");
let bad = 0;
for (const { id } of JSON.parse(fs.readFileSync(new URL("league-index.json", P)))) {
  const L = JSON.parse(fs.readFileSync(new URL(`league-${id}.json`, P)));
  for (const org of orgs) { const v = await verify(L, org), ok = v.stitched.match && v.folds.every((f) => f.match); bad += !ok;
    console.log(id, org.padEnd(9), ok ? "MATCH   " : "MISMATCH", "published", JSON.stringify(v.stitched.published), "recomputed", JSON.stringify(v.stitched.recomputed)); }
}
console.log(bad ? `${bad} result(s) did not reproduce` : "every published result reproduced exactly"); process.exit(bad ? 1 : 0);
