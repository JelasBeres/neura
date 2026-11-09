// load(rel): a JSON file under data/. Node reads it from disk; a browser fetches it from globalThis.NEURA_DATA (a URL ending in "/").
// The league engine (lab/core.mjs, league/orgs.mjs, league/foods.mjs, league/evaluate.mjs) only reads data through this, so the very
// same files run on the server and in a visitor's browser ("Verify in your browser").
const NODE = typeof process !== "undefined" && !!process.versions?.node;
export async function load(rel) {
  if (NODE) { const fs = await import("node:fs"), f = new URL("../../data/" + rel, import.meta.url); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; }
  const r = await fetch(new URL(rel, globalThis.NEURA_DATA)); return r.ok ? r.json() : null;
}
