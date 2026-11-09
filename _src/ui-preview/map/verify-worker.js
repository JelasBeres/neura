// "Verify in your browser": runs the league engine (engine/ = the same files the server ran) on the raw data (raw/) inside this
// worker, then reports fold by fold. Nothing is sent anywhere; the page only downloads files.
self.NEURA_DATA = new URL("raw/", self.location).href;
self.onmessage = async ({ data: { exp, org } }) => {
  try {
    const L = await (await fetch(new URL(`data/league-${exp}.json`, self.location))).json();
    const { verify } = await import("./engine/league/verify.mjs");
    self.postMessage({ done: await verify(L, org, (progress) => self.postMessage({ progress })) });
  } catch (e) { self.postMessage({ error: String(e?.message || e) }); }
};
