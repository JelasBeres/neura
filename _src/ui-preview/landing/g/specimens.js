// Specimen animations, each drawn from the organism's own mechanism. mount(canvas, kind) starts one.
export const ORGS = {
  physarum: { name: "Physarum", latin: "Physarum polycephalum", color: "#e8c21a", brain: "0 neurons", rule: "Tubes that carry flow thicken, idle tubes wither." },
  worm: { name: "Worm", latin: "Caenorhabditis elegans", color: "#7fb4ff", brain: "302 neurons", rule: "Food smell runs through the real wiring diagram to a turn or a run." },
  fry: { name: "Fry", latin: "Danio rerio, larva", color: "#5fd0b5", brain: "11 model cells", rule: "A cell that fires hard enough buys; a silent cell sells." },
  ant: { name: "Ant", latin: "Formicidae colony", color: "#e0784f", brain: "no leader", rule: "Paths to profit get more pheromone; unused trails evaporate." },
  ecoli: { name: "E. coli", latin: "Escherichia coli", color: "#ff7fb0", brain: "1 cell, no neurons", rule: "Remembers the last few seconds of food. Keeps swimming while it improves; tumbles to a random new heading when it gets worse." },
  bee: { name: "Bee", latin: "Apis mellifera swarm", color: "#b79cff", brain: "quorum", rule: "Scouts dance for sites; the swarm moves when a quorum agrees." },
};
const R = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
let worm = null;
const wormData = fetch(new URL("worm.json", import.meta.url)).then((r) => r.json()).then((d) => (worm = d));

export function mount(c, kind, opt = {}) {
  const x = c.getContext("2d"), col = ORGS[kind].color, rnd = R(opt.seed || 7);
  let W, H, dpr = Math.min(2, devicePixelRatio || 1), t = 0, st = null, alive = true;
  let CX, CY, M;
  const size = () => { W = c.clientWidth; H = c.clientHeight; CX = W * (opt.cx ?? 0.5); CY = H * (opt.cy ?? 0.5); M = Math.min(W, H) * (opt.s ?? 1); c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); st = null; };
  new ResizeObserver(size).observe(c); size();
  const init = {
    physarum() {
      // a small Tero network: core at the centre (pressure 1), oat flakes near the rim (pressure 0), a mesh of tubes between
      const R = M * 0.46, N = [{ x: CX, y: CY, core: 1 }];
      for (let r = 0.14; r < 0.97; r += 0.105) { const k = Math.round(6 + r * 26), o = rnd() * 6.283; for (let i = 0; i < k; i++) { const a = o + (i / k) * 6.283 + (rnd() - 0.5) * 0.25, rr = R * (r + (rnd() - 0.5) * 0.05); N.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr }); } }
      const E = [], seen = new Set();
      N.forEach((a, i) => N.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y)]).filter(([j]) => j !== i).sort((u, v) => u[1] - v[1]).slice(0, 4).forEach(([j, d]) => { const key = Math.min(i, j) + "," + Math.max(i, j); if (!seen.has(key)) { seen.add(key); E.push({ a: i, b: j, L: d / R, D: 0.6 + rnd() * 0.4, ph: 0 }); } }));
      E.forEach((e) => (e.ph = (Math.hypot(N[e.a].x - CX, N[e.a].y - CY) / R) * 4));
      if (opt.feed) {
        // data mode: one node per asset on the rim, in the direction of that asset on the page; each drains through its real food
        const F = opt.feed(), mesh = N.length, assets = F.angles.map((a, k) => { const i = N.push({ x: CX + Math.cos(a) * R * 1.02, y: CY + Math.sin(a) * R * 1.02, asset: k }) - 1;
          N.slice(0, mesh).map((b, j) => [j, Math.hypot(N[i].x - b.x, N[i].y - b.y)]).sort((u, v) => u[1] - v[1]).slice(0, 3).forEach(([j, d]) => E.push({ a: j, b: i, L: d / R, D: 0.6, ph: 4 })); return i; });
        return { R, N, E, food: [], assets, p: N.map((n) => (n.core ? 1 : 0)), clock: 0 };
      }
      const rim = N.map((n, i) => [i, Math.hypot(n.x - CX, n.y - CY)]).filter(([, d]) => d > R * 0.78).map(([i]) => i);
      const food = Array.from({ length: 5 }, (_, q) => rim[Math.floor(((q + rnd() * 0.6) / 5) * rim.length)]);
      return { R, N, E, food, p: N.map((n) => (n.core ? 1 : 0)), clock: 0 };
    },
    worm() { return { pulses: [] }; },
    fry() { return { cells: Array.from({ length: 11 }, (_, i) => ({ v: rnd(), rate: 0.2 + rnd() * 0.8, flash: 0, a: (i / 11) * 6.283 })) }; },
    ant() {
      const nest = { x: CX, y: CY }, food = Array.from({ length: 5 }, (_, i) => { const a = i * 1.257 + 0.4, r = M * 0.36; return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, q: 0.4 + rnd() }; });
      const g = 64, ph = new Float32Array(g * g);
      return { nest, food, g, ph, ants: Array.from({ length: 140 }, () => ({ x: nest.x, y: nest.y, a: rnd() * 6.283, home: false })) };
    },
    ecoli() {
      const food = [[0.32, 0.36, 1], [0.7, 0.62, 0.7], [0.62, 0.24, 0.45]].map(([u, v, q]) => ({ x: CX + (u - 0.5) * M, y: CY + (v - 0.5) * M, q }));
      return { food, cells: Array.from({ length: 110 }, () => ({ x: CX + (rnd() - 0.5) * M * 0.8, y: CY + (rnd() - 0.5) * M * 0.8, a: rnd() * 6.283, mem: 0, tum: 0 })) };
    },
    bee() {
      const sites = Array.from({ length: 4 }, (_, i) => { const a = i * 1.571 + 0.8, r = M * 0.33; return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, q: [0.9, 0.5, 0.35, 0.6][i], n: 0 }; });
      return { sites, bees: Array.from({ length: 120 }, () => ({ x: CX + (rnd() - 0.5) * 30, y: CY + (rnd() - 0.5) * 30, site: -1, vx: 0, vy: 0 })) };
    },
  };
  const draw = {
    physarum() {
      // Tero, Kobayashi & Nakagaki 2007: solve the pressures (Kirchhoff), then dD/dt = f(|Q|) - D. Busy tubes thicken, idle ones fade.
      const { R, N, E, food, p } = st, isFood = new Set(food), adj = st.adj || (st.adj = N.map(() => []));
      if (!adj[0].length) E.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });
      const F = opt.feed ? opt.feed() : null, ground = (i) => (F && N[i].asset != null ? 6 * Math.max(0, F.food[N[i].asset]) : 0);
      for (let it = 0; it < (F ? 40 : 24); it++) N.forEach((n, i) => { if (n.core || isFood.has(i)) { p[i] = n.core ? 1 : 0; return; } let num = 0, den = ground(i); for (const ei of adj[i]) { const e = E[ei], g = e.D / e.L, j = e.a === i ? e.b : e.a; num += g * p[j]; den += g; } p[i] = den ? num / den : 0; });
      let qmax = 1e-9; E.forEach((e) => { e.Q = (e.D / e.L) * (p[e.a] - p[e.b]); qmax = Math.max(qmax, Math.abs(e.Q)); });
      // data mode uses an absolute flux scale, so a tube to food that is gone really empties and withers
      E.forEach((e) => { const q = Math.abs(e.Q) / (F ? 0.35 : 0.3 * qmax), f = q ** 1.8 / (1 + q ** 1.8); e.D = Math.max(F ? 0.08 : 0.015, e.D + 0.04 * (f - e.D)); });   // data mode keeps a thin living sheet everywhere, so new food can be reached
      // food gets eaten: every ~12 s one flake moves to a new spot and the network reorganises toward it
      if (!F && ++st.clock % 720 === 0) { const rim = N.map((n, i) => i).filter((i) => Math.hypot(N[i].x - CX, N[i].y - CY) > R * 0.78 && !isFood.has(i)); food[Math.floor(rnd() * food.length)] = rim[Math.floor(rnd() * rim.length)]; }
      const g = x.createRadialGradient(CX, CY, 0, CX, CY, R * 1.05); g.addColorStop(0, "rgba(232,194,26,.10)"); g.addColorStop(1, "rgba(232,194,26,0)"); x.fillStyle = g; x.beginPath(); x.arc(CX, CY, R * 1.05, 0, 7); x.fill();
      x.lineCap = "round";
      E.forEach((e) => { const a = N[e.a], b = N[e.b], k = Math.min(1, e.D); x.strokeStyle = `rgba(232,194,26,${0.06 + k * 0.85})`; x.lineWidth = 0.4 + k * k * M * 0.012; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
      // shuttle streaming: cytoplasm flows back and forth inside the thick tubes in a travelling wave
      x.fillStyle = "#fff4c2";
      E.forEach((e) => {
        if (e.D < 0.45) return; const a = N[e.a], b = N[e.b], q = Math.abs(e.Q) / qmax;
        if (F && q < 0.05) return;
        // data mode: net transport along the flow plus the back-and-forth of shuttle streaming; otherwise the oscillation alone
        let u = F ? ((e.Q > 0 ? 1 : -1) * t * 0.01 * q + 0.08 * Math.sin(t * 0.045 - e.ph) + e.ph) % 1 : 0.5 + 0.42 * Math.sin(t * 0.045 - e.ph); if (u < 0) u += 1;
        x.beginPath(); x.arc(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0.8 + e.D * 1.2, 0, 7); x.fill();
      });
      if (F) st.assets.forEach((i, k) => {
        const n = N[i], fv = Math.max(0, F.food[k]), dc = F.inner[k] / F.innerMax, r = M * (0.012 + Math.min(1, fv / 3) * 0.022);
        x.strokeStyle = dc > 0.02 ? col : "#3a3f4a"; x.lineWidth = 0.8 + dc * 3; x.beginPath(); x.arc(n.x, n.y, M * 0.036, 0, 7); x.stroke();
        if (fv > 0) { x.save(); x.translate(n.x, n.y); x.rotate(k); x.fillStyle = "#e9dfc0"; x.beginPath(); x.ellipse(0, 0, r, r * 0.6, 0, 0, 7); x.fill(); x.restore(); }
        const ax = n.x + ((n.x - CX) / R) * M * 0.07, ay = n.y + ((n.y - CY) / R) * M * 0.07;
        x.fillStyle = fv > 0 ? "#e7e9ee" : "#5d6370"; x.font = `${Math.max(8, M * 0.026)}px JetBrains Mono`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(F.syms[k], ax, ay);
      });
      food.forEach((i) => { const n = N[i]; x.save(); x.translate(n.x, n.y); x.rotate(i); x.fillStyle = "#e9dfc0"; x.beginPath(); x.ellipse(0, 0, M * 0.022, M * 0.013, 0, 0, 7); x.fill(); x.restore(); });
      x.fillStyle = col; x.beginPath(); x.arc(CX, CY, M * 0.03, 0, 7); x.fill();
    },
    worm() {
      if (!worm) return;
      const m = M, L = m * 0.92, ang = -0.5, cx = CX, cy = CY;
      const P = worm.p.map(([u, v]) => { const px = (u - 0.5) * L, py = (v - 0.5) * m * 0.3; return [cx + px * Math.cos(ang) - py * Math.sin(ang), cy + px * Math.sin(ang) + py * Math.cos(ang)]; });
      x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath();
      for (let k = 0; k <= 40; k++) { const u = k / 40, px = (u - 0.5) * L * 1.04, w = m * 0.045 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + m * 0.006; k ? x.lineTo(px, -w) : x.moveTo(px, -w); }
      for (let k = 40; k >= 0; k--) { const u = k / 40, px = (u - 0.5) * L * 1.04, w = m * 0.045 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + m * 0.006; x.lineTo(px, w); }
      x.closePath(); x.fillStyle = "rgba(127,180,255,.06)"; x.fill(); x.strokeStyle = "rgba(127,180,255,.25)"; x.lineWidth = 1; x.stroke(); x.restore();
      x.strokeStyle = "rgba(127,180,255,.10)"; x.lineWidth = 0.6; x.beginPath();
      worm.e.forEach(([a, b]) => { x.moveTo(...P[a]); x.lineTo(...P[b]); }); x.stroke();
      if (st.pulses.length < 26 && rnd() < 0.3) st.pulses.push({ e: worm.e[(rnd() * worm.e.length) | 0], k: 0 });
      st.pulses = st.pulses.filter((p) => {
        p.k += 0.025; const [a, b] = p.e, q = Math.min(1, p.k);
        const px = P[a][0] + (P[b][0] - P[a][0]) * q, py = P[a][1] + (P[b][1] - P[a][1]) * q;
        x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.moveTo(...P[a]); x.lineTo(px, py); x.stroke();
        if (p.k >= 1 && rnd() < 0.55) { const nx = worm.e.filter((e) => e[0] === b); if (nx.length) st.pulses.push({ e: nx[(rnd() * nx.length) | 0], k: 0 }); }
        return p.k < 1;
      });
      x.fillStyle = "rgba(236,240,250,.75)"; P.forEach((p) => x.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6));
    },
    fry() {
      const m = M, cx = CX, cy = CY, r = m * 0.32;
      x.strokeStyle = "rgba(95,208,181,.14)"; x.lineWidth = 0.8;
      st.cells.forEach((a, i) => st.cells.forEach((b, j) => { if (j > i && (i + j) % 3 === 0) { x.beginPath(); x.moveTo(cx + Math.cos(a.a) * r, cy + Math.sin(a.a) * r); x.lineTo(cx + Math.cos(b.a) * r, cy + Math.sin(b.a) * r); x.stroke(); } }));
      st.cells.forEach((cl) => {
        cl.v += cl.rate * 0.02 + (rnd() - 0.5) * 0.01; if (cl.v > 1) { cl.v = 0; cl.flash = 1; } cl.flash *= 0.9;
        const px = cx + Math.cos(cl.a) * r, py = cy + Math.sin(cl.a) * r;
        x.fillStyle = `rgba(95,208,181,${0.15 + cl.flash * 0.6})`; x.beginPath(); x.arc(px, py, m * 0.035 + cl.flash * m * 0.03, 0, 7); x.fill();
        x.fillStyle = col; x.beginPath(); x.arc(px, py, m * 0.012 + cl.v * m * 0.012, 0, 7); x.fill();
      });
    },
    ant() {
      const { g, ph, nest, food } = st, cw = W / g, ch = H / g;
      for (let i = 0; i < ph.length; i++) { ph[i] *= 0.992; if (ph[i] > 0.04) { x.fillStyle = `rgba(224,120,79,${Math.min(0.55, ph[i] * 0.4)})`; x.fillRect((i % g) * cw, ((i / g) | 0) * ch, cw + 0.5, ch + 0.5); } }
      const at = (px, py) => ph[Math.max(0, Math.min(g - 1, (py / ch) | 0)) * g + Math.max(0, Math.min(g - 1, (px / cw) | 0))] || 0;
      st.ants.forEach((a) => {
        if (a.home) a.a = Math.atan2(nest.y - a.y, nest.x - a.x) + (rnd() - 0.5) * 0.6;
        else { const l = at(a.x + Math.cos(a.a - 0.5) * 8, a.y + Math.sin(a.a - 0.5) * 8), rr = at(a.x + Math.cos(a.a + 0.5) * 8, a.y + Math.sin(a.a + 0.5) * 8); a.a += (rr - l) * 1.5 + (rnd() - 0.5) * 0.5; }
        a.x += Math.cos(a.a) * 1.3; a.y += Math.sin(a.a) * 1.3;
        if (a.x < 0 || a.x > W || a.y < 0 || a.y > H) a.a += 3.14;
        if (a.home) { const i = Math.max(0, Math.min(g - 1, (a.y / ch) | 0)) * g + Math.max(0, Math.min(g - 1, (a.x / cw) | 0)); ph[i] = Math.min(3, ph[i] + 0.35 * a.q); if (Math.hypot(a.x - nest.x, a.y - nest.y) < 8) { a.home = false; a.a = rnd() * 6.283; } }
        else food.forEach((f) => { if (Math.hypot(a.x - f.x, a.y - f.y) < 10) { a.home = true; a.q = f.q; } });
        x.fillStyle = "#f3eee4"; x.fillRect(a.x - 0.9, a.y - 0.9, 1.8, 1.8);
      });
      food.forEach((f) => { x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.arc(f.x, f.y, 4 + f.q * 4, 0, 7); x.stroke(); });
      x.fillStyle = col; x.beginPath(); x.arc(nest.x, nest.y, 5, 0, 7); x.fill();
    },
    ecoli() {
      // run and tumble (Berg & Brown 1972): compare food now with a short memory; improving -> keep running, worse -> tumble more often
      const { food, cells } = st, sg = M * 0.16, conc = (px, py) => food.reduce((a, f) => a + f.q * Math.exp(-((px - f.x) ** 2 + (py - f.y) ** 2) / (2 * sg * sg)), 0);
      food.forEach((f) => { const g = x.createRadialGradient(f.x, f.y, 0, f.x, f.y, sg * 2); g.addColorStop(0, `rgba(255,127,176,${0.18 * f.q})`); g.addColorStop(1, "rgba(255,127,176,0)"); x.fillStyle = g; x.fillRect(f.x - sg * 2, f.y - sg * 2, sg * 4, sg * 4); });
      cells.forEach((b) => {
        const c = conc(b.x, b.y), dc = c - b.mem; b.mem = b.mem * 0.85 + c * 0.15;
        if (rnd() < (dc > 0 ? 0.012 : 0.07)) { b.a = rnd() * 6.283; b.tum = 6; }
        if (b.tum > 0) b.tum--; else { b.x += Math.cos(b.a) * 1.1; b.y += Math.sin(b.a) * 1.1; }
        if (Math.hypot(b.x - CX, b.y - CY) > M * 0.48) { b.a = Math.atan2(CY - b.y, CX - b.x); }
        x.strokeStyle = b.tum > 0 ? "#fff" : col; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); x.moveTo(b.x - Math.cos(b.a) * 3, b.y - Math.sin(b.a) * 3); x.lineTo(b.x + Math.cos(b.a) * 3, b.y + Math.sin(b.a) * 3); x.stroke();
      });
    },
    bee() {
      const { sites, bees } = st, cx = CX, cy = CY;
      sites.forEach((s) => (s.n = bees.filter((b) => b.site === sites.indexOf(s)).length));
      bees.forEach((b) => {
        if (b.site < 0 && rnd() < 0.004) b.site = rnd() < 0.5 ? (rnd() * sites.length) | 0 : sites.reduce((m, s, i) => (s.n * s.q > sites[m].n * sites[m].q ? i : m), 0);
        else if (b.site >= 0 && rnd() < 0.004 * (1.2 - sites[b.site].q)) b.site = -1;
        const tx = b.site < 0 ? cx : sites[b.site].x, ty = b.site < 0 ? cy : sites[b.site].y;
        b.vx = b.vx * 0.92 + (tx - b.x) * 0.002 + (rnd() - 0.5) * 0.6; b.vy = b.vy * 0.92 + (ty - b.y) * 0.002 + (rnd() - 0.5) * 0.6;
        b.x += b.vx; b.y += b.vy; x.fillStyle = b.site < 0 ? "rgba(243,238,228,.7)" : col; x.fillRect(b.x - 1, b.y - 1, 2, 2);
      });
      sites.forEach((s) => { x.strokeStyle = `rgba(183,156,255,${0.3 + Math.min(0.7, s.n / 50)})`; x.lineWidth = 1 + s.n / 15; x.beginPath(); x.arc(s.x, s.y, 10 + s.q * 8, 0, 7); x.stroke(); });
    },
  };
  // data mode (opt.feed): the dish replays the organism's recorded state for the frame on screen, one site per asset placed in
  // that asset's direction. feed() -> { food[], inner[], innerMax, angles[] }. Nothing here is invented: counts, rates and trail
  // strengths are the backtest's own numbers; only the wandering of individual dots between recorded states is visual.
  const site = (k, r) => ({ x: CX + Math.cos(opt.feed().angles[k]) * r, y: CY + Math.sin(opt.feed().angles[k]) * r });
  const fed = {
    fry: {
      // 11 LIF cells, one per asset; each flashes at its recorded firing rate (Hz, slowed 4x to be visible)
      init: () => ({ cells: opt.feed().angles.map(() => ({ flash: 0 })) }),
      draw() {
        const F = opt.feed(), r = M * 0.34, P = F.angles.map((_, k) => site(k, r));
        x.strokeStyle = "rgba(95,208,181,.10)"; x.lineWidth = 0.7; x.beginPath(); P.forEach((a, i) => P.forEach((b, j) => { if (j > i) { x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); } })); x.stroke();
        st.cells.forEach((cl, k) => {
          const hz = Math.max(0, F.inner[k]); if (rnd() < hz / 60 / 4) cl.flash = 1; cl.flash *= 0.86;
          const { x: px, y: py } = P[k], on = Math.min(1, hz / 20);
          x.fillStyle = `rgba(95,208,181,${0.08 + cl.flash * 0.7})`; x.beginPath(); x.arc(px, py, M * (0.03 + cl.flash * 0.035), 0, 7); x.fill();
          x.fillStyle = hz > 0.5 ? col : "#3a3f4a"; x.beginPath(); x.arc(px, py, M * (0.01 + on * 0.016), 0, 7); x.fill();
        });
      },
    },
    worm: {
      // the 302-neuron body; each asset patch shows the worm's learned value L (filled = good memory, hollow = bad);
      // signal pulses run through the real wiring at a rate set by the strongest smell on the plate right now
      init: () => ({ pulses: [] }),
      draw() {
        const F = opt.feed(); if (!worm) return; const r = M * 0.43;
        F.angles.forEach((_, k) => { const L = F.inner[k] / Math.max(1e-9, F.innerMax), fv = Math.max(0, F.food[k]), { x: px, y: py } = site(k, r);
          if (fv > 0) { const g = x.createRadialGradient(px, py, 0, px, py, M * 0.08); g.addColorStop(0, `rgba(127,180,255,${Math.min(0.35, fv / 8)})`); g.addColorStop(1, "rgba(127,180,255,0)"); x.fillStyle = g; x.fillRect(px - M * 0.08, py - M * 0.08, M * 0.16, M * 0.16); }
          x.lineWidth = 1.4; x.strokeStyle = L > 0.02 ? col : L < -0.02 ? "#6b7280" : "#2c313b"; x.fillStyle = L > 0.02 ? `rgba(127,180,255,${0.2 + L * 0.7})` : "transparent";
          x.setLineDash(L < -0.02 ? [2, 3] : []); x.beginPath(); x.arc(px, py, M * (0.018 + Math.abs(L) * 0.02), 0, 7); x.fill(); x.stroke(); x.setLineDash([]); });
        const smell = Math.max(0, ...F.food), m = M * 0.62, L = m * 0.92, ang = -0.5;
        const P = worm.p.map(([u, v]) => { const px = (u - 0.5) * L, py = (v - 0.5) * m * 0.3; return [CX + px * Math.cos(ang) - py * Math.sin(ang), CY + px * Math.sin(ang) + py * Math.cos(ang)]; });
        x.strokeStyle = "rgba(127,180,255,.10)"; x.lineWidth = 0.6; x.beginPath(); worm.e.forEach(([a, b]) => { x.moveTo(...P[a]); x.lineTo(...P[b]); }); x.stroke();
        if (st.pulses.length < 4 + smell * 8 && rnd() < Math.min(0.6, smell / 4)) st.pulses.push({ e: worm.e[(rnd() * worm.e.length) | 0], k: 0 });
        st.pulses = st.pulses.filter((p) => { p.k += 0.03; const [a, b] = p.e, q = Math.min(1, p.k); x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.moveTo(...P[a]); x.lineTo(P[a][0] + (P[b][0] - P[a][0]) * q, P[a][1] + (P[b][1] - P[a][1]) * q); x.stroke();
          if (p.k >= 1 && rnd() < 0.5) { const nx = worm.e.filter((e) => e[0] === b); if (nx.length) st.pulses.push({ e: nx[(rnd() * nx.length) | 0], k: 0 }); } return p.k < 1; });
        x.fillStyle = "rgba(236,240,250,.7)"; P.forEach((p) => x.fillRect(p[0] - 0.7, p[1] - 0.7, 1.4, 1.4));
      },
    },
    ant: {
      // nest in the middle, one food source per asset; trail width = recorded pheromone; ants leaving the nest pick a trail
      // the way the model does: pheromone x smell
      init: () => ({ ants: Array.from({ length: 160 }, () => ({ k: -1, u: rnd(), out: rnd() < 0.5, j: (rnd() - 0.5) * 2, first: true })) }),
      draw() {
        const F = opt.feed(), r = M * 0.42, P = F.angles.map((_, k) => site(k, r)), tau = F.inner.map((v) => v / Math.max(1e-9, F.innerMax));
        const att = tau.map((v, k) => v * (Math.max(0, F.food[k]) + 0.05)), S = att.reduce((a, b) => a + b, 0) || 1;
        x.lineCap = "round"; P.forEach((p, k) => { x.strokeStyle = `rgba(224,120,79,${0.08 + tau[k] * 0.6})`; x.lineWidth = 0.5 + tau[k] * M * 0.03; x.beginPath(); x.moveTo(CX, CY); x.lineTo(p.x, p.y); x.stroke();
          const fv = Math.max(0, F.food[k]); x.strokeStyle = fv > 0 ? col : "#3a3f4a"; x.lineWidth = 1.2; x.beginPath(); x.arc(p.x, p.y, M * (0.014 + Math.min(1, fv / 3) * 0.02), 0, 7); x.stroke(); });
        x.fillStyle = "#f3eee4";
        st.ants.forEach((a) => {
          if (a.k < 0) { let u = rnd() * S; a.k = 0; while (a.k < att.length - 1 && (u -= att[a.k]) > 0) a.k++; if (!a.first) { a.u = 0; a.out = true; } a.first = false; }
          a.u += (a.out ? 1 : -1) * 0.006; if (a.u >= 1) a.out = false; if (a.u <= 0 && !a.out) a.k = -1;
          const p = P[Math.max(0, a.k)], nx = -(p.y - CY) / r, ny = (p.x - CX) / r, wob = Math.sin(a.u * 20 + a.j * 5) * M * 0.008 * a.j;
          x.fillRect(CX + (p.x - CX) * a.u + nx * wob - 0.9, CY + (p.y - CY) * a.u + ny * wob - 0.9, 1.8, 1.8);
        });
        x.fillStyle = col; x.beginPath(); x.arc(CX, CY, M * 0.025, 0, 7); x.fill();
      },
    },
    bee: {
      // 100 scouts: exactly the recorded number sits at each asset's site, the rest stay with the swarm in the middle
      init: () => ({ bees: Array.from({ length: 100 }, () => ({ x: CX, y: CY, vx: 0, vy: 0, s: -1 })) }),
      draw() {
        const F = opt.feed(), r = M * 0.4, P = F.angles.map((_, k) => site(k, r)), want = F.inner.map((c) => Math.round(c)), have = want.map(() => 0);
        st.bees.forEach((b) => { if (b.s >= 0 && have[b.s] < want[b.s]) have[b.s]++; else b.s = -1; });
        st.bees.forEach((b) => { if (b.s < 0) { const k = want.findIndex((w, i) => have[i] < w); if (k >= 0) { b.s = k; have[k]++; } } });
        P.forEach((p, k) => { const c = want[k]; x.strokeStyle = c ? col : "#2c313b"; x.lineWidth = 1 + c / 8; x.globalAlpha = c ? 0.4 + Math.min(0.6, c / 40) : 1; x.beginPath(); x.arc(p.x, p.y, M * 0.05, 0, 7); x.stroke(); x.globalAlpha = 1; });
        st.bees.forEach((b) => { const tx = b.s < 0 ? CX : P[b.s].x, ty = b.s < 0 ? CY : P[b.s].y;
          b.vx = b.vx * 0.9 + (tx - b.x) * 0.004 + (rnd() - 0.5) * 0.7; b.vy = b.vy * 0.9 + (ty - b.y) * 0.004 + (rnd() - 0.5) * 0.7; b.x += b.vx; b.y += b.vy;
          x.fillStyle = b.s < 0 ? "rgba(243,238,228,.6)" : col; x.fillRect(b.x - 1.1, b.y - 1.1, 2.2, 2.2); });
      },
    },
    ecoli: {
      // 200 cells: the recorded number swims at each asset's site (cash is the middle); each runs and tumbles around its place
      init: () => ({ cells: Array.from({ length: 200 }, () => ({ x: CX + (rnd() - 0.5) * 20, y: CY + (rnd() - 0.5) * 20, a: rnd() * 6.283, tum: 0, s: -1 })) }),
      draw() {
        const F = opt.feed(), r = M * 0.38, P = F.angles.map((_, k) => site(k, r)), want = F.inner.map((c) => Math.round(c)), have = want.map(() => 0);
        st.cells.forEach((b) => { if (b.s >= 0 && have[b.s] < want[b.s]) have[b.s]++; else b.s = -1; });
        st.cells.forEach((b) => { if (b.s < 0) { const k = want.findIndex((w, i) => have[i] < w); if (k >= 0) { b.s = k; have[k]++; } } });
        P.forEach((p, k) => { const fv = Math.max(0, F.food[k]); if (!fv) return; const sg = M * 0.09, g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, sg); g.addColorStop(0, `rgba(255,127,176,${Math.min(0.3, fv / 8)})`); g.addColorStop(1, "rgba(255,127,176,0)"); x.fillStyle = g; x.fillRect(p.x - sg, p.y - sg, sg * 2, sg * 2); });
        st.cells.forEach((b) => {
          const tx = b.s < 0 ? CX : P[b.s].x, ty = b.s < 0 ? CY : P[b.s].y, d = Math.hypot(tx - b.x, ty - b.y);
          if (rnd() < (d > M * 0.05 ? 0.06 : 0.1)) { b.a = d > M * 0.05 && rnd() < 0.9 ? Math.atan2(ty - b.y, tx - b.x) + (rnd() - 0.5) * 0.6 : rnd() * 6.283; b.tum = 4; }
          if (b.tum > 0) b.tum--; else { const v = d > M * 0.05 ? 2.6 : 0.8; b.x += Math.cos(b.a) * v; b.y += Math.sin(b.a) * v; }
          x.strokeStyle = b.tum > 0 ? "#fff" : b.s < 0 ? "#6b7280" : col; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); x.moveTo(b.x - Math.cos(b.a) * 2.5, b.y - Math.sin(b.a) * 2.5); x.lineTo(b.x + Math.cos(b.a) * 2.5, b.y + Math.sin(b.a) * 2.5); x.stroke();
        });
      },
    },
  };
  const I = opt.feed && fed[kind] ? fed[kind].init : init[kind], Dr = opt.feed && fed[kind] ? fed[kind].draw : draw[kind];
  (async function loop() {
    if (kind === "worm") await wormData;
    const tick = () => { if (!alive) return; if (M < 20) return requestAnimationFrame(tick); t++; if (!st) st = I(); x.clearRect(0, 0, W, H); Dr(); requestAnimationFrame(tick); };
    tick();
  })();
  return () => (alive = false);
}
