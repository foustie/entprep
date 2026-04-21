#!/usr/bin/env node
/** Audit answer distribution (correct index bias) per subject. Real ENT = 25% each. */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const FIX = process.argv.includes('--fix');

const SUBJECTS = ['math','reading','history','geography','english','math_profile','physics','biology','chemistry','world_history','informatics','law'];

console.log(`${FIX ? 'FIX MODE' : 'AUDIT ONLY'} — answer distribution per subject\n`);
console.log('Subject           A%   B%   C%   D%   Bias  Count');
console.log('─'.repeat(55));

for (const subject of SUBJECTS) {
  // Fetch single-choice questions only
  let all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, c, o, type')
      .eq('subject', subject)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Only count single-choice with 4 options
  const single = all.filter(q => (q.type === 'single' || !q.type) && Array.isArray(q.o) && q.o.length === 4 && Number.isInteger(q.c));
  if (single.length === 0) { console.log(`${subject.padEnd(18)}— no single-choice`); continue; }

  const counts = [0, 0, 0, 0];
  for (const q of single) counts[q.c]++;
  const pcts = counts.map(c => Math.round(c / single.length * 100));
  const maxDiff = Math.max(...pcts) - Math.min(...pcts);
  const biasFlag = maxDiff > 10 ? '⚠️' : '✓';

  console.log(`${subject.padEnd(18)}${String(pcts[0]).padStart(3)}  ${String(pcts[1]).padStart(3)}  ${String(pcts[2]).padStart(3)}  ${String(pcts[3]).padStart(3)}   ${biasFlag}    ${single.length}`);

  // FIX: Randomly shuffle the `c` index for biased subjects to move it toward 25% each
  if (FIX && maxDiff > 10) {
    // Find over-represented indices, move some to under-represented
    const target = Math.floor(single.length / 4);
    // For each over-represented position, swap some questions
    for (let overIdx = 0; overIdx < 4; overIdx++) {
      if (counts[overIdx] <= target + 5) continue;
      const excess = counts[overIdx] - target;
      const surplus = single.filter(q => q.c === overIdx).slice(0, excess);
      for (const q of surplus) {
        // Pick the least-represented index
        let minIdx = 0;
        for (let i = 1; i < 4; i++) if (counts[i] < counts[minIdx]) minIdx = i;
        if (minIdx === overIdx) break;
        // Swap options so correct answer moves to minIdx
        const newO = [...q.o];
        [newO[overIdx], newO[minIdx]] = [newO[minIdx], newO[overIdx]];
        const { error } = await supabase.from('questions').update({ o: newO, c: minIdx }).eq('id', q.id);
        if (!error) { counts[overIdx]--; counts[minIdx]++; }
      }
    }
    const newPcts = counts.map(c => Math.round(c / single.length * 100));
    console.log(`  After fix:      ${newPcts.map(p => String(p).padStart(3)).join('  ')}`);
  }
}

console.log('\nTarget: 25% each. >10% spread = bias flag.');
if (!FIX) console.log('Use --fix to rebalance (shuffles options for over-biased subjects).');
