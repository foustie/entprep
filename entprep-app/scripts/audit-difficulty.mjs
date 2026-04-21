#!/usr/bin/env node
/** Audit difficulty distribution per subject. Real ENT = 50% easy / 30% medium / 20% hard. */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const SUBJECTS = ['math','reading','history','geography','english','math_profile','physics','biology','chemistry','world_history','informatics','law'];

console.log('AUDIT — difficulty distribution vs ENT target (50/30/20)\n');
console.log('Subject           Easy  Med   Hard  NULL  Target Gap');
console.log('─'.repeat(60));

const TARGET = { easy: 50, medium: 30, hard: 20 };

for (const subject of SUBJECTS) {
  const [
    { count: total },
    { count: easy },
    { count: medium },
    { count: hard },
    { count: untagged },
  ] = await Promise.all([
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject).eq('difficulty', 'easy'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject).eq('difficulty', 'medium'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject).eq('difficulty', 'hard'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject).is('difficulty', null),
  ]);

  if (!total) continue;
  const eP = Math.round(easy / total * 100);
  const mP = Math.round(medium / total * 100);
  const hP = Math.round(hard / total * 100);
  const nP = Math.round(untagged / total * 100);

  // Gap from target (excluding null)
  const tagged = easy + medium + hard;
  let gap = '?';
  if (tagged > 50) {
    const eT = easy / tagged * 100;
    const mT = medium / tagged * 100;
    const hT = hard / tagged * 100;
    const diff = Math.abs(eT - TARGET.easy) + Math.abs(mT - TARGET.medium) + Math.abs(hT - TARGET.hard);
    gap = diff > 40 ? '🔴 big' : diff > 20 ? '🟡 med' : '✓ ok';
  }

  console.log(`${subject.padEnd(18)}${String(eP).padStart(3)}%  ${String(mP).padStart(3)}%  ${String(hP).padStart(3)}%  ${String(nP).padStart(3)}%  ${gap}`);
}

console.log('\nNULL = questions without difficulty tag. ENT spec: 50% easy / 30% medium / 20% hard.');
