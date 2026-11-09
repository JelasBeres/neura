// node server/fetch-news-fill.mjs: daily GDELT news tone per asset, one request per asset for the whole period;
// assets already in data/news-1d.json are skipped. Saved after every asset, so a killed run loses at most one asset.
// Only the dev period is filled (until 2026-08-12); the sealed holdout is not needed.
import fs from "node:fs";
const D = new URL("../data/", import.meta.url).pathname;
const Q = { ETH: '(ethereum OR "ether price")', SPY: '("S&P 500" OR "wall street stocks")', QQQ: '("nasdaq 100" OR "nasdaq composite")', NVDA: "nvidia", TSLA: "tesla",
  AAPL: '("apple inc" OR iphone)', MSFT: "microsoft", AMZN: '("amazon.com" OR "amazon stock" OR "amazon inc")', GOOGL: "(alphabet OR google)", META: '("meta platforms" OR facebook)', COIN: "coinbase" };
const N = fs.existsSync(D + "news-1d.json") ? JSON.parse(fs.readFileSync(D + "news-1d.json")) : { source: "GDELT 2.0 DOC API timelinetone, English sources", queries: Q, days: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fmt = (d) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14), END = new Date("2026-08-12T00:00:00Z");
// one request per asset covers the whole dev period at daily resolution (GDELT allows one request every ~5 s and blocks bursts for long)
const SEED = process.env.SEED ? JSON.parse(fs.readFileSync(process.env.SEED)) : null; // optional: a timelinetone answer already fetched for ETH
for (const [sym, q] of Object.entries(N.queries)) {
  if ((N.days[sym] || []).length > 600) { console.log(sym, "already have", N.days[sym].length, "days"); continue; }
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + " sourcelang:english")}&mode=timelinetone&format=json&startdatetime=20240901000000&enddatetime=${fmt(END)}`;
  let j = sym === "ETH" ? SEED : null;
  for (let i = 0; !j; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      // GDELT answers 429 for a while after any burst: wait a minute and ask again, as long as it takes
      if (r.status === 429) { if (i % 10 === 0) console.log(sym, "rate limited, waiting"); await sleep(60000); continue; }
      j = JSON.parse(await r.text()); }
    catch { await sleep(60000); }
  }
  N.days[sym] = (j.timeline?.[0]?.data || []).map((p) => [Date.UTC(+p.date.slice(0, 4), +p.date.slice(4, 6) - 1, +p.date.slice(6, 8)) / 1000, p.value]);
  console.log(sym, N.days[sym].length, "days");
  N.fetchedAt = new Date().toISOString(); fs.writeFileSync(D + "news-1d.json", JSON.stringify(N));
  await sleep(10000);
}
