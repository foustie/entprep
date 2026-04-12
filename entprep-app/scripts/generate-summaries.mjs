#!/usr/bin/env node
/**
 * Generate theory summaries for ALL subjects using Claude API.
 * RAG-ready: structured text with metadata for future pgvector migration.
 * Uses actual ENT questions from the database as context.
 *
 * Usage:
 *   node scripts/generate-summaries.mjs              # all subjects
 *   node scripts/generate-summaries.mjs history       # single subject
 *   node scripts/generate-summaries.mjs --skip history # all except history
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
} catch {}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const OUT_DIR = join(__dirname, '..', 'public', 'data', 'summaries');
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const TOPICS_FILE = join(__dirname, '..', 'src', 'config', 'topics.ts');

// ── Parse topics from TypeScript config ──
function parseTopics() {
  const src = readFileSync(TOPICS_FILE, 'utf8');
  const result = {};

  // Match each subject block: subject_id: [ ... ]
  const subjectRe = /^\s{2}(\w+):\s*\[/gm;
  let match;
  const subjectPositions = [];
  while ((match = subjectRe.exec(src)) !== null) {
    subjectPositions.push({ id: match[1], start: match.index });
  }

  for (let i = 0; i < subjectPositions.length; i++) {
    const sid = subjectPositions[i].id;
    if (sid === 'reading') continue; // reading has passages, not topics

    const start = subjectPositions[i].start;
    const end = i + 1 < subjectPositions.length ? subjectPositions[i + 1].start : src.length;
    const block = src.slice(start, end);

    const topics = {};
    // Parse top-level topics: { id: 'xxx', name: 'Yyy', ...
    const topicRe = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'(?:,\s*name_kk:\s*'([^']*)')?/g;
    let tm;
    let currentTopicId = null;
    let inSubtopics = false;

    // Simple line-by-line parse
    const lines = block.split('\n');
    for (const line of lines) {
      const topicMatch = line.match(/^\s{4}\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/);
      if (topicMatch && !line.includes('subtopics')) {
        currentTopicId = topicMatch[1];
        topics[currentTopicId] = topicMatch[2];
        inSubtopics = false;
      }

      const subtopicMatch = line.match(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/);
      if (subtopicMatch && line.match(/^\s{8,}/)) {
        topics[subtopicMatch[1]] = subtopicMatch[2];
      }
    }

    if (Object.keys(topics).length > 0) {
      result[sid] = topics;
    }
  }

  return result;
}

// ── Subject-specific system prompts ──
const SUBJECT_PROMPTS = {
  math: 'математической грамотности для ЕНТ. Включай формулы, примеры решений, типичные задачи. Математические выражения пиши текстом: x², √, π и т.д.',
  math_profile: 'профильной математике для ЕНТ. Включай формулы, теоремы, алгоритмы решения, примеры. Математические выражения пиши текстом.',
  physics: 'физике для ЕНТ. Включай формулы, законы, единицы измерения, типичные задачи с решениями.',
  chemistry: 'химии для ЕНТ. Включай уравнения реакций, свойства элементов, формулы, правила.',
  biology: 'биологии для ЕНТ. Включай процессы, системы, классификации, ключевые термины.',
  history: 'истории Казахстана для ЕНТ. Включай даты, события, имена, причинно-следственные связи.',
  world_history: 'всемирной истории для ЕНТ. Включай даты, события, имена, причинно-следственные связи.',
  geography: 'географии для ЕНТ. Включай факты, цифры, географические объекты, процессы.',
  english: 'английскому языку для ЕНТ. Включай грамматические правила, примеры, исключения. Примеры предложений пиши на английском.',
  informatics: 'информатике для ЕНТ. Включай алгоритмы, системы счисления, логику, основы программирования.',
  law: 'основам права для ЕНТ. Включай статьи, нормы, определения, классификации.',
  literature: 'казахской/русской литературе для ЕНТ. Включай авторов, произведения, жанры, ключевые цитаты и образы.',
};

const BASE_PROMPT = `Ты — автор конспектов для подготовки к ЕНТ по SUBJECT_DESC

СТИЛЬ: Пиши как будто рассказываешь другу. НЕ как учебник. Факты должны запоминаться через образы и ассоциации.

ПРАВИЛА:
- Начни с яркого факта или образа (1-2 предложения) — никаких "Давайте рассмотрим" или "В данном конспекте"
- Структурируй: ключевые факты, формулы, определения
- Ключевые термины выделяй жирным: **термин**
- В конце: "Что спрашивают на ЕНТ" — 5-7 частых вопросов с ответами
- И "Ловушки на ЕНТ" — 3-5 типичных ошибок
- Длина: 400-800 слов
- Не используй AI-клише: "важно отметить", "стоит подчеркнуть", "давайте разберём"
- Каждый абзац — конкретные факты, не общие слова
- Формат: ## для подзаголовков, **жирный** для терминов, • для списков`;

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function generateForSubject(sid, topicMap) {
  const qPath = join(DATA_DIR, `${sid}.json`);
  if (!existsSync(qPath)) { console.log(`  No data for ${sid}, skipping`); return; }

  const allQuestions = JSON.parse(readFileSync(qPath, 'utf8'));
  const outPath = join(OUT_DIR, `${sid}.json`);

  // Load existing (resume support)
  let results = {};
  if (existsSync(outPath)) {
    try { results = JSON.parse(readFileSync(outPath, 'utf8')); } catch {}
  }

  const subjectDesc = SUBJECT_PROMPTS[sid] || `предмету ${sid} для ЕНТ.`;
  const systemPrompt = BASE_PROMPT.replace('SUBJECT_DESC', subjectDesc);

  const topicIds = Object.keys(topicMap);
  let generated = 0, cached = 0;

  for (const tid of topicIds) {
    const hasRu = results[tid]?.ru;
    const hasKk = results[tid]?.kk;
    if (hasRu && hasKk) { cached++; continue; }

    const questions = allQuestions.filter(q => q._subtopic === tid || q._topic === tid);
    const topicName = topicMap[tid];

    if (questions.length === 0) { continue; }

    // Generate Russian if missing
    if (!hasRu) {
      process.stdout.write(`  → ${topicName} [ru] (${questions.length}q)...`);
      const qSample = questions.slice(0, 20).map((q, i) => {
        const correct = typeof q.c === 'number' ? q.o[q.c] : 'multiple';
        return `${i + 1}. ${q.q}\n   Ответ: ${correct}${q.e ? '\n   Пояснение: ' + q.e.slice(0, 150) : ''}`;
      }).join('\n\n');

      const userPrompt = `Напиши конспект по теме "${topicName}".\n\nВот ${questions.length} реальных вопросов ЕНТ по этой теме:\n\n${qSample}\n\nСфокусируйся на фактах которые РЕАЛЬНО спрашивают на ЕНТ.`;

      try {
        const summary = await callClaude(systemPrompt, userPrompt);
        results[tid] = { ...(results[tid] || {}), ru: summary };
        generated++;
        console.log(` ✓ (${summary.length}ch)`);
        writeFileSync(outPath, JSON.stringify(results, null, 2));
        await new Promise(r => setTimeout(r, 1200));
      } catch (err) {
        console.log(` ✗ ${err.message.slice(0, 80)}`);
        continue;
      }
    }

    // Generate Kazakh if missing
    if (!hasKk && results[tid]?.ru) {
      process.stdout.write(`  → ${topicName} [kk]...`);
      const kkPrompt = `Мына конспектті қазақ тіліне аудар. Стиль мен форматты сақта (## тақырыптар, **жуан** терминдер, • тізімдер). "ЕНТ-да не сұралады" бөлімін "ҰБТ-да не сұралады" деп аудар. Сапалы, табиғи қазақ тілінде жаз — дословный аударма жасама.\n\nКонспект:\n${results[tid].ru}`;

      try {
        const kkSummary = await callClaude('Сен кәсіби аудармашысың. Орыс тілінен қазақ тіліне сапалы аударма жаса. Мағынаны сақта, дословный аударма жасама. Табиғи қазақ тілінде жаз.', kkPrompt);
        results[tid] = { ...results[tid], kk: kkSummary };
        generated++;
        console.log(` ✓ (${kkSummary.length}ch)`);
        writeFileSync(outPath, JSON.stringify(results, null, 2));
        await new Promise(r => setTimeout(r, 1200));
      } catch (err) {
        console.log(` ✗ ${err.message.slice(0, 80)}`);
      }
    }
  }

  console.log(`  Done: +${generated} new, ${cached} cached, ${Object.keys(results).length} total\n`);
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const allTopics = parseTopics();
  const skipArg = process.argv.indexOf('--skip');
  const skipSubject = skipArg >= 0 ? process.argv[skipArg + 1] : null;
  const onlySubject = !skipSubject && process.argv[2] ? process.argv[2] : null;

  let subjects = Object.keys(allTopics);
  if (onlySubject) subjects = subjects.filter(s => s === onlySubject);
  if (skipSubject) subjects = subjects.filter(s => s !== skipSubject);

  console.log(`Generating summaries for ${subjects.length} subjects...\n`);

  for (const sid of subjects) {
    const topicCount = Object.keys(allTopics[sid]).length;
    console.log(`[${sid}] ${topicCount} topics`);
    await generateForSubject(sid, allTopics[sid]);
  }

  console.log('All done!');
}

main().catch(err => { console.error(err); process.exit(1); });
