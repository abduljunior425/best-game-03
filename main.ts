// Emberhold — entry program for the make.fun best-game-01 bounty.
// Node 22, standard library only; nothing is installed before it runs.
//
// The game itself is the static game/ folder next to this file: index.html
// plus plain ES modules, no libraries, no network requests, no build step.
// This program's only job is to hand that folder in: copy game/ and
// screenshots/ into the output directory and write dossier.json there with
// the kit's buildDossier helper (vendor/makefun-game.ts).
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Local play:   node serve.ts, then open http://localhost:8080
// In the grader MAKEFUN_OUTPUT_DIR is unset and /output is used instead.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives, and where the entry goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const source = join(repoRoot, name);
  if (!existsSync(source)) return;
  cpSync(source, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// Dossier limits mirror the scorer's own caps: the text budget is the only
// one that shapes bytes; the rest refuse an entry the scorer would refuse
// anyway — at most 4 screenshots of 256 KiB each, at most 993 files and
// 48 MiB under game/, no game path longer than 1000 bytes.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossierText);
