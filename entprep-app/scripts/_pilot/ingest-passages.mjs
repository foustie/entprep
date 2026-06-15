// KK-aware reading-PASSAGE inserter for ENTprep. Reuses repo dedup (utils/quality.mjs).
// Writes passages (passage_group + passage_title/_kk + passage_text/_kk) with 5
// single-choice questions each, bilingual, balanced, with a source marker.
//
// Usage:
//   node scripts/_pilot/ingest-passages.mjs --file=scripts/_pilot/batch.reading.json --subject=reading [--source=ai_gen_2026-06] [--dry-run] [--purge]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';
import { tokenize, jaccard, JACCARD_THRESHOLD } from '../utils/quality.mjs';

const args = process.argv.slice(2);
const opts = { file: null, subject: 'reading', dryRun: false, purge: false, source: 'ai_gen_2026-06' };
for (const a of args) {
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--purge') opts.purge = true;
  else if (a.startsWith('--file=')) opts.file = a.split('=')[1];
  else if (a.startsWith('--subject=')) opts.subject = a.split('=')[1];
  else if (a.startsWith('--source=')) opts.source = a.split('=')[1];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..', '..');
try {
  const env = readFileSync(join(appRoot, '.env'), 'utf8');
  env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
} catch (e) { console.error('Could not read .env:', e.message); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

if (opts.purge) {
  const { data, error } = await sb.from('questions').delete().eq('subject', opts.subject).eq('source', opts.source).select('id');
  if (error) { console.error('purge error:', error.message); process.exit(1); }
  console.log(`Purged ${data ? data.length : 0} rows where subject='${opts.subject}' AND source='${opts.source}'.`);
  process.exit(0);
}
if (!opts.file) { console.error('Usage: --file=<batch.json> --subject=reading [--source=<marker>] [--dry-run] [--purge]'); process.exit(1); }

const filePath = isAbsolute(opts.file) ? opts.file : join(appRoot, opts.file);
const data = JSON.parse(readFileSync(filePath, 'utf8'));
let passages = Array.isArray(data) ? data : (data.passages || []);
console.log(`Loaded ${passages.length} passages`);

// Validate passages
const okQ = (q) => q && q.q && q.q.trim().length > 5 && Array.isArray(q.o) && q.o.length === 4 && !q.o.some(o => !o || !String(o).trim())
  && Number.isInteger(q.c) && q.c >= 0 && q.c <= 3 && q.e && q.e.trim().length > 10
  && new Set(q.o.map(o => o.trim().toLowerCase())).size === 4
  && q.q_kk && Array.isArray(q.o_kk) && q.o_kk.length === 4 && !q.o_kk.some(o => !o || !String(o).trim()) && q.e_kk;
const valid = [];
let bad = 0;
for (const p of passages) {
  if (!p.t || !p.tx || p.tx.trim().length < 50 || !p.t_kk || !p.tx_kk) { bad++; continue; }
  if (!Array.isArray(p.qs) || p.qs.length !== 5 || !p.qs.every(okQ)) { bad++; continue; }
  valid.push(p);
}
console.log(`Valid passages: ${valid.length} (rejected ${bad})`);

// Dedup vs existing passages (by title+text signature)
async function fetchExistingSignatures(subject) {
  const out = []; let off = 0; const P = 1000; const seen = new Set();
  while (true) {
    const { data, error } = await sb.from('questions').select('passage_title,passage_text').eq('subject', subject).range(off, off + P - 1);
    if (error) throw new Error('fetch existing: ' + error.message);
    if (!data || !data.length) break;
    for (const r of data) {
      const sig = (r.passage_title || '') + ' ' + (r.passage_text || '').slice(0, 200);
      if (sig.trim() && !seen.has(sig)) { seen.add(sig); out.push(tokenize(sig)); }
    }
    if (data.length < P) break; off += P;
  }
  return out;
}
const existingSigs = await fetchExistingSignatures(opts.subject);
console.log(`Existing distinct passages: ${existingSigs.length}`);
const kept = []; const keptSigs = []; let dropDup = 0;
for (const p of valid) {
  const t = tokenize(p.t + ' ' + p.tx.slice(0, 200));
  let dup = existingSigs.some(s => jaccard(t, s) >= JACCARD_THRESHOLD);
  if (!dup) dup = keptSigs.some(s => jaccard(t, s) >= JACCARD_THRESHOLD);
  if (dup) { dropDup++; continue; }
  kept.push(p); keptSigs.push(t);
}
console.log(`After dedup: ${kept.length} passages (removed ${dropDup})`);

// Balance correct-index per question (shuffle o + o_kk together)
function shuffleQ(q) {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return { ...q, o: p.map(i => q.o[i]), o_kk: p.map(i => q.o_kk[i]), c: p.indexOf(q.c) };
}
for (const p of kept) p.qs = p.qs.map(shuffleQ);

if (!kept.length) { console.log('Nothing to insert.'); process.exit(0); }

if (opts.dryRun) {
  const qCount = kept.length * 5;
  console.log(`\n--- DRY RUN: would insert ${kept.length} passages (${qCount} questions), source=${opts.source} ---`);
  kept.slice(0, 2).forEach(p => { console.log(`  Passage: ${p.t}`); console.log(`    ${p.tx.slice(0, 90)}...`); console.log(`    Q1: ${p.qs[0].q.slice(0, 70)}`); });
  console.log('--- END DRY RUN (no writes) ---');
  process.exit(0);
}

const { data: mx, error: mxe } = await sb.from('questions').select('idx').eq('subject', opts.subject).not('idx', 'is', null).order('idx', { ascending: false }).limit(1);
if (mxe) throw new Error('maxIdx: ' + mxe.message);
let idx = (mx && mx.length ? mx[0].idx : -1) + 1;
const startIdx = idx;
const rows = [];
for (const p of kept) {
  const pg = idx; // passage_group = first question's idx
  for (const q of p.qs) {
    rows.push({
      subject: opts.subject, idx: idx++, topic: null, subtopic: null,
      q: q.q, o: q.o, c: q.c, e: q.e, q_kk: q.q_kk, o_kk: q.o_kk, e_kk: q.e_kk,
      passage_group: pg, passage_title: p.t, passage_text: p.tx, passage_title_kk: p.t_kk, passage_text_kk: p.tx_kk,
      type: 'single', source: opts.source,
    });
  }
}
const B = 100; let ins = 0;
for (let i = 0; i < rows.length; i += B) {
  const { error } = await sb.from('questions').insert(rows.slice(i, i + B));
  if (error) throw new Error('insert: ' + error.message);
  ins += Math.min(B, rows.length - i); console.log(`Inserted ${ins}/${rows.length}`);
}
console.log(`\nDone. Inserted ${kept.length} passages (${rows.length} questions) into '${opts.subject}' (idx ${startIdx}..${idx - 1}, source='${opts.source}').`);
console.log(`Rollback: node scripts/_pilot/ingest-passages.mjs --purge --subject=${opts.subject} --source=${opts.source}`);
