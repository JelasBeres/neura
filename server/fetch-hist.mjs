// node server/fetch-hist.mjs [interval=1h] [range=2y]: hourly closes for the eleven assets from Yahoo's chart API -> data/hist-<interval>.json
// Backtests run on the underlying prices; the Robinhood Chain tokens track them.
import fs from "node:fs";
const [interval = "1h", range = "2y"] = process.argv.slice(2);
const SYMS = { ETH: "ETH-USD", SPY: "SPY", QQQ: "QQQ", NVDA: "NVDA", TSLA: "TSLA", AAPL: "AAPL", MSFT: "MSFT", AMZN: "AMZN", GOOGL: "GOOGL", META: "META", COIN: "COIN" };
const out = {};
for (const [sym, y] of Object.entries(SYMS)) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=${interval}&range=${range}`, { headers: { "user-agent": "Mozilla/5.0" } });
  const j = await r.json(), res = j.chart?.result?.[0];
  if (!res) { console.error(sym, JSON.stringify(j).slice(0, 200)); process.exit(2); }
  const t = res.timestamp, c = res.indicators.quote[0].close;
  out[sym] = t.map((ts, i) => [ts, c[i]]).filter((p) => p[1] != null);
  console.log(sym, out[sym].length, new Date(out[sym][0][0] * 1000).toISOString().slice(0, 10), "→", new Date(out[sym].at(-1)[0] * 1000).toISOString().slice(0, 10));
}
fs.writeFileSync(new URL(`../data/hist-${interval}.json`, import.meta.url), JSON.stringify(out));
