// One evaluation: an organism with one setting and one seed, born at t0, trading until t1. Pure: run by worker.mjs on the server
// and by the site's "Verify in your browser", so both compute with exactly this code.
import { ctx, n, run, linksFor } from "../lab/core.mjs";
import { ORGS } from "./orgs.mjs";
import { EXPS } from "./foods.mjs";
const foods = new Map(), zeros = Array.from({ length: ctx.T }, () => new Array(n).fill(0)), eqw = new Array(n).fill(1 / n), linkCache = new Map();
const foodFor = (exp, look) => { const k = exp + look; if (!foods.has(k)) foods.set(k, EXPS[exp].food(ctx, { look })); return foods.get(k); };
export function evaluate({ exp, org, p, seed, t0, t1, linkAt, blind, record }) {
  const O = ORGS[org], E = EXPS[exp];
  if (!linkCache.has(linkAt)) linkCache.set(linkAt, linksFor(0, linkAt));
  const me = O.make({ ...ctx, links: linkCache.get(linkAt) }, blind ? zeros : foodFor(exp, p.look), p, seed);
  const every = p.every || 7, band = 0.1, rebal = E.guard || O.mode === "rebalance", frames = [];
  const alloc = (t, w) => {
    let target = me.step(t);
    if (E.guard) { const f = target.reduce((a, x) => a + x, 0); target = eqw.map((x) => x * f); }
    const nw = !rebal ? target : t % every === 0 && target.reduce((a, x, k) => a + Math.abs(x - w[k]), 0) > band ? target : w;
    if (record && (t - t0) % 2 === 0) frames.push({ t: ctx.clock[t], w: nw.map((x) => +x.toFixed(3)), inner: me.inner().map((x) => +(+x).toFixed(3)) });
    return nw;
  };
  const R = run(alloc, t0, t1);
  return { ret: R.ret, sharpe: R.sharpe, maxDD: R.maxDD, turnover: R.turnover, r: Float64Array.from(R.r), frames: record ? frames : null };
}
