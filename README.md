# NEURA

Six living minds trade the same eleven assets under the same pre-registered rules, and every number can be recomputed.

| Organism | Mechanism | Source |
|---|---|---|
| Physarum (slime mold) | tubes that carry flow thicken, idle tubes wither | Tero, Kobayashi & Nakagaki 2007 |
| Worm (*C. elegans*) | smell runs through the real 302-neuron wiring diagram to a turn or a run | Cook et al. 2019 connectome |
| Fry (zebrafish larva) | 11 spiking cells with Hebbian synapses: a cell that fires hard enough buys | leaky integrate-and-fire model |
| Ant colony | profitable trails get pheromone, unused trails evaporate | Dorigo & Gambardella 1997; Stützle & Hoos 2000 |
| Bee swarm | scouts dance for sites, the swarm moves at a quorum | Seeley & Buhrman 1999; Passino & Seeley 2006 |
| E. coli | run and tumble: keep swimming while food improves | Berg & Brown 1972 |

Live site: https://neurarh.trade · forward test: https://neurarh.trade/live.html

## Rules (same for every organism)

- Walk-forward over four folds; each organism is born fresh at the start of a fold.
- 48 settings per organism, chosen only on data before each fold (best training Sharpe).
- 0.3% cost on every unit traded; five seeds on test, returns averaged; a blind twin with no food as a control.
- Gates, all four required: beats equal-weight hold on return, on Sharpe, drawdown no worse, wins at least 3 of 4 folds.
- The last three months are sealed and opened only for an experiment that passes every gate. None has.
- Hypotheses are written to `data/lab/ledger.json` before each run.

## Reproduce

Needs Node.js 20 or newer. There are no dependencies to install.

```sh
node server/league/verify-all.mjs            # recompute every published result and compare, fold by fold
DRY=1 node server/league/run.mjs EXP-004     # rerun a whole experiment, setting selection included -> data/league/dry/
```

The exact input files are in `data/`: `hist-1h.json` (hourly prices), `flow-1h.json` (Robinhood Chain swaps),
`news-1d.json` (GDELT tone), `league/worm-table.json` (the 302-neuron brain's answers). To fetch them again:
`server/fetch-hist.mjs`, `server/fetch-flow.mjs`, `server/fetch-news-fill.mjs`, `server/league/worm-table.mjs`.

## Layout

- `server/lab/core.mjs`: data, costs, folds, gates, the trading loop (runs in node and in the browser)
- `server/league/orgs.mjs`: the six organisms · `foods.mjs`: the experiments · `evaluate.mjs`: one run · `verify.mjs`: the recompute check
- `server/live/`: the LIVE-001 forward test (`register.mjs` locked it, `forward.mjs` runs hourly)
- `_src/ui-preview/map/`: the site · `deploy/build-neura.sh`: builds it with the engine and raw data inside

## Not proven here

Backtests and the forward test use paper money. Prices are the underlying assets' hourly closes from Yahoo Finance.
EXP-002 has only about five weeks of on-chain data. Registration times before the on-chain anchor are self-reported.

## Data and credits

Prices: Yahoo Finance. News tone: the GDELT Project. On-chain swaps: Robinhood Chain public RPC.
Connectome: Cook et al. 2019 via OpenWorm. Each source keeps its own terms; the code is MIT licensed.
