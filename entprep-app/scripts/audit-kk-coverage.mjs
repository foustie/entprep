#!/usr/bin/env node
/** Audit Kazakh translation coverage per subject. */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const SUBJECTS = [
  'math', 'reading', 'history', 'geography', 'english',
  'math_profile', 'physics', 'biology', 'chemistry',
  'world_history', 'informatics', 'law', 'literature_russian', 'literature_kazakh',
];

console.log('Subject           Total  q_kk   o_kk   e_kk   Full%');
console.log('─'.repeat(60));

let gTotal = 0, gQkk = 0, gOkk = 0, gEkk = 0, gFull = 0;

for (const sid of SUBJECTS) {
  const [
    { count: total },
    { count: qKk },
    { count: oKk },
    { count: eKk },
    { count: full },
  ] = await Promise.all([
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).not('q_kk', 'is', null),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).not('o_kk', 'is', null),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).not('e_kk', 'is', null),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sid).not('q_kk', 'is', null).not('o_kk', 'is', null).not('e_kk', 'is', null),
  ]);

  if (!total) continue;
  const pct = total > 0 ? Math.round(full / total * 100) : 0;
  const name = sid.padEnd(18);
  console.log(`${name}${String(total).padStart(5)}  ${String(qKk).padStart(5)}  ${String(oKk).padStart(5)}  ${String(eKk).padStart(5)}  ${String(pct).padStart(4)}%`);

  gTotal += total; gQkk += qKk; gOkk += oKk; gEkk += eKk; gFull += full;
}

console.log('─'.repeat(60));
const pct = gTotal > 0 ? Math.round(gFull / gTotal * 100) : 0;
console.log(`${'TOTAL'.padEnd(18)}${String(gTotal).padStart(5)}  ${String(gQkk).padStart(5)}  ${String(gOkk).padStart(5)}  ${String(gEkk).padStart(5)}  ${String(pct).padStart(4)}%`);
