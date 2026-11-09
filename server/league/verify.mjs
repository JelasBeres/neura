// Recompute an organism's published test result from scratch: for each fold, the setting it chose on training data, run on the
// fold with the same five seeds, returns averaged, folds stitched. Pure (evaluate.mjs), so it runs in node and in a browser.
// verify(published, org, onProgress) -> { folds: [{ published, recomputed, match }], stitched: { published, recomputed, match } }
import { ctx, metrics } from "../lab/core.mjs";
import { evaluate } from "./evaluate.mjs";
const SEEDS = [1, 2, 3, 4, 5], at = new Map(ctx.clock.map((t, i) => [t, i])), r4 = (v) => +(+v).toFixed(4);
export async function verify(L, org, onProgress = () => {}) {
  const O = L.organisms[org], all = [], folds = [];
  for (const [f, fold] of O.folds.entries()) {
    const a = at.get(fold.from), b = at.get(fold.to) + 1, runs = [];
    for (const seed of SEEDS) { runs.push(evaluate({ exp: L.id, org, p: fold.best, seed, t0: a, t1: b, linkAt: a }).r); onProgress((f * SEEDS.length + runs.length) / (O.folds.length * SEEDS.length)); await new Promise((r) => setTimeout(r)); }
    const r = runs[0].map((_, i) => runs.reduce((s, x) => s + x[i], 0) / runs.length), m = metrics(r); all.push(...r);
    folds.push({ from: fold.from, to: fold.to, best: fold.best, published: fold.test.ret, recomputed: r4(m.ret), match: r4(m.ret) === fold.test.ret });
  }
  const S = metrics(all), rec = { ret: r4(S.ret), sharpe: +S.sharpe.toFixed(3) };
  return { folds, stitched: { published: { ret: O.stitched.ret, sharpe: O.stitched.sharpe }, recomputed: rec, match: rec.ret === O.stitched.ret && rec.sharpe === O.stitched.sharpe } };
}
