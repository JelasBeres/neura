// EXP-001: price momentum as food. The first thing anyone would try, and the baseline every later experiment has to beat.
export default {
  id: "EXP-001",
  title: "Momentum as food",
  foodText: "Risk-adjusted momentum: each asset's lookback return divided by its own volatility. Only positive momentum feeds the plate.",
  hypothesis: "Assets that have been rising feed the plate; tubes toward them thicken, so the blob leans into trends and rests in cash when nothing rises. It should beat equal-weight hold after costs.",
  // written after the run (post-hoc analysis, not part of the registration)
  notes: {
    why: "In training the best of 384 settings looked strong (Sharpe 1.3 to 1.8), but the median setting sat near zero. The winner was the luckiest setting, not a real edge. Out of sample it lost to hold in all four folds. On hourly bars of mega-cap stocks momentum reverses too often, and rebalancing 20 to 50 times a year pays away what is left.",
    learned: "One thing did work: drawdown fell from 23.7% to 15.8%, because the blob rests in cash when nothing is rising. Sitting out protected it, and also made it miss the rallies.",
    next: "Try the opposite (EXP-004, mean reversion as food) and keep only the part that worked (EXP-005, the blob as a risk guard).",
  },
  foodKey: (p) => p.look,
  food({ T, n, px, ret }, { look }) {
    return Array.from({ length: T }, (_, t) => Array.from({ length: n }, (_, k) => {
      if (t < look + 1) return 0; let s = 0; for (let u = t - look + 1; u <= t; u++) s += ret[k][u] ** 2;
      return Math.log(px[k][t] / px[k][t - look]) / (Math.sqrt(s) || 1);
    }));
  },
  grid() {
    const g = [];
    for (const look of [14, 35, 70, 140]) for (const gamma of [0.02, 0.05, 0.12]) for (const mu of [1, 1.8]) for (const g0 of [0.5, 2]) for (const rest of [0.05, 0.3]) for (const every of [7, 35]) for (const band of [0.1, 0.25])
      g.push({ look, gamma, mu, g0, rest, every, band, seed: 7 });
    return g;
  },
};
