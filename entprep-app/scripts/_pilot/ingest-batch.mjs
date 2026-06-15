// KK-aware batch inserter for ENTprep question bank.
// Reuses repo dedup (utils/quality.mjs). Writes bilingual columns the stock
// ingest --import path drops (q_kk/o_kk/e_kk), tags topic/subtopic, stamps a
// `source` marker for clean rollback, and balances the correct-answer position
// across BOTH languages together (so o_kk stays aligned with c).
//
// Usage:
//   node scripts/_pilot/ingest-batch.mjs --file=scripts/_pilot/batch.biology.pilot.json --subject=biology [--source=ai_gen_2026-06] [--dry-run]
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_KEY from entprep-app/.env.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';
import { tokenize, jaccard, JACCARD_THRESHOLD, checkQuestion } from '../utils/quality.mjs';

// ── Args ──
const args = process.argv.slice(2);
const opts = { file: null, subject: null, dryRun: false, purge: false, source: 'ai_gen_2026-06' };
for (const a of args) {
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--purge') opts.purge = true;
  else if (a.startsWith('--file=')) opts.file = a.split('=')[1];
  else if (a.startsWith('--subject=')) opts.subject = a.split('=')[1];
  else if (a.startsWith('--source=')) opts.source = a.split('=')[1];
}
if (!opts.subject || (!opts.purge && !opts.file)) {
  console.error('Usage: --file=<batch.json> --subject=<id> [--source=<marker>] [--dry-run]');
  console.error('   or: --purge --subject=<id> --source=<marker>   (delete rows by source marker)');
  process.exit(1);
}

// ── Load .env (entprep-app root) ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..', '..');
try {
  const env = readFileSync(join(appRoot, '.env'), 'utf8');
  env.split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch (e) { console.error('Could not read .env:', e.message); process.exit(1); }

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env'); process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ── Purge mode: delete rows by (subject, source) and exit (rollback helper) ──
if (opts.purge) {
  const { data, error } = await sb.from('questions').delete().eq('subject', opts.subject).eq('source', opts.source).select('id');
  if (error) { console.error('purge error:', error.message); process.exit(1); }
  console.log(`Purged ${data ? data.length : 0} rows where subject='${opts.subject}' AND source='${opts.source}'.`);
  process.exit(0);
}

// ── Read batch ──
const filePath = isAbsolute(opts.file) ? opts.file : join(appRoot, opts.file);
const data = JSON.parse(readFileSync(filePath, 'utf8'));
let qs = Array.isArray(data) ? data : (data.questions || []);
console.log(`Loaded ${qs.length} questions from ${opts.file}`);

// ── Structural validation + KK presence + critical quality gate ──
const valid = [];
let badStruct = 0, missingKK = 0, selfAns = 0;
for (const q of qs) {
  if (!q.q || q.q.trim().length <= 5) { badStruct++; continue; }
  if (!Array.isArray(q.o) || q.o.length !== 4 || q.o.some(o => !o || !String(o).trim())) { badStruct++; continue; }
  if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) { badStruct++; continue; }
  if (!q.e || q.e.trim().length <= 10) { badStruct++; continue; }
  if (new Set(q.o.map(o => o.trim().toLowerCase())).size < 4) { badStruct++; continue; }
  if (!q.q_kk || !Array.isArray(q.o_kk) || q.o_kk.length !== 4 || q.o_kk.some(o => !o || !String(o).trim()) || !q.e_kk) { missingKK++; continue; }
  // Drop only on self-answering (genuine defect); keep on heuristic warnings.
  const issues = checkQuestion({ q: q.q, o: q.o, c: q.c, e: q.e, type: 'single' }, { subject: opts.subject });
  if (issues.some(i => i.type === 'self-answer')) { selfAns++; console.log(`  drop (self-answer): ${q.q.slice(0, 60)}`); continue; }
  valid.push(q);
}
console.log(`Valid: ${valid.length}  (bad-structure ${badStruct}, missing-KK ${missingKK}, self-answer ${selfAns})`);

// ── Fetch existing live pool (paginated) for dedup ──
async function fetchExisting(subject) {
  const out = []; let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await sb.from('questions').select('q').eq('subject', subject).range(off, off + P - 1);
    if (error) throw new Error('fetch existing: ' + error.message);
    if (!data || !data.length) break;
    out.push(...data); if (data.length < P) break; off += P;
  }
  return out;
}
const existing = await fetchExisting(opts.subject);
const existingTokens = existing.map(r => tokenize(r.q));
console.log(`Existing live pool: ${existing.length}`);

// ── Dedup (vs live + intra-batch) at Jaccard threshold ──
const kept = []; const keptTokens = []; let dropDup = 0;
for (const q of valid) {
  const t = tokenize(q.q);
  let dup = existingTokens.some(et => jaccard(t, et) >= JACCARD_THRESHOLD);
  if (!dup) dup = keptTokens.some(kt => jaccard(t, kt) >= JACCARD_THRESHOLD);
  if (dup) { dropDup++; continue; }
  kept.push(q); keptTokens.push(t);
}
console.log(`After dedup: ${kept.length}  (removed ${dropDup} near-duplicates @ Jaccard ${JACCARD_THRESHOLD})`);

// ── Balance correct-answer position across o AND o_kk together ──
function cdist(arr) { const d = [0, 0, 0, 0]; for (const q of arr) d[q.c]++; return d; }
function shuffleQ(q) {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return { ...q, o: p.map(i => q.o[i]), o_kk: p.map(i => q.o_kk[i]), c: p.indexOf(q.c) };
}
function balance(arr) {
  if (!arr.length) return arr;
  for (let a = 0; a < 60; a++) {
    const cand = arr.map(shuffleQ);
    if (Math.max(...cdist(cand)) / cand.length * 100 <= 35) return cand;
  }
  return arr.map(shuffleQ);
}
const finalQs = balance(kept);
console.log(`Correct-index distribution after balance: [${cdist(finalQs).join(', ')}]`);

if (!finalQs.length) { console.log('Nothing to insert.'); process.exit(0); }

// ── Dry run ──
if (opts.dryRun) {
  console.log(`\n--- DRY RUN: would insert ${finalQs.length} rows (subject=${opts.subject}, source=${opts.source}) ---`);
  for (const q of finalQs.slice(0, 3)) {
    console.log(`  Q: ${q.q.slice(0, 80)}`);
    console.log(`     ${q.o.map((o, i) => `[${i === q.c ? '*' : ' '}] ${o}`).join(' | ').slice(0, 140)}`);
    console.log(`     KK: ${q.q_kk.slice(0, 60)} | topic=${q.topic||'-'}/${q.subtopic||'-'} diff=${q.difficulty||'-'}`);
  }
  console.log('--- END DRY RUN (no writes) ---');
  process.exit(0);
}

// ── Assign idx after current max, build rows, insert ──
const { data: mx, error: mxe } = await sb.from('questions').select('idx').eq('subject', opts.subject).not('idx', 'is', null).order('idx', { ascending: false }).limit(1);
if (mxe) throw new Error('maxIdx: ' + mxe.message);
let idx = (mx && mx.length ? mx[0].idx : -1) + 1;
const startIdx = idx;
const rows = finalQs.map(q => ({
  subject: opts.subject, idx: idx++,
  topic: q.topic || null, subtopic: q.subtopic || null,
  q: q.q, o: q.o, c: q.c, e: q.e,
  q_kk: q.q_kk, o_kk: q.o_kk, e_kk: q.e_kk,
  type: 'single', block: 'single',
  difficulty: q.difficulty || null,
  source: opts.source,
}));

const B = 100; let ins = 0;
for (let i = 0; i < rows.length; i += B) {
  const { error } = await sb.from('questions').insert(rows.slice(i, i + B));
  if (error) throw new Error('insert: ' + error.message);
  ins += Math.min(B, rows.length - i);
  console.log(`Inserted ${ins}/${rows.length}`);
}
console.log(`\nDone. Inserted ${ins} rows into '${opts.subject}' (idx ${startIdx}..${idx - 1}, source='${opts.source}').`);
console.log(`Rollback if needed: DELETE FROM questions WHERE subject='${opts.subject}' AND source='${opts.source}';`);
