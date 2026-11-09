// node server/live/register.mjs: pre-register LIVE-001, the forward test, before its first bar exists.
// Each organism keeps the setting it used in its last dev test fold (chosen on data before May 2026) for EXP-001, 004 and 005, the
// experiments whose food is price alone, and trades forward from the first market bar after this moment. Nothing is tuned again.
import fs from "node:fs";
const D = new URL("../../data/", import.meta.url).pathname, LEDGER = D + "lab/ledger.json", L = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
if (L.registered.find((e) => e.id === "LIVE-001")) { console.log("LIVE-001 is already registered"); process.exit(0); }
const EXPS = ["EXP-001", "EXP-004", "EXP-005"], books = [];
for (const exp of EXPS) { const R = JSON.parse(fs.readFileSync(D + `league/${exp}.json`)); for (const [org, o] of Object.entries(R.organisms)) books.push({ exp, org, p: o.folds.at(-1).best }); }
const at = new Date().toISOString(), cfg = { id: "LIVE-001", registeredAt: at, start: Math.floor(Date.parse(at) / 1000), seeds: [1, 2, 3, 4, 5], books };
const hypothesis = "Forward test on data that did not exist at registration: each organism keeps the setting from its last dev test fold for EXP-001, EXP-004 and EXP-005 and trades from the first market bar after registration, same costs and five seeds. Judged with the same four gates against equal-weight hold after at least three months; never re-tuned.";
L.registered.push({ id: "LIVE-001", at, hypothesis, books: books.map((b) => `${b.exp}/${b.org} ${JSON.stringify(b.p)}`), gates: ["beats hold on return", "beats hold on Sharpe", "drawdown no worse than hold", "judged after at least three months"] });
fs.mkdirSync(D + "live", { recursive: true }); fs.writeFileSync(D + "live/config.json", JSON.stringify(cfg, null, 1)); fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
console.log("registered LIVE-001 at", at, "·", books.length, "books");
