#!/usr/bin/env node
/**
 * Remove trivial recall questions that don't match real ENT style.
 *
 * Usage:
 *   node scripts/remove-trivial.mjs              # dry run
 *   node scripts/remove-trivial.mjs --commit      # delete from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const COMMIT = process.argv.includes('--commit');
if (!COMMIT) console.log('DRY RUN — use --commit to delete\n');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(
  env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY
);

const TRIVIAL_PATTERNS = [
  /^Кто такой /i,
  /^Кто является /i,
  /^Кто был /i,
  /^Что такое /i,
  /^Что это /i,
  /^Как называется /i,
  /^Как называют /i,
  /^Назовите /i,
  /^Что из перечисленного является /i,
];

const SUBJECTS = [
  'math', 'reading', 'history', 'geography', 'english',
  'math_profile', 'physics', 'biology', 'chemistry',
  'world_history', 'informatics', 'law',
];

let grandTotal = 0;
const results = [];

for (const subject of SUBJECTS) {
  // Fetch all questions for this subject
  let allQ = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, q')
      .eq('subject', subject)
      .range(from, from + PAGE - 1);
    if (error) { console.error(`Error fetching ${subject}:`, error.message); break; }
    if (!data || data.length === 0) break;
    allQ.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const trivial = allQ.filter(q => TRIVIAL_PATTERNS.some(p => p.test(q.q)));

  if (trivial.length === 0) {
    console.log(`${subject}: 0 trivial / ${allQ.length} total`);
    continue;
  }

  console.log(`\n${subject}: ${trivial.length} trivial / ${allQ.length} total`);
  for (const t of trivial.slice(0, 5)) {
    console.log(`  - ${t.q.substring(0, 80)}...`);
  }
  if (trivial.length > 5) console.log(`  ... and ${trivial.length - 5} more`);

  if (COMMIT) {
    // Delete in batches of 50
    for (let i = 0; i < trivial.length; i += 50) {
      const batch = trivial.slice(i, i + 50);
      const ids = batch.map(q => q.id);
      const { error } = await supabase
        .from('questions')
        .delete()
        .in('id', ids);
      if (error) console.error(`  Delete error: ${error.message}`);
    }
    console.log(`  DELETED ${trivial.length} questions`);
  }

  results.push({ subject, trivial: trivial.length, total: allQ.length });
  grandTotal += trivial.length;
}

console.log(`\n━━━ Summary ━━━`);
console.log(`Total trivial: ${grandTotal}`);
if (!COMMIT) console.log('DRY RUN — use --commit to delete.');
else console.log('Run: node scripts/dump-questions.mjs');
