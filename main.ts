// Vice Frame — entry program for gta6-cover-art-01 (Node 22, stdlib only).
//
// The app itself is the static site in app/ (open app/index.html in a
// browser; it runs fully offline). This program hands the entry in: it
// copies app/ and screenshots/ into the output directory and writes
// dossier.json there with the vendored make.fun library, using the
// bounty's own caps so a local run refuses exactly what the scorer would.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
for (const name of ['app', 'screenshots']) {
  rmSync(join(out, name), { recursive: true, force: true });
  cpSync(join(here, name), join(out, name), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const bytes = typeof dossier === 'string' ? Buffer.byteLength(dossier) : dossier.length;
console.log(`vice-frame: copied app/ + screenshots/ to ${out}; dossier.json is ${bytes} bytes`);
