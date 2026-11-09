// node server/live/forward.mjs [outDir]: the LIVE-001 forward test, recomputed from its start on every run (hourly by cron).
// 1) fetches hourly closes from Yahoo (only bars that have closed), 2) runs every registered book through the same engine as the
// backtest (lab/core.mjs + league/evaluate.mjs) from the first bar after registration, 3) writes live.json, the price file it used,
// and appends to chain.json: each entry's SHA-256 covers the previous entry's hash and this run's summary, so history can't be
// rewritten quietly. Deterministic: anyone with hist-live.json and the engine gets the same live.json numbers.
import fs from "node:fs"; import crypto from "node:crypto";
const D = new URL("../../data/", import.meta.url).pathname, OUT = (process.argv[2] || D + "live/site") + "/", C = JSON.parse(fs.readFileSync(D + "live/config.json"));
const START = +(process.env.TEST_START || C.start), now = Date.now() / 1000;
const Y = { ETH: "ETH-USD", SPY: "SPY", QQQ: "QQQ", NVDA: "NVDA", TSLA: "TSLA", AAPL: "AAPL", MSFT: "MSFT", AMZN: "AMZN", GOOGL: "GOOGL", META: "META", COIN: "COIN" };
const days = Math.min(729, Math.ceil((now - START) / 86400) + 45), H = {};
for (const [sym, y] of Object.entries(Y)) {
  for (let i = 0; ; i++) {
    try { const j = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1h&range=${days}d`, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30000) })).json();
      const res = j.chart.result[0], c = res.indicators.quote[0].close; H[sym] = res.timestamp.map((t, k) => [t, c[k]]).filter(([t, v]) => v != null && t + 3600 <= now); break; }
    catch (e) { if (i > 4) throw new Error(`${sym}: ${e.message}`); await new Promise((r) => setTimeout(r, 5000 * (i + 1))); }
  }
}
fs.mkdirSync(D + "live", { recursive: true }); fs.writeFileSync(D + "live/hist-live.json", JSON.stringify(H));
globalThis.NEURA_HIST = "live/hist-live.json";
const { ctx, run, metrics, hold } = await import("../lab/core.mjs"), { evaluate } = await import("../league/evaluate.mjs");
const s = ctx.clock.findIndex((t) => t >= START), T = ctx.T, r4 = (v) => +(+v).toFixed(4);
const eqc = (r) => { let e = 1; return [1, ...r.map((x) => +(e *= 1 + x).toFixed(5))]; };
let out;
if (s < 0 || T - s < 3) out = { id: C.id, registeredAt: C.registeredAt, start: START, updatedAt: new Date().toISOString(), bars: 0, waiting: true, syms: ctx.SYMS };
else {
  const Hd = run(hold(), s, T), books = C.books.map((b) => {
    const runs = C.seeds.map((seed) => evaluate({ exp: b.exp, org: b.org, p: b.p, seed, t0: s, t1: T, linkAt: s, record: seed === C.seeds[0] }));
    const r = runs[0].r.map((_, i) => runs.reduce((a, x) => a + x.r[i], 0) / runs.length), m = metrics(r), last = runs[0].frames.at(-1);
    return { exp: b.exp, org: b.org, p: b.p, ret: r4(m.ret), sharpe: +m.sharpe.toFixed(3), maxDD: r4(m.maxDD), curve: eqc(r), w: last?.w, inner: last?.inner };
  });
  out = { id: C.id, registeredAt: C.registeredAt, start: START, updatedAt: new Date().toISOString(), firstBar: ctx.clock[s], lastBar: ctx.clock[T - 1], bars: T - s, syms: ctx.SYMS, t: ctx.clock.slice(s, T),
    hold: { ret: r4(Hd.ret), sharpe: +Hd.sharpe.toFixed(3), maxDD: r4(Hd.maxDD), curve: eqc(Hd.r) }, books };
}
const body = JSON.stringify(out); fs.mkdirSync(OUT, { recursive: true });
// the chain covers a small summary: the input prices' hash plus every book's numbers (live.json follows from them deterministically)
const histSha = crypto.createHash("sha256").update(fs.readFileSync(D + "live/hist-live.json")).digest("hex");
const summary = { lastBar: out.lastBar ?? null, bars: out.bars, hist: histSha, hold: out.hold?.ret ?? null, books: (out.books || []).map((b) => [b.exp, b.org, b.ret, b.sharpe, b.maxDD]) };
const chainF = OUT + "chain.json", chain = fs.existsSync(chainF) ? JSON.parse(fs.readFileSync(chainF)) : [], prev = chain.at(-1);
if (!prev || prev.summary.lastBar !== summary.lastBar) chain.push({ at: out.updatedAt, summary, prev: prev?.sha256 || null, sha256: crypto.createHash("sha256").update((prev?.sha256 || "") + JSON.stringify(summary)).digest("hex") });
fs.writeFileSync(OUT + "live.json", body); fs.writeFileSync(chainF, JSON.stringify(chain, null, 1)); fs.copyFileSync(D + "live/hist-live.json", OUT + "hist-live.json");
console.log(new Date().toISOString(), out.waiting ? "waiting for the first bar" : `${out.bars} bars · hold ${out.hold.ret} · best ${[...out.books].sort((a, b) => b.ret - a.ret)[0].org}/${out.books.sort((a, b) => b.ret - a.ret)[0].exp}`);
