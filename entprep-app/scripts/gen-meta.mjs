#!/usr/bin/env node
/**
 * PERF-1 — generate per-subject `<sid>.meta.json` (counts) from the combined dumps.
 *
 * SubjectDetail reads this tiny file on mount instead of downloading the whole subject
 * pool (up to 6.6 MB). Counts are POST-QUARANTINE (filtered by the quarantine.json on
 * disk) so they equal what getPool→filterQuarantined yields at runtime.
 *
 * This is the offline path (no Supabase): it reads files already on disk. The deploy
 * chain regenerates meta via dump-questions.mjs (same helper). ⚠️ Because the deploy
 * chain runs `dump-questions.mjs` BEFORE `compute-quarantine.mjs`, the dump-time meta
 * uses the previous quarantine.json. To keep meta consistent with a freshly-recomputed
 * quarantine, run THIS script (or dump again) AFTER compute-quarantine — recommend the
 * owner append `&& node scripts/gen-meta.mjs` after compute-quarantine in the deploy chain.
 *
 * Usage:
 *   node scripts/gen-meta.mjs            # write meta files + size report
 *   node scripts/gen-meta.mjs --dry-run  # report only, write nothing
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { writeAllMeta, loadQuarantineBySid, computeMeta } from './utils/meta.mjs';
import { readFileSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const DRY_RUN = process.argv.includes('--dry-run');

const kb = (n) => (n / 1024).toFixed(2).padStart(7) + ' KB';

if (DRY_RUN) {
  // Compute + report without writing.
  const quar = loadQuarantineBySid(DATA_DIR);
  const files = readdirSync(DATA_DIR).filter(f =>
    f.endsWith('.json') && f !== 'manifest.json' && f !== 'quarantine.json'
    && !f.endsWith('.ru.json') && !f.endsWith('.kk.json') && !f.endsWith('.meta.json')).sort();
  let max = 0;
  console.log(`${'subject'.padEnd(22)} ${'meta'.padStart(10)}  total`);
  for (const f of files) {
    const sid = f.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    const meta = computeMeta(data, quar[sid] || new Set());
    const b = Buffer.byteLength(JSON.stringify(meta));
    if (b > max) max = b;
    console.log(`${sid.padEnd(22)} ${kb(b)} ${String(meta.total).padStart(6)}`);
  }
  console.log(`\nDRY RUN — nothing written. MAX meta = ${kb(max)}.`);
} else {
  const report = writeAllMeta(DATA_DIR);
  let max = 0;
  console.log(`${'subject'.padEnd(22)} ${'meta'.padStart(10)}  total`);
  for (const r of report) {
    if (r.bytes > max) max = r.bytes;
    console.log(`${r.sid.padEnd(22)} ${kb(r.bytes)} ${String(r.total).padStart(6)}`);
  }
  console.log(`\nWrote ${report.length} meta files. MAX meta = ${kb(max)} (opening a subject now fetches this, not the MB pool).`);
}
