#!/usr/bin/env node
/**
 * Lightweight diagnostic: counts context/passage questions per subject in Supabase.
 * No dump, no write. Just counts. ~1 sec per subject.
 *
 * Usage: node scripts/check-supabase-context.mjs
 *
 * Answers: "Memory claim of 189 context questions Apr 16 — are they actually in Supabase or memory mirage?"
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
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(URL, KEY);

const SUBJECTS = [
  'math','reading','history','geography','english',
  'math_profile','physics','biology','chemistry',
  'world_history','informatics','law','literature_russian','literature_kazakh',
];

console.log('Subject              | total | type=context | passage_group≠null | type=matching | type=multiple');
console.log('-'.repeat(110));
let grand = { total: 0, ctx: 0, pg: 0, match: 0, multi: 0 };
for (const sid of SUBJECTS) {
  const total = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid);
  const ctx = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).eq('type', 'context');
  const pg = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).not('passage_group', 'is', null);
  const match = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).eq('type', 'matching');
  const multi = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).eq('type', 'multiple');
  const t = total.count ?? 0, c = ctx.count ?? 0, p = pg.count ?? 0, mt = match.count ?? 0, mu = multi.count ?? 0;
  grand.total += t; grand.ctx += c; grand.pg += p; grand.match += mt; grand.multi += mu;
  console.log(`${sid.padEnd(20)} | ${String(t).padStart(5)} | ${String(c).padStart(12)} | ${String(p).padStart(18)} | ${String(mt).padStart(13)} | ${String(mu).padStart(13)}`);
}
console.log('-'.repeat(110));
console.log(`${'TOTAL'.padEnd(20)} | ${String(grand.total).padStart(5)} | ${String(grand.ctx).padStart(12)} | ${String(grand.pg).padStart(18)} | ${String(grand.match).padStart(13)} | ${String(grand.multi).padStart(13)}`);

// Sample 1 row of each non-zero exotic type for reality check
console.log('\nSamples:');
for (const sid of SUBJECTS) {
  const ctx = await supabase.from('questions').select('idx,topic,subtopic,q,passage_group').eq('subject', sid).eq('type', 'context').limit(1);
  if (ctx.data?.[0]) console.log(`  [${sid}] context sample idx=${ctx.data[0].idx} topic=${ctx.data[0].topic} pg=${ctx.data[0].passage_group} q="${ctx.data[0].q?.slice(0,60)}"`);
}
