#!/usr/bin/env node
/**
 * One-time data integrity fix: set type='matching' on Supabase rows that have
 * pairs[] but no type field. Apr 16 generation pipeline forgot to set type,
 * leaving rows that look "single-choice" by default. Apr 22 client-side
 * inference (getQType in src/types/index.ts) papers over this at runtime,
 * but cleaning the source eliminates the workaround dependency.
 *
 * Usage: node scripts/fix-matching-type-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
} catch {}

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY (need service role for UPDATE)');
  process.exit(1);
}

const supabase = createClient(URL, KEY);

async function main() {
  // Step 1: count rows that need fixing
  // Apr 22 finding: Apr 16 generation pipeline set type='single' (default) on matching rows.
  // Filter is "has pairs but type != matching" — covers both type='single' and type=null cases.
  const { count: needsFix, error: cErr } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .not('pairs', 'is', null)
    .neq('type', 'matching');

  if (cErr) { console.error('Count error:', cErr.message); process.exit(1); }
  console.log(`Rows with pairs but type != 'matching': ${needsFix}`);

  if (needsFix === 0) {
    console.log('Nothing to fix.');
    return;
  }

  // Step 2: dry-run sample
  const { data: sample } = await supabase
    .from('questions')
    .select('idx,subject,q,pairs,type')
    .not('pairs', 'is', null)
    .neq('type', 'matching')
    .limit(3);
  console.log('Sample affected rows:');
  for (const r of sample || []) {
    console.log(`  [${r.subject}] idx=${r.idx} type=${r.type} pairs=${r.pairs?.length} q="${r.q?.slice(0,60)}"`);
  }

  // Step 3: confirm
  if (process.argv[2] !== '--apply') {
    console.log('\nDRY RUN. Re-run with --apply to UPDATE.');
    return;
  }

  // Step 4: apply
  console.log('\nApplying...');
  const { error: uErr, count } = await supabase
    .from('questions')
    .update({ type: 'matching' })
    .not('pairs', 'is', null)
    .neq('type', 'matching')
    .select('*', { count: 'exact', head: true });

  if (uErr) { console.error('Update error:', uErr.message); process.exit(1); }
  console.log(`✅ Updated ${count} rows: type='matching'`);
}

main().catch(err => { console.error(err); process.exit(1); });
