// League numbers for the landing candidates, read from the packed league results (map/data). Each organism shows its best
// pre-registered experiment so far, labelled with its id; the hold row is the same for every experiment.
// EXP-002 (on-chain flow) is left out: its window is ~5 weeks, so its numbers are not comparable with the two-year hold row (it is on the map)
const ids = ["EXP-001", "EXP-003", "EXP-004", "EXP-005"];
const L = (await Promise.all(ids.map((id) => fetch(new URL(`../../map/data/league-${id}.json`, import.meta.url)).then((r) => (r.ok ? r.json() : null), () => null)))).filter(Boolean);
const KEYS = ["physarum", "worm", "fry", "ant", "bee", "ecoli"];
export const ROWS = KEYS.map((k) => {
  const best = L.map((x) => ({ id: x.id, o: x.organisms[k] })).filter((x) => x.o)
    .sort((a, b) => b.o.gates.filter((g) => g.pass).length - a.o.gates.filter((g) => g.pass).length || b.o.stitched.sharpe - a.o.stitched.sharpe)[0];
  if (!best) return { k, status: "PENDING" };
  const s = best.o.stitched;
  return { k, exp: best.id, ret: +(s.ret * 100).toFixed(1), sharpe: +s.sharpe.toFixed(2), dd: +(s.maxDD * 100).toFixed(1), gates: best.o.gates.filter((g) => g.pass).length, status: best.o.verdict };
}).sort((a, b) => (b.gates ?? -1) - (a.gates ?? -1) || (b.sharpe ?? -9) - (a.sharpe ?? -9));
const h = L[0].bench.hold, r = L[0].bench.random;
export const BENCH = [{ name: "Hold (equal weight)", ret: +(h.ret * 100).toFixed(1), sharpe: +h.sharpe.toFixed(2), dd: +(h.maxDD * 100).toFixed(1) }, { name: "Random", ret: +(r.ret * 100).toFixed(1), sharpe: +r.sharpe.toFixed(2), dd: +(r.maxDD * 100).toFixed(1) }];
export const pct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
