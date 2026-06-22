#!/usr/bin/env node
/**
 * Fix I18N-1 — Kazakh answer-index mismatch.
 *
 * Bug: questions store a SINGLE shared correct-index `c` for both languages
 * (questionHelpers.ts uses `c` against whichever option array is shown, and
 * questionStore.clonePool swaps o -> o_kk for Kazakh users). For some rows the
 * Kazakh option array `o_kk` is an exact-text PERMUTATION of `o` (language-invariant
 * options: numbers, formulas like 1s²2s²2p⁶, oxidation states like −2/+6, English
 * words) but `c` was never updated. So `o_kk[c]` is a WRONG option and a Kazakh
 * student who picks the truly-correct answer is marked wrong.
 *
 * Fix (deterministic, no AI): for every single/multiple-choice row where o_kk is an
 * exact multiset permutation of o AND a correct index is misplaced, realign o_kk to
 * o's order. Detection logic lives in scripts/utils/kk-index.mjs (the single source
 * of truth shared with the predeploy guard check-kk-index.mjs and the vitest test).
 *
 * Modes:
 *   node scripts/fix-kk-answer-index.mjs --from-json   # scan public/data/*.json, REPORT only (no creds, no writes)
 *   node scripts/fix-kk-answer-index.mjs               # read Supabase, REPORT only (dry-run)
 *   node scripts/fix-kk-answer-index.mjs --apply       # read Supabase, WRITE realigned o_kk back (with backup)
 *
 * After --apply: re-run `node scripts/dump-questions.mjs` to regenerate public/data/*.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeFix, correctIndices, scanDataDir } from './utils/kk-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const APPLY = process.argv.includes('--apply');
const FROM_JSON = process.argv.includes('--from-json');

// Detection logic (computeFix, correctIndices, scanDataDir) lives in
// ./utils/kk-index.mjs — the single source of truth shared with the predeploy
// guard (check-kk-index.mjs) and the vitest test. Do not duplicate it here.

// ── Report ───────────────────────────────────────────────────────────────────

function reportRow(label, q, fixed) {
  const c0 = correctIndices(q.c)[0];
  console.log(`  [${label}] correct c=${JSON.stringify(q.c)}`);
  console.log(`     q:           ${String(q.q).slice(0, 90)}`);
  console.log(`     o[c]      = ${JSON.stringify(q.o[c0])}`);
  console.log(`     o_kk[c]   = ${JSON.stringify(q.o_kk[c0])}   <- shown to KK as "correct" (WRONG)`);
  console.log(`     o_kk now  = ${JSON.stringify(q.o_kk)}`);
  console.log(`     o_kk fix  = ${JSON.stringify(fixed)}`);
}

function summarize(perSubject, total, sampleCb) {
  console.log('\n━━━ I18N-1 mis-keyed Kazakh questions ━━━');
  const subjects = Object.keys(perSubject).sort((a, b) => perSubject[b] - perSubject[a]);
  for (const s of subjects) {
    if (perSubject[s]) console.log(`  ${s.padEnd(20)} ${perSubject[s]}`);
  }
  console.log(`  ${'TOTAL'.padEnd(20)} ${total}`);
  if (sampleCb) sampleCb();
}

// ── Mode: scan local JSON (read-only, no creds) ──────────────────────────────

function runFromJson() {
  const { perSubject, total, samples } = scanDataDir(DATA_DIR);
  summarize(perSubject, total, () => {
    console.log('\n━━━ Samples ━━━');
    for (const s of samples) reportRow(`${s.subject} idx ${s.idx}`, s.q, s.fixed);
    console.log('\n(read-only scan of public/data — no changes made; the source of truth is Supabase)');
  });
}

// ── Mode: Supabase (dry-run or --apply) ──────────────────────────────────────

async function runSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  // Match the existing scripts: read creds from .env
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  }
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env — use --from-json for a read-only local scan.');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  // Paginate the whole questions table.
  const PAGE = 1000;
  let from = 0;
  const fixes = []; // { id, subject, q, o, o_kk old, c, fixed }
  const perSubject = {};
  for (;;) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject, q, o, o_kk, c, correct_indices, type, pairs')
      .not('o_kk', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Supabase read error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data) {
      // For 'multiple' the DB `c` column is a dummy 0; the real answer key lives in
      // correct_indices. dump-questions.mjs substitutes it into `c`, and the deploy guard
      // (check-kk-index) scans that dumped shape — so normalize the same way here, else the
      // fixer and the guard would judge multiple-choice rows against different sources.
      const norm = row.type === 'multiple' && row.correct_indices != null
        ? { ...row, c: row.correct_indices }
        : row;
      const fixed = computeFix(norm);
      if (fixed) {
        fixes.push({ id: row.id, subject: row.subject, q: row.q, c: row.c, o: row.o, o_kk: row.o_kk, fixed });
        perSubject[row.subject] = (perSubject[row.subject] || 0) + 1;
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  summarize(perSubject, fixes.length, () => {
    console.log('\n━━━ Samples ━━━');
    for (const s of fixes.slice(0, 6)) reportRow(`${s.subject} id ${s.id}`, s, s.fixed);
  });

  if (!APPLY) {
    console.log('\nDRY RUN — no writes. Re-run with --apply to fix (a backup is written first).');
    return;
  }

  // Backup before writing.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, '..', `kk-index-fix-backup-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(fixes.map((f) => ({ id: f.id, o_kk: f.o_kk })), null, 2));
  console.log(`\nBackup of old o_kk written: ${backupPath}`);

  let ok = 0;
  for (const f of fixes) {
    const { error } = await supabase.from('questions').update({ o_kk: f.fixed }).eq('id', f.id);
    if (error) { console.error(`  FAIL id ${f.id}: ${error.message}`); continue; }
    ok++;
  }
  console.log(`\nUpdated ${ok}/${fixes.length} rows. Now re-run: node scripts/dump-questions.mjs`);
}

// ── Entry ────────────────────────────────────────────────────────────────────

if (FROM_JSON) {
  runFromJson();
} else {
  await runSupabase();
}
