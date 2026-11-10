// The scroll sections under the map: how it works, the six minds, the math, scoreboard, rules, live, proof.
// Every number comes from a published file (data/league-summary.json, live/live.json, site.json); nothing is typed in.
import { BOOKS, pct } from "./common.js";
const ORG = Object.keys(BOOKS).filter((k) => BOOKS[k].kind === "org");
const S = await fetch("data/league-summary.json").then((r) => r.json());
const site = await fetch("site.json").then((r) => (r.ok ? r.json() : {}), () => ({}));
const $ = (id) => document.getElementById(id);
const spark = (c, h, color, W = 220, H = 54) => {
  const all = [...c, ...h], lo = Math.min(...all), hi = Math.max(...all), y = (v) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8), x = (i, n) => (i / (n - 1)) * W;
  const path = (a) => a.map((v, i) => `${i ? "L" : "M"}${x(i, a.length).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="spark"><path d="${path(h)}" stroke="#5d616a" fill="none" stroke-width="1.2" stroke-dasharray="3 3"/><path d="${path(c)}" stroke="${color}" fill="none" stroke-width="1.8"/></svg>`;
};

// ---------- the six minds: each organism's best experiment against that experiment's hold ----------
$("minds").innerHTML = ORG.map((k) => {
  const b = BOOKS[k], best = S.map((e) => ({ e, o: e.orgs[k] })).filter((x) => x.o).sort((a, z) => z.o.ret - a.o.ret)[0];
  return `<a class="mind" href="organism?k=${k}&exp=${best.e.id}" style="--c:${b.color}"><div class="mh"><i style="background:${b.color}"></i><b>${b.name}</b><span>${b.brain}</span></div>
  <div class="lat">${b.latin}</div><p>${b.rule}</p>${spark(best.o.curve, best.e.holdCurve, b.color)}
  <div class="mf"><span>best run · ${best.e.id}</span><span><b class="${best.o.ret < 0 ? "neg" : "pos"}">${pct(best.o.ret)}</b> · hold ${pct(best.e.hold.ret)}</span></div></a>`;
}).join("");

// ---------- scoreboard: every organism in every experiment, colored by its margin over hold ----------
const cell = (v, h) => { const d = v - h, a = Math.min(1, Math.abs(d) / 0.15); return `background:${d >= 0 ? `rgba(126,226,168,${0.08 + a * 0.4})` : `rgba(255,138,115,${0.08 + a * 0.4})`}`; };
$("board").innerHTML = `<table class="sb"><tr><th></th>${S.map((e) => `<th title="${e.title}">${e.id}${e.id === "EXP-002" ? "*" : ""}<small>${e.title}</small></th>`).join("")}</tr>
  <tr class="hold"><td><i style="background:#8b8f98"></i>Hold</td>${S.map((e) => `<td>${pct(e.hold.ret)}</td>`).join("")}</tr>
  ${ORG.map((k) => `<tr><td><i style="background:${BOOKS[k].color}"></i>${BOOKS[k].name}</td>${S.map((e) => { const o = e.orgs[k]; return o ? `<td style="${cell(o.ret, e.hold.ret)}"><a href="organism?k=${k}&exp=${e.id}">${pct(o.ret)}</a></td>` : "<td>—</td>"; }).join("")}</tr>`).join("")}
  <tr class="hold"><td><i style="background:#5d616a"></i>Random</td>${S.map((e) => `<td>${pct(e.random.ret)}</td>`).join("")}</tr></table>`;
const beat = S.reduce((a, e) => a + ORG.filter((k) => e.orgs[k] && e.orgs[k].ret > e.hold.ret).length, 0), runs = S.reduce((a, e) => a + Object.keys(e.orgs).length, 0);
$("boardNote").textContent = `${beat} of ${runs} runs beat hold on return. Green = ahead of hold, red = behind, stronger color = bigger gap. Return alone isn't enough to pass: Sharpe, drawdown and winning 3 of 4 folds count too (each organism's page shows all four). * EXP-002 covers only about five weeks of on-chain data.`;

// ---------- the math: one tab per organism ----------
const T = (s) => `<span class="tex">${s}</span>`;
const SRC = site.repo ? site.repo + "/blob/main/" : null;
const M = {
  physarum: { src: "server/solver.mjs", lines: [
    ["Pressure (Kirchhoff)", String.raw`\begin{gathered}D^{c}_{k}(p_k-1)+\sum_{j}\frac{D_{kj}}{L_{kj}}\,(p_k-p_j)+G_k\,p_k=0\\[2pt] G_k=g_0\max(0,f_k)\end{gathered}`, "Every hour the plate solves for the pressure at each asset so flow in equals flow out. The core is held at pressure 1; food is a drain."],
    ["Flux", String.raw`Q_{kj}=\frac{D_{kj}}{L_{kj}}\,(p_k-p_j)`, "Flow through a tube is its conductivity over its length times the pressure drop."],
    ["Tube adaptation", String.raw`\frac{dD}{dt}=\frac{|Q|^{\mu}}{1+|Q|^{\mu}}-\gamma D,\qquad \mu=1.8`, "Tero, Kobayashi & Nakagaki 2007: busy tubes thicken, idle ones decay. Below 0.02 a tube is pruned; a pseudopod may regrow it."],
    ["Portfolio", String.raw`w_k=\frac{G_k\,p_k}{\sum_j G_j\,p_j+\rho}`, "What each asset absorbs is its share; ρ is the rest sink, which becomes cash."]] },
  worm: { src: "server/league/vendor/worm-brain.mjs", lines: [
    ["Neuron (leaky integrate-and-fire)", String.raw`\tau_m\frac{dV_i}{dt}=-(V_i-V_{rest})+I^{syn}_i+g_{gap}\sum_j (V_j-V_i)`, "All 302 neurons of C. elegans, wired as in Cook et al. 2019. Rest −52 mV, spike at −45 mV, τm 20 ms, synaptic τ 5 ms, plus adaptation."],
    ["Smell to direction", String.raw`o=\frac{F-R}{F+R+4}`, "After a 400 ms sniff, F counts spikes in forward neurons (AIY, RIB, AVB, PVC), R in reverse neurons (AIB, AIZ, RIM, AVA, AVD, AVE)."],
    ["Learning", String.raw`L_k\leftarrow\mathrm{clip}\Big(L_k+0.35\tanh\frac{r_k}{1\%},-1,1\Big)`, "What a held asset actually returned strengthens or weakens the scent's synapses onto approach or avoid neurons. L fades with a half-life."],
    ["Trading", String.raw`\begin{gathered}o>\theta\ \text{twice}\Rightarrow w_k\mathrel{+}=5\%\ (\le 20\%)\\[2pt] o<-0.4\Rightarrow w_k=0\end{gathered}`, "The worm crawls from asset to asset; it buys where the brain says run, drops what it says to turn away from."]] },
  fry: { src: "server/league/vendor/fry-circuit.mjs", lines: [
    ["Cell membrane", String.raw`\tau_m\frac{dV_k}{dt}=V_{rest}+\mu_k-V_k+\sigma\sqrt{2\tau_m}\,\xi_k(t)`, "Eleven leaky integrate-and-fire cells, one per asset, in larval zebrafish units: rest −67 mV, threshold −40.6 mV, τm 20 ms. 6 s of model time every hour."],
    ["Market drive", String.raw`\begin{gathered}\mu_k=\mu_0+\mu_g\,\mathrm{clip}(g_k,-1.6,1.8),\qquad d_k=\tanh\frac{f_k}{s}\\[2pt] g_k=\begin{cases}d_k(1+0.8L_k)&d_k>0\\ d_k(1-0.4L_k)&d_k\le 0\end{cases}\end{gathered}`, "Food becomes input current; what the cell has learned about the asset (L) scales it."],
    ["Spikes and Hebbian synapses", String.raw`\begin{gathered}V_k\mathrel{+}=W_{jk}-w_{inh}\\[2pt] W_{jk}\leftarrow\mathrm{clip}\big((1-\delta)W_{jk}+\eta\,a_j a_k,\,0,\,w_{max}\big)\end{gathered}`, "A spike excites the others through learned synapses and inhibits all through a shared pool. Cells that fire together wire together; a = activity above 6 Hz, per 20 Hz."],
    ["Trading", String.raw`\begin{gathered}\nu_k\ge\nu_{buy}\ \text{two hours}\Rightarrow w_k\mathrel{+}=5\%\\[2pt] \nu_k\le 2\,\mathrm{Hz}\Rightarrow w_k=0\end{gathered}`, "Firing rate decides: a cell that keeps firing hard buys, a silent cell sells. At most two trades an hour."]] },
  ant: { src: "server/league/orgs.mjs", lines: [
    ["Pheromone", String.raw`\tau_k\leftarrow\mathrm{clip}\Big((1-\rho)\tau_k+\frac{n_k}{N}\cdot\frac{\max(0,r_k)}{1\%},\,0.05,\,5\Big)`, "Ant colony optimisation (Dorigo & Gambardella 1997) with MAX-MIN bounds (Stützle & Hoos 2000). Trails evaporate at rate ρ; ants that found profit lay more."],
    ["Attraction", String.raw`a_k=\tau_k\,\big(\max(0,f_k)+0.05\big)^{\beta},\qquad a_{cash}=\tau_{cash}\,0.3^{\beta}`, "Smell (food) times trail. β sets how much the colony trusts its nose over its memory."],
    ["Portfolio", String.raw`w_k=\frac{a_k}{\sum_j a_j+a_{cash}}`, "200 ants choose in proportion to attraction; the colony holds its expected choice."]] },
  bee: { src: "server/league/orgs.mjs", lines: [
    ["Site quality", String.raw`q_k=\mathrm{clip}\Big(\frac{f_k}{3},0,1\Big),\qquad d=\max\big(1,\mathrm{round}(10\,q_k)\big)`, "Honeybee nest-site selection (Seeley & Buhrman 1999; Passino & Seeley 2006): a scout that finds site k dances d rounds, one less every hour."],
    ["Recruitment", String.raw`P(\text{follow }k)=\frac{D_k}{\sum_j D_j}\quad\text{or explore with probability }\varepsilon`, "Idle scouts follow dances in proportion to how much is danced for each site."],
    ["Quorum", String.raw`w_k=\begin{cases}n_k/S & n_k\ge q\,S\\ 0&\text{otherwise}\end{cases},\qquad S=100`, "The swarm only commits capital to a site once enough scouts are there."]] },
  ecoli: { src: "server/league/orgs.mjs", lines: [
    ["Temporal comparison", String.raw`\Delta c=c-m,\qquad m\leftarrow\lambda m+(1-\lambda)\,c`, "Each of 200 cells compares the food where it is now with a short memory (Macnab & Koshland 1972)."],
    ["Run or tumble", String.raw`P(\text{tumble})=\begin{cases}0.02&\Delta c>0\\ p_{high}&\Delta c\le 0\end{cases}`, "Run-and-tumble (Berg & Brown 1972): improving, keep swimming; getting worse, tumble to a random site. Cash is a site too."],
    ["Portfolio", String.raw`w_k=\frac{n_k}{200}`, "The share of cells at each asset."]] },
};
const COMMON = [
  ["Food: momentum and mean reversion", String.raw`f_k(t)=\pm\frac{\ln\!\big(P_{k,t}/P_{k,t-L}\big)}{\sqrt{\sum_{u=t-L+1}^{t} r_{k,u}^2}},\qquad L\in\{14,35,70,140\}\ \text{hours}`, "Return over the lookback divided by its volatility. + for momentum (EXP-001, 005), − for mean reversion (EXP-004, 006).", "server/league/foods.mjs"],
  ["Food: on-chain flow and news", String.raw`\begin{gathered}f^{flow}_k=\frac{3\,(B_k-S_k)}{B_k+S_k+500\,L}\\[2pt] f^{news}_k=\mathrm{clip}\Big(\frac{\text{tone}_{y}-\bar x}{s_x},-3,3\Big)\end{gathered}`, "EXP-002: USDG bought minus sold in the asset's pool. EXP-003: yesterday's GDELT tone against its recent normal.", "server/league/foods.mjs"],
  ["Every trade pays", String.raw`\begin{gathered}R_t=\Big(1-c\sum_k|w_{k,t}-w_{k,t-1}|\Big)\Big(1+\sum_k w_{k,t}\,r_{k,t+1}\Big)-1\\[2pt] c=0.3\%\end{gathered}`, "Weights chosen at bar t earn bar t+1, after a 0.3% cost on everything traded. Averaged over 5 seeds.", "server/lab/core.mjs"],
  ["Scores", String.raw`\text{Sharpe}=\frac{\bar R}{\sigma_R}\sqrt{252\cdot 7},\qquad \text{MaxDD}=\max_t\Big(1-\frac{E_t}{\max_{s\le t}E_s}\Big)`, "Annualised over 7 hourly bars a day. Drawdown is the deepest fall from a peak of equity E.", "server/lab/core.mjs"],
  ["Overlays", String.raw`\begin{gathered}\text{EXP-005: } w_k=\frac{1}{11}\sum_j w^{org}_j\\[2pt] \text{EXP-006: } w_k=\frac{0.7}{11}+0.3\,w^{org}_k\end{gathered}`, "EXP-005 lets the organism set only how much is invested; EXP-006 keeps 70% in equal-weight hold.", "server/league/evaluate.mjs"],
];
const eqs = (rows, src) => rows.map(([h, tex, p, s]) => `<div class="eq"><div class="eqh">${h}${SRC ? ` <a href="${SRC + (s || src)}" target="_blank" rel="noopener">source</a>` : ""}</div>${T(tex)}<p>${p}</p></div>`).join("");
const mt = $("mathTabs");
mt.innerHTML = ORG.map((k, i) => `<button data-k="${k}" class="${i ? "" : "on"}" style="--c:${BOOKS[k].color}">${BOOKS[k].name}</button>`).join("");
const showMath = (k) => { $("mathBody").innerHTML = eqs(M[k].lines, M[k].src); mt.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === k)); render($("mathBody")); };
mt.onclick = (e) => e.target.dataset.k && showMath(e.target.dataset.k);
$("mathCommon").innerHTML = eqs(COMMON);
const render = (root) => window.katex && root.querySelectorAll(".tex").forEach((el) => { if (!el.dataset.tex) el.dataset.tex = el.textContent; window.katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false }); });
const katexReady = new Promise((res) => { const s = document.getElementById("katexjs"); if (window.katex) res(); else s.addEventListener("load", res); });
showMath(ORG[0]); katexReady.then(() => { render($("mathBody")); render($("mathCommon")); });

// ---------- live forward test ----------
const lv = await fetch("live/live.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null), () => null);
if (!lv || lv.waiting) $("liveBox").innerHTML = `<p class="dim">LIVE-001 was registered on ${lv ? lv.registeredAt.slice(0, 16).replace("T", " ") + " UTC" : "—"} and is waiting for its first closed market bars.</p>`;
else {
  const top = [...lv.books].sort((a, b) => b.ret - a.ret).slice(0, 3);
  $("liveBox").innerHTML = `<div class="lstats"><div><b>${lv.bars}</b><span>market hours so far</span></div><div><b class="${lv.hold.ret < 0 ? "neg" : "pos"}">${pct(lv.hold.ret)}</b><span>hold</span></div>${top.map((b) => `<div><b class="${b.ret < 0 ? "neg" : b.ret > 0 ? "pos" : ""}">${pct(b.ret)}</b><span>${BOOKS[b.org].name} · ${b.exp}</span></div>`).join("")}</div>
  <p class="dim">Updated ${lv.updatedAt.slice(0, 16).replace("T", " ")} UTC. Settings frozen at registration, judged after at least three months.</p>`;
}

// ---------- proof ----------
const an = site.anchor;
$("anchorCard").innerHTML = an?.confirmed ? `<b>Bitcoin block ${an.block}</b><p>The pre-registration ledger as it stood on ${an.at} was timestamped with OpenTimestamps and confirmed in <a href="https://mempool.space/block/${an.block}" target="_blank" rel="noopener">block ${an.block}</a>.</p>` : `<b>Bitcoin timestamp</b><p>The ledger is timestamped with OpenTimestamps; the proof is on the data page.</p>`;
if (site.repo) $("repoCard").innerHTML = `<b>Open source</b><p>Engine, data and results on <a href="${site.repo}" target="_blank" rel="noopener">GitHub</a>. <code>node server/league/run.mjs EXP-006</code> rebuilds the same numbers.</p>`;
if (site.repo) $("fRepo").href = site.repo;

// sections fade in as they scroll into view
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.08 });
document.querySelectorAll(".sec").forEach((s) => io.observe(s));
