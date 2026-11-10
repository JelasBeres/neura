// node server/sources/verify.mjs: looks every paper in list.mjs up on Crossref (books on OpenLibrary), checks that
// author and year match, that the DOI resolves, adds a free PubMed Central link where one exists, and finds the code line
// that uses it. Writes data/sources.json; anything that doesn't check out is kept with ok:false, never guessed.
import fs from "node:fs";
import { SOURCES } from "./list.mjs";
const UA = { "User-Agent": "neura-sources/1.0 (https://neurarh.trade)" };
const get = async (u) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return r.json(); } catch {} await new Promise((s) => setTimeout(s, 1500)); } return null; };
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tc = (w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w);
const short = (fam) => (fam.length === 1 ? fam[0] : fam.length === 2 ? fam.join(" & ") : fam.length === 3 ? `${fam[0]}, ${fam[1]} & ${fam[2]}` : fam[0] + " et al.");
const out = [];
for (const s of SOURCES) {
  const e = { org: s.org, role: s.role, use: s.use, year: s.year };
  if (s.at) { const [file, needle] = s.at, i = fs.readFileSync(file, "utf8").split("\n").findIndex((l) => l.includes(needle)); e.code = { file, line: i + 1 }; if (i < 0) e.codeMissing = true; }
  if (s.book) {
    const r = await get(`https://openlibrary.org/search.json?title=${encodeURIComponent(s.q)}&author=${encodeURIComponent(s.au)}&limit=5`);
    const d = r?.docs?.find((d) => d.author_name?.some((a) => norm(a).includes(norm(s.au)))) ;
    Object.assign(e, d ? { ok: true, kind: "book", title: d.title, authors: d.author_name.slice(0, 3), venue: (d.publisher || [])[0], firstYear: d.first_publish_year,
      url: `https://openlibrary.org${d.key}`, fam: d.author_name.slice(0, 1).map((a) => tc(a.split(" ").pop())), isbn: (d.isbn || []).find((x) => x.length === 13) } : { ok: false, title: s.q, why: "not found on OpenLibrary" });
    if (d && d.first_publish_year !== s.year) e.note = `OpenLibrary lists first publication ${d.first_publish_year}`;
  } else {
    const r = await get(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(s.q)}&query.author=${encodeURIComponent(s.au)}&rows=20`);
    const yr = (m) => (m["published-print"] || m.issued || m.published)?.["date-parts"]?.[0]?.[0] ?? 0;
    const m = r?.message?.items?.find((m) => m.author?.some((a) => norm(a.family || "").includes(norm(s.au))) &&
      Math.abs(yr(m) - s.year) <= 1 && (!s.venue || norm((m["container-title"] || []).join(" ")).includes(s.venue)));
    if (!m) { out.push({ ...e, ok: false, title: s.q, why: "no Crossref record matching author and year" }); console.log("MISS", s.au, s.year); continue; }
    const y = yr(m);
    Object.assign(e, { ok: true, kind: "article", title: m.title[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), authors: m.author.map((a) => [a.given, a.family].filter(Boolean).join(" ")),
      venue: ((m["container-title"] || [])[0] || "").replace(/^eneuro$/i, "eNeuro"), year: y, fam: m.author.map((a) => tc(a.family || a.name || "")), volume: m.volume, page: m.page, doi: m.DOI.toLowerCase(), url: `https://doi.org/${m.DOI}` });
    if (s.title && s.title !== e.title) { e.note = `Crossref title reads "${e.title}"`; e.title = s.title; }   // markup lost in the Crossref record
    const h = await fetch(e.url, { method: "HEAD", redirect: "manual", headers: UA }).catch(() => null);
    e.doiResolves = !!h && h.status >= 300 && h.status < 400;
    const pm = await get(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${encodeURIComponent(e.doi)}&format=json&tool=neura&email=sources@neurarh.trade`);
    const rec = pm?.records?.[0];
    if (rec?.pmid) e.pubmed = `https://pubmed.ncbi.nlm.nih.gov/${rec.pmid}/`;
    if (rec?.pmcid) e.free = `https://pmc.ncbi.nlm.nih.gov/articles/${rec.pmcid}/`;
  }
  if (e.ok) e.cite = `${short(e.fam)} ${e.year}`; delete e.fam;
  e.checkedAt = new Date().toISOString().slice(0, 10);
  out.push(e); console.log(e.ok ? "ok  " : "MISS", s.org.padEnd(9), e.year, (e.authors || [s.au])[0], "·", (e.title || "").slice(0, 60), e.doi || e.isbn || "", e.free ? "· free" : "", e.code ? `· ${e.code.file.split("/").pop()}:${e.code.line}` : "");
}
fs.writeFileSync("data/sources.json", JSON.stringify(out, null, 1));
console.log(`${out.filter((e) => e.ok).length}/${out.length} verified · data/sources.json`);
