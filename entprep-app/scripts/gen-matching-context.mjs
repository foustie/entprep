#!/usr/bin/env node
/**
 * Generate matching + context questions for ENT profile subjects.
 *
 * Usage:
 *   node scripts/gen-matching-context.mjs                    # dry run
 *   node scripts/gen-matching-context.mjs --apply            # write to Supabase
 *   node scripts/gen-matching-context.mjs --apply --subject=chemistry
 *
 * Cost: ~$3-5 total (Sonnet, ~60 API calls)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const SUBJECT_FILTER = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
if (!APPLY) console.log('DRY RUN — use --apply to write to Supabase\n');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const API_KEY = env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';

const SUBJECTS = [
  { id: 'chemistry', name: 'Химия', topics: ['органическая химия', 'неорганическая химия', 'общая химия', 'аналитическая химия', 'химия элементов'] },
  { id: 'physics', name: 'Физика', topics: ['механика', 'электричество и магнетизм', 'оптика и волны', 'термодинамика', 'атомная и ядерная физика'] },
  { id: 'biology', name: 'Биология', topics: ['клеточная биология', 'генетика и эволюция', 'анатомия человека', 'ботаника', 'экология и зоология'] },
  { id: 'math_profile', name: 'Математика (профильная)', topics: ['алгебра и функции', 'геометрия', 'тригонометрия', 'начала анализа', 'комбинаторика и вероятность'] },
  { id: 'history', name: 'История Казахстана', topics: ['древний и средневековый Казахстан', 'Казахское ханство', 'колониальный период', 'советский период', 'современный Казахстан'] },
  { id: 'world_history', name: 'Всемирная история', topics: ['Древний мир', 'Средние века', 'Новое время', 'XX век', 'современный мир'] },
  { id: 'geography', name: 'География', topics: ['физическая география', 'экономическая география', 'география Казахстана', 'население и демография', 'природные ресурсы'] },
  { id: 'informatics', name: 'Информатика', topics: ['алгоритмы и программирование', 'базы данных', 'сети и интернет', 'информационные системы', 'компьютерная архитектура'] },
  { id: 'english', name: 'Английский язык', topics: ['grammar tenses', 'conditionals and modals', 'vocabulary in context', 'reading comprehension', 'word formation'] },
  { id: 'law', name: 'Основы права', topics: ['конституционное право РК', 'гражданское право', 'уголовное право', 'трудовое право', 'административное право'] },
];

async function callAPI(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.log('  Rate limited, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return callAPI(prompt);
    }
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  let raw = data.content?.[0]?.text?.trim() || '';
  raw = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(raw);
}

// ── MATCHING GENERATION ──────────────────────────────────────────────────

async function genMatching(subject, topic) {
  const prompt = `Ты эксперт по ЕНТ (Казахстан), предмет: ${subject.name} 11 класс.

Сгенерируй 5 вопросов на СООТВЕТСТВИЕ (matching) по теме: ${topic}.

Формат ЕНТ: 5 элементов слева, 5 справа. Каждый левый соответствует ровно одному правому.

Требования:
- Уровень сложности ЕНТ (средний-сложный)
- НЕ тривиальные — требуют знания материала
- Пары должны быть правдоподобно перепутываемыми (не очевидные)

Верни JSON массив:
[
  {
    "q": "Установите соответствие между ...",
    "pairs": [["левый1","правый1"],["левый2","правый2"],["левый3","правый3"],["левый4","правый4"],["левый5","правый5"]],
    "e": "Объяснение 1-2 предложения",
    "q_kk": "Казахский перевод вопроса",
    "pairs_kk": [["сол1","оң1"],["сол2","оң2"],["сол3","оң3"],["сол4","оң4"],["сол5","оң5"]],
    "e_kk": "Казахский перевод объяснения"
  }
]

Строго JSON без markdown.`;

  return callAPI(prompt);
}

// ── CONTEXT/PASSAGE GENERATION ───────────────────────────────────────────

async function genContext(subject, topic) {
  const prompt = `Ты эксперт по ЕНТ (Казахстан), предмет: ${subject.name} 11 класс.

Сгенерируй 1 текст-контекст (150-300 слов) по теме: ${topic}.
К тексту сгенерируй 5 вопросов на анализ и понимание текста.

Требования:
- Текст должен быть информативным и образовательным
- Вопросы требуют АНАЛИЗА текста, не общих знаний
- 4 варианта ответа на каждый вопрос
- Уровень ЕНТ

Верни JSON:
{
  "title": "Название текста",
  "text": "Полный текст 150-300 слов...",
  "title_kk": "Казахский перевод названия",
  "text_kk": "Казахский перевод текста",
  "questions": [
    {
      "q": "Вопрос по тексту?",
      "o": ["A","B","C","D"],
      "c": 0,
      "e": "Объяснение",
      "q_kk": "Казахский вопрос",
      "o_kk": ["A_kk","B_kk","C_kk","D_kk"],
      "e_kk": "Казахский объяснение"
    }
  ]
}

Строго JSON без markdown.`;

  return callAPI(prompt);
}

// ── MAIN ──────────────────────────────────────────────────────────────────

let totalMatching = 0;
let totalContext = 0;

for (const subject of SUBJECTS) {
  if (SUBJECT_FILTER && subject.id !== SUBJECT_FILTER) continue;

  console.log(`\n═══ ${subject.name} (${subject.id}) ═══`);

  // Generate matching: 5 questions per topic × 5 topics = 25
  for (const topic of subject.topics) {
    console.log(`  Matching: ${topic}...`);
    try {
      const questions = await genMatching(subject, topic);
      console.log(`    Generated ${questions.length} matching questions`);

      if (APPLY) {
        for (const q of questions) {
          const row = {
            q: q.q, o: [], c: 0, e: q.e,
            pairs: q.pairs,
            subject: subject.id,
            block: 'matching',
            q_kk: q.q_kk, o_kk: [], e_kk: q.e_kk,
            pairs_kk: q.pairs_kk,
          };
          const { error } = await supabase.from('questions').insert(row);
          if (error) console.log(`    ERROR: ${error.message}`);
        }
      }

      totalMatching += questions.length;
    } catch (err) {
      console.log(`    ERROR: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Generate context: 1 passage per topic × 5 topics = 5 passages (25 questions)
  for (const topic of subject.topics) {
    console.log(`  Context: ${topic}...`);
    try {
      const passage = await genContext(subject, topic);
      const qCount = passage.questions?.length || 0;
      console.log(`    Generated 1 passage + ${qCount} questions`);

      if (APPLY) {
        for (const q of passage.questions) {
          const row = {
            q: q.q, o: q.o, c: q.c, e: q.e,
            subject: subject.id,
            block: 'context',
            p: passage.text,
            _topic: topic,
            q_kk: q.q_kk, o_kk: q.o_kk, e_kk: q.e_kk,
          };
          const { error } = await supabase.from('questions').insert(row);
          if (error) console.log(`    ERROR: ${error.message}`);
        }
      }

      totalContext += qCount;
    } catch (err) {
      console.log(`    ERROR: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log(`\n━━━ Summary ━━━`);
console.log(`Matching: ${totalMatching} questions`);
console.log(`Context: ${totalContext} questions`);
if (!APPLY) console.log('DRY RUN — use --apply to write.');
