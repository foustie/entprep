#!/usr/bin/env node
/**
 * PERF-2 — derive language-split files from the EXISTING combined dumps.
 *
 * Reads every public/data/<sid>.json (skipping manifest/quarantine and already-split
 * *.ru.json / *.kk.json) and writes <sid>.ru.json + <sid>.kk.json via the shared
 * scripts/utils/lang-split.mjs helper. The combined <sid>.json is LEFT IN PLACE — it
 * stays the canonical artifact for the guards/tooling (check-kk-index, audit-*).
 *
 * This is the offline path (no Supabase needed): it transforms data already on disk,
 * so it is deterministic and byte-verifiable against the combined source. The deploy
 * chain regenerates split files via dump-questions.mjs (same helper) after a re-dump.
 *
 * Usage:
 *   node scripts/split-lang.mjs            # write split files + print size report
 *   node scripts/split-lang.mjs --dry-run  # report only, write nothing
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { splitData } from './utils/lang-split.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const DRY_RUN = process.argv.includes('--dry-run');

const SKIP = new Set(['manifest.json', 'quarantine.json']);

function isCombinedSubjectFile(f) {
  if (!f.endsWith('.json')) return false;
  if (SKIP.has(f)) return false;
  if (f.endsWith('.ru.json') || f.endsWith('.kk.json')) return false; // already split
  return true;
}

const files = readdirSync(DATA_DIR).filter(isCombinedSubjectFile).sort();
const kb = (n) => (n / 1024).toFixed(1).padStart(8) + ' KB';

console.log(`Language-splitting ${files.length} combined files in public/data/...\n`);
console.log(`${'subject'.padEnd(24)} ${'combined'.padStart(11)} ${'ru'.padStart(11)} ${'kk'.padStart(11)}  ru/combined`);
console.log('-'.repeat(74));

let totC = 0, totRu = 0, totKk = 0;
for (const file of files) {
  const sid = file.replace(/\.json$/, '');
  const raw = readFileSync(join(DATA_DIR, file), 'utf8');
  const data = JSON.parse(raw);
  const { ru, kk } = splitData(data);
  const ruJson = JSON.stringify(ru);
  const kkJson = JSON.stringify(kk);

  const cB = Buffer.byteLength(raw);
  const rB = Buffer.byteLength(ruJson);
  const kB = Buffer.byteLength(kkJson);
  totC += cB; totRu += rB; totKk += kB;

  if (!DRY_RUN) {
    writeFileSync(join(DATA_DIR, `${sid}.ru.json`), ruJson);
    writeFileSync(join(DATA_DIR, `${sid}.kk.json`), kkJson);
  }
  const pct = ((rB / cB) * 100).toFixed(0) + '%';
  console.log(`${sid.padEnd(24)} ${kb(cB)} ${kb(rB)} ${kb(kB)} ${pct.padStart(8)}`);
}

console.log('-'.repeat(74));
console.log(`${'TOTAL'.padEnd(24)} ${kb(totC)} ${kb(totRu)} ${kb(totKk)} ${((totRu / totC) * 100).toFixed(0) + '%'}`.padEnd(20));
console.log(`\n${DRY_RUN ? 'DRY RUN — nothing written.' : 'Wrote ' + files.length * 2 + ' split files.'}`);
console.log(`RU session now transfers ~${((1 - totRu / totC) * 100).toFixed(0)}% fewer bytes per subject vs combined.`);
