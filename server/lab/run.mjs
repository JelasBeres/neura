// node server/lab/run.mjs EXP-001 [--holdout]: run one experiment through the lab harness and print the verdict
import { runExperiment, SYMS } from "./harness.mjs";
const id = process.argv[2], exp = (await import(`./exp/${id}.mjs`)).default;
const r = runExperiment(exp, { holdout: process.argv.includes("--holdout") });
const d = (t) => new Date(t * 1000).toISOString().slice(0, 10), pc = (x) => (x * 100).toFixed(1).padStart(6) + "%";
const row = (m) => `${pc(m.ret)}  sh ${m.sharpe.toFixed(2).padStart(5)}  dd ${pc(m.maxDD)}${m.turnover != null ? "  to/yr " + m.turnover : ""}`;
console.log(`${r.id} · ${r.title} · grid ${r.data.gridSize} · dev ${r.data.devBars} bars, ${r.data.lockedBars} sealed`);
for (const f of r.folds) console.log(`fold ${d(f.from)}→${d(f.to)} ${f.win ? "WIN " : "lose"} | physarum ${row(f.physarum)} | hold ${row(f.hold)} | random ${row(f.random)} | train sh ${f.trainSharpe} (median ${f.medianTrainSharpe}) look ${f.best.look}`);
console.log(`stitched | physarum ${row(r.stitched.physarum)} | hold ${row(r.stitched.hold)} | random ${row(r.stitched.random)}`);
for (const g of r.gates) console.log(`  ${g.pass ? "✓" : "✗"} ${g.name}`);
if (r.holdout) console.log("holdout", r.holdout.pass ? "PASS" : "FAIL", row(r.holdout.S), "vs hold", row(r.holdout.H));
console.log("VERDICT:", r.verdict);
