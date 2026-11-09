// node server/fetch-flow.mjs: every Uniswap v3 Swap in the eleven USDG pools on Robinhood Chain since genesis, aggregated per UTC hour
// into USDG bought and sold (a swap that puts USDG into the pool is a buy of the token). Read-only RPC calls, nothing is sent.
// Block timestamps are interpolated between anchors fetched every 500k blocks (blocks are ~0.15 s, so the error is seconds).
import fs from "node:fs";
const D = new URL("../data/", import.meta.url).pathname, C = JSON.parse(fs.readFileSync(D + "assets.json")), RPC = C.chain.rpc, USDG = C.usdg.address.toLowerCase();
const TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67", STEP = 100000, ANCHOR = 500000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) { for (let i = 0; ; i++) { try { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30000) }); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result; } catch (e) { if (/exceeds limit/.test(e.message) || (i > 8 && !/429|Too Many/.test(e.message))) throw e; await sleep(1000 * 2 ** Math.min(i, 5)); } } }
const hex = (n) => "0x" + n.toString(16), head = parseInt(await rpc("eth_blockNumber", []), 16);
const anchors = new Map(); const ts = async (n) => { if (!anchors.has(n)) anchors.set(n, parseInt((await rpc("eth_getBlockByNumber", [hex(n), false])).timestamp, 16)); return anchors.get(n); };
const at = async (n) => { const a = Math.floor(n / ANCHOR) * ANCHOR || 1, b = Math.min(head, a + ANCHOR); const ta = await ts(a), tb = await ts(b); return ta + ((tb - ta) * (n - a)) / Math.max(1, b - a); };
// token0 is the lower address; USDG's side tells which amount is USDG
const pools = C.assets.map((a) => ({ sym: a.sym, pool: a.pool.toLowerCase(), usdg0: USDG < a.token.toLowerCase() }));
const byPool = new Map(pools.map((p) => [p.pool, p])), out = Object.fromEntries(pools.map((p) => [p.sym, new Map()]));
const s256 = (h) => { let v = BigInt("0x" + h); if (v >> 255n) v -= 1n << 256n; return v; };
// a range with more than 10,000 swaps is refused by the RPC: split it in half until each piece fits
async function getLogs(from, to) {
  try { return await rpc("eth_getLogs", [{ address: pools.map((p) => p.pool), topics: [TOPIC], fromBlock: hex(from), toBlock: hex(to) }]); }
  catch (e) { if (!/exceeds limit/.test(e.message) || from >= to) throw e; const m = Math.floor((from + to) / 2); return [...(await getLogs(from, m)), ...(await getLogs(m + 1, to))]; }
}
// stop at the end of the dev period (+1 day): the sealed holdout is not fetched (UNTIL=unix seconds, default 2026-08-12)
const UNTIL = +(process.env.UNTIL || Date.parse("2026-08-12T14:00:00Z") / 1000);
let lo = 1, hi = head; while (lo < hi) { const m = Math.floor((lo + hi) / 2); if ((await ts(m)) < UNTIL) lo = m + 1; else hi = m; } const end = lo;
console.log(`fetching blocks 1..${end} (until ${new Date(UNTIL * 1000).toISOString()})`);
// checkpoint: finished ranges and their hourly sums are saved every 20 ranges, so a killed run resumes where it stopped
const CK = D + "flow-partial.json", ck = fs.existsSync(CK) ? JSON.parse(fs.readFileSync(CK)) : null, fin = new Set(ck && ck.end === end ? ck.fin : []);
if (fin.size) for (const [s, rows] of Object.entries(ck.out)) for (const [h, b, sl, c] of rows) out[s].set(h, [b, sl, c]);
const save = () => fs.writeFileSync(CK, JSON.stringify({ end, fin: [...fin], n, out: Object.fromEntries(Object.entries(out).map(([s, m]) => [s, [...m.entries()].map(([h, r]) => [h, ...r])])) }));
let n = fin.size ? ck.n : 0, t0 = Date.now(), next = 1, done = fin.size; const total = Math.ceil(end / STEP);
if (fin.size) console.log(`resuming: ${fin.size}/${total} ranges already done`);
// 3 ranges in flight at once (4 trips the RPC rate limit); the hourly sums do not depend on order
async function lane() { for (;;) { while (fin.has(next)) next += STEP; const from = next; if (from > end) return; next += STEP;
  const to = Math.min(end, from + STEP - 1), logs = await getLogs(from, to);
  for (const l of logs) {
    const p = byPool.get(l.address.toLowerCase()), d = l.data.slice(2), a0 = s256(d.slice(0, 64)), a1 = s256(d.slice(64, 128)), u = Number(p.usdg0 ? a0 : a1) / 1e6;
    const hour = Math.floor((await at(parseInt(l.blockNumber, 16))) / 3600) * 3600, row = out[p.sym].get(hour) || [0, 0, 0];
    if (u > 0) row[0] += u; else row[1] += -u; row[2]++; out[p.sym].set(hour, row); n++;
  }
  fin.add(from); if (++done % 20 === 0) save(), console.log(`${(100 * done / total).toFixed(0)}% · ${done}/${total} ranges · ${n} swaps · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await sleep(120);
} }
await Promise.all([lane(), lane(), lane()]);
const res = { source: `Uniswap v3 Swap logs, ${RPC}`, head: end, until: UNTIL, fetchedAt: new Date().toISOString(), hours: Object.fromEntries(Object.entries(out).map(([s, m]) => [s, [...m.entries()].sort((a, b) => a[0] - b[0]).map(([h, r]) => [h, +r[0].toFixed(2), +r[1].toFixed(2), r[2]])])) };
fs.writeFileSync(D + "flow-1h.json", JSON.stringify(res)); fs.rmSync(CK, { force: true });
for (const [s, rows] of Object.entries(res.hours)) console.log(s, rows.length, "hours", rows.length ? new Date(rows[0][0] * 1000).toISOString().slice(0, 10) : "-", rows.reduce((a, r) => a + r[3], 0), "swaps");
