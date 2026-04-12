#!/usr/bin/env node
/**
 * Fix weak distractors — regenerate only the wrong answer options.
 * Keeps the question text and correct answer, replaces distractors
 * with plausible alternatives of matching length and format.
 *
 * Usage:
 *   node scripts/fix-distractors.mjs                    # all subjects
 *   node scripts/fix-distractors.mjs --subject=history   # one subject
 *   node scripts/fix-distractors.mjs --dry-run           # preview only
 *   node scripts/fix-distractors.mjs --high-only         # only high severity
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VALID_SUBJECTS, AI_MODEL } from './utils/constants.mjs';
import { extractJSON } from './utils/json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY required');
  process.exit(1);
}

const args = process.argv.slice(2);
const subjectArg = args.find(a => a.startsWith('--subject='))?.split('=')[1];
const dryRun = args.includes('--dry-run');
const highOnly = args.includes('--high-only');

const SUBJECT_NAMES = {
  math: 'Математическая грамотность', history: 'История Казахстана',
  math_profile: 'Математика (профильная)', physics: 'Физика', biology: 'Биология',
  english: 'Английский язык', chemistry: 'Химия', geography: 'География',
  world_history: 'Всемирная история', informatics: 'Информатика',
  law: 'Основы права', literature: 'Литература', reading: 'Грамотность чтения',
};

const BATCH_SIZE = 5;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Detect flagged questions (same logic as audit-distractors.mjs) ──

function detectLengthBias(q) {
  if (!q.o || !Array.isArray(q.o) || q.o.length < 3) return null;
  if (typeof q.c !== 'number' || Array.isArray(q.c) || q.pairs) return null;

  const correct = q.o[q.c];
  const distractors = q.o.filter((_, i) => i !== q.c);
  const correctLen = correct.length;
  const avgDistLen = distractors.reduce((s, d) => s + d.length, 0) / distractors.length;

  if (correctLen > avgDistLen * 2.0 && correctLen > 20) {
    return {
      severity: correctLen > avgDistLen * 3 ? 'high' : 'medium',
      ratio: correctLen / avgDistLen,
    };
  }
  return null;
}

// ── AI call ──

async function callClaude(systemPrompt, userPrompt, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: 4096,
          temperature: 0.8,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim();
      if (!raw) throw new Error('Empty response');
      return extractJSON(raw);
    } catch (e) {
      const isRate = e.message.includes('429') || e.message.includes('rate_limit');
      if (attempt < maxRetries) {
        const wait = isRate ? 30 + attempt * 20 : 5 + attempt * 3;
        console.log(`    Retry ${attempt + 1}/${maxRetries} in ${wait}s — ${isRate ? 'rate limit' : e.message.slice(0, 60)}`);
        await sleep(wait * 1000);
      } else throw e;
    }
  }
}

// ── Build prompt for distractor regeneration ──

function buildPrompt(subject, questions) {
  const subjectName = SUBJECT_NAMES[subject] || subject;

  const qList = questions.map((q, i) => {
    const correct = q.o[q.c];
    const correctLen = correct.length;
    return `${i + 1}. Вопрос: "${q.q}"
   Правильный ответ (индекс ${q.c}): "${correct}" (${correctLen} символов)
   Текущие дистракторы: ${q.o.filter((_, j) => j !== q.c).map(d => `"${d}" (${d.length}сим)`).join(', ')}`;
  }).join('\n\n');

  const system = `Ты эксперт по созданию вопросов ЕНТ. Предмет: ${subjectName}.

ЗАДАЧА: Для каждого вопроса создай 3 НОВЫХ неправильных варианта ответа (дистрактора).

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Каждый дистрактор должен быть ПРИМЕРНО ТАКОЙ ЖЕ ДЛИНЫ как правильный ответ (±30%)
2. Дистракторы должны быть ПРАВДОПОДОБНЫМИ — ученик без знаний НЕ должен отличить их от правильного
3. Используй ТОТ ЖЕ формат и стиль что у правильного ответа
4. Если правильный ответ — развёрнутое предложение, дистракторы тоже должны быть развёрнутыми
5. Если правильный ответ — короткое слово/число, дистракторы тоже короткие
6. Дистракторы должны быть из ТОЙ ЖЕ ОБЛАСТИ знаний (не абсурдные)
7. НЕ добавляй подсказки в скобках

Верни JSON: {"results":[{"index":0,"distractors":["вариант1","вариант2","вариант3"]},...]}
index = порядковый номер вопроса (начиная с 0)`;

  return { system, user: `Создай по 3 дистрактора для ${questions.length} вопросов:\n\n${qList}` };
}

// ── Process one subject ──

async function processSubject(sid) {
  const filePath = join(DATA_DIR, `${sid}.json`);
  if (!existsSync(filePath)) { console.log(`  No data for ${sid}`); return 0; }

  const questions = JSON.parse(readFileSync(filePath, 'utf8'));
  const flagged = [];

  for (const q of questions) {
    const bias = detectLengthBias(q);
    if (!bias) continue;
    if (highOnly && bias.severity !== 'high') continue;
    flagged.push({ ...q, _bias: bias });
  }

  if (flagged.length === 0) { console.log(`  No flagged questions`); return 0; }

  console.log(`  ${flagged.length} questions to fix (${flagged.filter(f => f._bias.severity === 'high').length} high, ${flagged.filter(f => f._bias.severity === 'medium').length} medium)`);

  if (dryRun) {
    flagged.slice(0, 3).forEach(q => {
      console.log(`    Q: ${q.q.slice(0, 70)}...`);
      console.log(`    ✓: "${q.o[q.c].slice(0, 50)}" (${q.o[q.c].length}ch)`);
      console.log(`    ✗: ${q.o.filter((_, i) => i !== q.c).map(d => `"${d.slice(0, 30)}" (${d.length}ch)`).join(', ')}`);
      console.log(`    ratio: ${q._bias.ratio.toFixed(1)}x\n`);
    });
    return 0;
  }

  let fixed = 0;

  // Process in batches
  for (let i = 0; i < flagged.length; i += BATCH_SIZE) {
    const batch = flagged.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(flagged.length / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);

    try {
      const { system, user } = buildPrompt(sid, batch);
      const result = await callClaude(system, user);

      if (!result?.results || !Array.isArray(result.results)) {
        console.log(` ✗ invalid response format`);
        continue;
      }

      for (const r of result.results) {
        const idx = r.index;
        if (idx == null || idx < 0 || idx >= batch.length) continue;
        if (!r.distractors || r.distractors.length !== 3) continue;

        const q = batch[idx];
        const correctAnswer = q.o[q.c];

        // Build new options array: put correct at random position
        const newCorrectIdx = Math.floor(Math.random() * 4);
        const newOptions = [...r.distractors];
        newOptions.splice(newCorrectIdx, 0, correctAnswer);

        // Validate lengths — distractors should be within 2x of correct
        const correctLen = correctAnswer.length;
        const validLengths = r.distractors.every(d =>
          d.length >= correctLen * 0.3 && d.length <= correctLen * 3
        );

        if (!validLengths) {
          console.log(`\n    ⚠ Skipping #${q.q?.slice(0, 30)}: distractor lengths still imbalanced`);
          continue;
        }

        // Update in Supabase — find by subject + question text (no idx in JSON)
        const { error } = await supabase
          .from('questions')
          .update({ o: newOptions, c: newCorrectIdx })
          .eq('subject', sid)
          .eq('q', q.q)
          .limit(1);

        if (error) {
          console.log(`\n    ✗ DB error #${q.q?.slice(0, 30)}: ${error.message}`);
        } else {
          fixed++;
        }
      }

      console.log(` ✓ ${result.results.length} processed`);
      await sleep(2000);
    } catch (err) {
      console.log(` ✗ ${err.message.slice(0, 80)}`);
      await sleep(5000);
    }
  }

  return fixed;
}

// ── Main ──

async function main() {
  console.log(`ENTprep Distractor Fix`);
  console.log(`Model: ${AI_MODEL}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE — will update Supabase'}`);
  console.log(`Filter: ${highOnly ? 'high severity only' : 'all flagged'}\n`);

  const subjects = subjectArg
    ? [subjectArg]
    : VALID_SUBJECTS.filter(s => s !== 'reading');

  let totalFixed = 0;

  for (const sid of subjects) {
    const name = SUBJECT_NAMES[sid] || sid;
    console.log(`\n${'='.repeat(60)}\n${name} (${sid})\n${'='.repeat(60)}`);
    const fixed = await processSubject(sid);
    totalFixed += fixed;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DONE: ${totalFixed} distractors fixed`);
  console.log(`\n⚠ Run: node scripts/dump-questions.mjs && deploy to update CDN`);
}

main().catch(err => { console.error(err); process.exit(1); });
