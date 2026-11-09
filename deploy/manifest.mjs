// node deploy/manifest.mjs <dist>: SHA-256 of every engine and raw-data file the site serves -> <dist>/raw/manifest.json.
// data.html shows these hashes and can recompute them in the visitor's browser.
import fs from "node:fs"; import crypto from "node:crypto"; import path from "node:path";
const O = process.argv[2], files = [];
const walk = (d) => fs.readdirSync(path.join(O, d)).sort().forEach((f) => { const r = path.join(d, f); fs.statSync(path.join(O, r)).isDirectory() ? walk(r) : r.endsWith("manifest.json") || files.push(r); });
walk("engine"); walk("raw");
const out = { builtAt: new Date().toISOString(), files: files.map((f) => { const b = fs.readFileSync(path.join(O, f)); return { path: f, bytes: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex") }; }) };
fs.writeFileSync(path.join(O, "raw/manifest.json"), JSON.stringify(out, null, 1));
console.log(out.files.length, "files hashed");
