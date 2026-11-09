// node server/fetch-news.mjs: daily average news tone per asset from the GDELT 2.0 DOC API (timelinetone, English sources).
// GDELT tone is the average sentiment of every article matching the query that day (roughly -10..+10, most days -3..+3).
import fs from "node:fs";
const D = new URL("../data/", import.meta.url).pathname;
const Q = { ETH: '(ethereum OR "ether price")', SPY: '("S&P 500" OR "wall street stocks")', QQQ: '("nasdaq 100" OR "nasdaq composite")', NVDA: "nvidia", TSLA: "tesla",
  AAPL: '("apple inc" OR iphone)', MSFT: "microsoft", AMZN: '("amazon.com" OR "amazon stock" OR "amazon inc")', GOOGL: "(alphabet OR google)", META: '("meta platforms" OR facebook)', COIN: "coinbase" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fmt = (d) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
const chunks = []; for (let d = new Date("2024-09-01T00:00:00Z"); d < new Date(); ) { const e = new Date(d); e.setUTCMonth(e.getUTCMonth() + 3); chunks.push([new Date(d), e < new Date() ? e : new Date()]); d = e; }
const out = {};
for (const [sym, q] of Object.entries(Q)) {
  const days = new Map();
  for (const [a, b] of chunks) {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + " sourcelang:english")}&mode=timelinetone&format=json&startdatetime=${fmt(a)}&enddatetime=${fmt(b)}`;
    for (let i = 0; ; i++) {
      try { const t = await (await fetch(url, { signal: AbortSignal.timeout(60000) })).text(); const j = JSON.parse(t);
        for (const p of j.timeline?.[0]?.data || []) days.set(Date.UTC(+p.date.slice(0, 4), +p.date.slice(4, 6) - 1, +p.date.slice(6, 8)) / 1000, p.value); break; }
      catch (e) { if (i > 5) { console.log(sym, "chunk failed", fmt(a)); break; } await sleep(10000 * (i + 1)); }
    }
    await sleep(6000);
  }
  out[sym] = [...days.entries()].sort((x, y) => x[0] - y[0]);
  console.log(sym, out[sym].length, "days", new Date(out[sym][0][0] * 1000).toISOString().slice(0, 10), "→", new Date(out[sym].at(-1)[0] * 1000).toISOString().slice(0, 10));
}
fs.writeFileSync(D + "news-1d.json", JSON.stringify({ source: "GDELT 2.0 DOC API timelinetone, English sources", queries: Q, fetchedAt: new Date().toISOString(), days: out }));
