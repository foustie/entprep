#!/usr/bin/env node
/**
 * Fix critical question issues (answer-mismatch).
 * Uses Claude Haiku to verify correct answer, then fixes c value in Supabase.
 *
 * Usage:
 *   node scripts/fix-criticals.mjs                # dry run
 *   node scripts/fix-criticals.mjs --apply        # write fixes to Supabase
 *
 * Cost: ~$0.05-0.15 (Haiku, 43 questions)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const DRY_RUN = !process.argv.includes('--apply');
if (DRY_RUN) console.log('DRY RUN — use --apply to write fixes\n');

// Load .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE env vars'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load quality report
const report = JSON.parse(fs.readFileSync('quality-report.json', 'utf8'));
const criticals = [];
for (const subj of report) {
  for (const q of subj.issues) {
    const critIssues = q.issues.filter(i => i.severity === 'critical' && i.type === 'answer-mismatch');
    if (critIssues.length > 0) {
      criticals.push({ id: q.id, idx: q.idx, subject: subj.subject, detail: critIssues[0].detail });
    }
  }
}

console.log(`Found ${criticals.length} answer-mismatch questions to verify\n`);

async function askHaiku(question, options, subject) {
  const optionsText = options.map((o, i) => `${i}) ${o}`).join('\n');
  const prompt = `Ты эксперт по ЕНТ (Казахстан). Предмет: ${subject}.

Вопрос: ${question}

Варианты:
${optionsText}

Какой вариант ПРАВИЛЬНЫЙ? Ответь ТОЛЬКО номером (0, 1, 2 или 3). Ничего больше.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      console.log('  Rate limited, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return askHaiku(question, options, subject);
    }
    throw new Error(`Haiku error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const answer = data.content?.[0]?.text?.trim();
  const idx = parseInt(answer);
  return isNaN(idx) ? null : idx;
}

let fixed = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < criticals.length; i++) {
  const crit = criticals[i];

  // Fetch full question from Supabase
  const { data: q, error } = await supabase
    .from('questions')
    .select('id, q, o, c, e, subject')
    .eq('id', crit.id)
    .single();

  if (error || !q) {
    console.log(`[${i+1}/${criticals.length}] SKIP ${crit.id} — not found`);
    skipped++;
    continue;
  }

  const currentCorrect = Array.isArray(q.c) ? q.c[0] : q.c;

  // Ask Haiku for the correct answer
  const haikuAnswer = await askHaiku(q.q, q.o, q.subject);

  if (haikuAnswer === null) {
    console.log(`[${i+1}/${criticals.length}] SKIP ${q.subject} — Haiku couldn't determine answer`);
    skipped++;
    continue;
  }

  if (haikuAnswer === currentCorrect) {
    console.log(`[${i+1}/${criticals.length}] OK ${q.subject} — Haiku agrees with current c=${currentCorrect} (explanation wrong, not answer)`);
    skipped++;
    continue;
  }

  console.log(`[${i+1}/${criticals.length}] FIX ${q.subject}: c=${currentCorrect} → c=${haikuAnswer}`);
  console.log(`  Q: ${q.q.substring(0, 80)}...`);
  console.log(`  Old: ${q.o[currentCorrect]}`);
  console.log(`  New: ${q.o[haikuAnswer]}`);
  console.log(`  Detail: ${crit.detail}`);

  if (!DRY_RUN) {
    const { error: updateError } = await supabase
      .from('questions')
      .update({ c: haikuAnswer })
      .eq('id', q.id);

    if (updateError) {
      console.log(`  ERROR: ${updateError.message}`);
      errors++;
    } else {
      console.log(`  FIXED in Supabase`);
      fixed++;
    }
  } else {
    fixed++;
  }

  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n━━━ Results ━━━`);
console.log(`Fixed: ${fixed}`);
console.log(`Skipped (OK or unclear): ${skipped}`);
console.log(`Errors: ${errors}`);
console.log(`Total: ${criticals.length}`);
if (DRY_RUN) console.log('\nDRY RUN — no changes made. Use --apply to write.');
