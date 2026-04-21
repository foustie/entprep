#!/usr/bin/env node
/**
 * Regenerate broken explanations for questions where c is correct but explanation contradicts it.
 * Uses Claude Sonnet to generate accurate explanations.
 *
 * Usage:
 *   node scripts/fix-explanations.mjs                # dry run (shows first 5)
 *   node scripts/fix-explanations.mjs --apply        # write to Supabase
 *
 * Cost: ~$0.50-1.00 (Sonnet, ~50 questions)
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
const AI_MODEL = 'claude-sonnet-4-20250514';

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load quality report — get ALL critical issues
const report = JSON.parse(fs.readFileSync('quality-report.json', 'utf8'));
const targets = [];
for (const subj of report) {
  for (const q of subj.issues) {
    const critIssues = q.issues.filter(i => i.severity === 'critical');
    if (critIssues.length > 0) {
      targets.push({ id: q.id, subject: subj.subject, detail: critIssues[0].detail, type: critIssues[0].type });
    }
  }
}

console.log(`Found ${targets.length} questions with critical issues\n`);

const SUBJECT_NAMES = {
  math: 'Математическая грамотность', history: 'История Казахстана',
  math_profile: 'Математика (профильная)', physics: 'Физика', chemistry: 'Химия',
  biology: 'Биология', geography: 'География', english: 'Английский язык',
  world_history: 'Всемирная история', informatics: 'Информатика',
  law: 'Основы права', reading: 'Грамотность чтения', literature: 'Литература',
};

async function generateExplanation(question, options, correctIdx, subject) {
  const optionsText = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  const correctLetter = String.fromCharCode(65 + correctIdx);
  const subjectName = SUBJECT_NAMES[subject] || subject;

  const prompt = `Ты эксперт по ЕНТ (Казахстан), предмет: ${subjectName}.

Вопрос: ${question}

Варианты:
${optionsText}

Правильный ответ: ${correctLetter}) ${options[correctIdx]}

Напиши КРАТКОЕ объяснение (1-3 предложения) ПОЧЕМУ ответ ${correctLetter} правильный. Простым языком для 11-классника. Если задача с вычислениями — покажи ключевой шаг. Не повторяй текст вопроса. Отвечай только текст объяснения, без маркдауна.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.log('  Rate limited, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return generateExplanation(question, options, correctIdx, subject);
    }
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

let fixed = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < targets.length; i++) {
  const t = targets[i];

  // Fetch full question
  const { data: q, error } = await supabase
    .from('questions')
    .select('id, q, o, c, e, subject')
    .eq('id', t.id)
    .single();

  if (error || !q) {
    console.log(`[${i+1}/${targets.length}] SKIP — not found`);
    skipped++;
    continue;
  }

  const correctIdx = Array.isArray(q.c) ? q.c[0] : q.c;

  // Generate new explanation
  const newExplanation = await generateExplanation(q.q, q.o, correctIdx, q.subject);

  if (!newExplanation) {
    console.log(`[${i+1}/${targets.length}] SKIP — AI returned empty`);
    skipped++;
    continue;
  }

  console.log(`[${i+1}/${targets.length}] ${q.subject}`);
  console.log(`  Q: ${q.q.substring(0, 80)}...`);
  console.log(`  Old e: ${(q.e || '').substring(0, 80)}...`);
  console.log(`  New e: ${newExplanation.substring(0, 80)}...`);

  if (!DRY_RUN) {
    const { error: updateError } = await supabase
      .from('questions')
      .update({ e: newExplanation })
      .eq('id', q.id);

    if (updateError) {
      console.log(`  ERROR: ${updateError.message}`);
      errors++;
    } else {
      fixed++;
    }
  } else {
    fixed++;
  }

  // Rate limit
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`\n━━━ Results ━━━`);
console.log(`Regenerated: ${fixed}`);
console.log(`Skipped: ${skipped}`);
console.log(`Errors: ${errors}`);
if (DRY_RUN) console.log('\nDRY RUN — use --apply to write.');
