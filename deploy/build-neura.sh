#!/bin/sh
# deploy/build-neura.sh: bundle the NEURA site into deploy/dist (static, no server code runs on the host):
#   map (home), organism pages, data.html, packed league results (data/), the league engine exactly as the server runs it (engine/),
#   the raw inputs it reads (raw/), and raw/manifest.json with the SHA-256 of every engine and raw file.
set -e; cd "$(dirname "$0")/.."; S=_src/ui-preview; O=deploy/dist
rm -rf $O; mkdir -p $O/lib $O/data $O/engine/lab $O/engine/lib $O/engine/league/vendor $O/raw/league $O/raw/lab
cp $S/map/index.html $S/map/organism.html $S/map/data.html $S/map/live.html $S/map/common.js $S/map/home.js $S/map/verify-worker.js $O/
mkdir -p $O/brand; cp $S/map/brand/* $O/brand/
cp $S/landing/g/specimens.js $S/landing/g/worm.json $O/lib/
node server/league/summary.mjs >/dev/null; cp $S/map/data/league-*.json $O/data/; cp data/sources.json $O/data/   # papers behind each organism (server/sources/verify.mjs)
cp deploy/site.json $O/site.json   # repo link, on-chain anchor, live test: filled in as each exists
cp deploy/og.png $O/og.png   # link preview image (1200x630), made by rendering the live map
# the engine: byte-for-byte the files server/league/run.mjs used (verify.mjs recomputes published results with them)
cp server/solver.mjs $O/engine/; cp server/lib/load.mjs $O/engine/lib/; cp server/lab/core.mjs $O/engine/lab/
cp server/league/orgs.mjs server/league/foods.mjs server/league/evaluate.mjs server/league/verify.mjs $O/engine/league/
cp server/league/vendor/fry-circuit.mjs $O/engine/league/vendor/
# the raw inputs, and the pre-registration ledger
cp data/hist-1h.json data/flow-1h.json data/news-1d.json data/assets.json $O/raw/; cp data/league/worm-table.json $O/raw/league/; cp data/lab/results/EXP-001.json $O/raw/lab/EXP-001-result.json; cp data/lab/ledger.json deploy/ledger-anchored.json deploy/ledger-anchored.json.ots $O/raw/lab/   # the ledger as timestamped in Bitcoin, with its OpenTimestamps proof
node deploy/manifest.mjs $O
# the map lives at the site root, the organism drawings under lib/; the working name PETRI becomes NEURA
sed -i '' -e 's#\.\./landing/g/specimens\.js#./lib/specimens.js#g' -e 's/PETRI/NEURA/g' $O/index.html $O/organism.html $O/data.html $O/live.html $O/common.js
grep -q "landing/g" $O/*.html $O/*.js && { echo "unresolved landing/g import"; exit 1; }
du -sh $O
