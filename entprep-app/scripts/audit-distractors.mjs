#!/usr/bin/env node
/**
 * Distractor Quality Audit — statistical analysis (no API calls).
 *
 * Flags questions where the correct answer stands out from distractors,
 * making it guessable without subject knowledge.
 *
 * Checks:
 * 1. Length bias — correct answer is 2x+ longer than avg distractor
 * 2. Specificity bias — correct answer has more commas/detail markers
 * 3. Uniqueness bias — correct answer uses a different pattern than all distractors
 * 4. All-similar distractors — all wrong answers look alike but correct is different
 *
 * Usage:
 *   node scripts/audit-distractors.mjs                  # all subjects, summary
 *   node scripts/audit-distractors.mjs --subject=history # one subject
 *   node scripts/audit-distractors.mjs --examples        # show example questions
 *   node scripts/audit-distractors.mjs --export=ids      # export flagged question IDs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');

const SUBJECTS = [
  'math', 'reading', 'history', 'math_profile', 'physics', 'biology',
  'english', 'chemistry', 'geography', 'world_history', 'informatics',
  'law', 'literature',
];

const SUBJECT_NAMES = {
  math: 'Мат. грамотность', reading: 'Грамотность чтения', history: 'История КЗ',
  math_profile: 'Математика (проф)', physics: 'Физика', biology: 'Биология',
  english: 'Английский', chemistry: 'Химия', geography: 'География',
  world_history: 'Всемирная история', informatics: 'Информатика',
  law: 'Основы права', literature: 'Литература',
};

const args = process.argv.slice(2);
const subjectArg = args.find(a => a.startsWith('--subject='))?.split('=')[1];
const showExamples = args.includes('--examples');
const exportIds = args.includes('--export=ids');

// ── Analysis functions ──

function analyzeQuestion(q) {
  if (!q.o || !Array.isArray(q.o) || q.o.length < 3) return null;
  if (typeof q.c !== 'number' || q.c < 0 || q.c >= q.o.length) return null;
  // Skip multiple choice and matching
  if (Array.isArray(q.c) || q.pairs) return null;

  const correct = q.o[q.c];
  const distractors = q.o.filter((_, i) => i !== q.c);
  const issues = [];

  // 1. LENGTH BIAS — correct answer significantly longer
  const correctLen = correct.length;
  const avgDistLen = distractors.reduce((s, d) => s + d.length, 0) / distractors.length;
  const maxDistLen = Math.max(...distractors.map(d => d.length));

  if (correctLen > avgDistLen * 2.0 && correctLen > 20) {
    issues.push({
      type: 'length_bias',
      severity: correctLen > avgDistLen * 3 ? 'high' : 'medium',
      detail: `correct=${correctLen}ch, avg_dist=${Math.round(avgDistLen)}ch (${(correctLen / avgDistLen).toFixed(1)}x)`,
    });
  }

  // 2. CORRECT IS SHORTEST — sometimes the most concise answer stands out
  const minDistLen = Math.min(...distractors.map(d => d.length));
  if (correctLen < avgDistLen * 0.4 && avgDistLen > 20 && correctLen < 10) {
    issues.push({
      type: 'brevity_bias',
      severity: 'medium',
      detail: `correct=${correctLen}ch, avg_dist=${Math.round(avgDistLen)}ch`,
    });
  }

  // 3. SPECIFICITY BIAS — correct has more detail markers (commas, parentheses, numbers)
  const detailScore = (s) => {
    let score = 0;
    score += (s.match(/,/g) || []).length * 2;
    score += (s.match(/\(/g) || []).length * 3;
    score += (s.match(/\d/g) || []).length;
    score += (s.match(/[«»"]/g) || []).length * 2;
    return score;
  };
  const correctDetail = detailScore(correct);
  const avgDistDetail = distractors.reduce((s, d) => s + detailScore(d), 0) / distractors.length;

  if (correctDetail > avgDistDetail * 3 && correctDetail > 5) {
    issues.push({
      type: 'specificity_bias',
      severity: 'medium',
      detail: `correct_detail=${correctDetail}, avg_dist_detail=${Math.round(avgDistDetail)}`,
    });
  }

  // 4. FORMAT MISMATCH — correct uses different format than ALL distractors
  const startsWithNumber = (s) => /^\d/.test(s.trim());
  const startsWithCapital = (s) => /^[А-ЯA-Z]/.test(s.trim());
  const hasParentheses = (s) => /\(/.test(s);

  // Check if all distractors share a format but correct doesn't
  const distFormats = distractors.map(d => ({
    num: startsWithNumber(d),
    paren: hasParentheses(d),
  }));

  const allDistNum = distFormats.every(f => f.num);
  const noDistNum = distFormats.every(f => !f.num);
  if ((allDistNum && !startsWithNumber(correct)) || (noDistNum && startsWithNumber(correct))) {
    // Only flag if it's not a math subject where numbers are expected
    if (!['math', 'math_profile', 'physics', 'chemistry'].includes(q._topic)) {
      issues.push({
        type: 'format_mismatch',
        severity: 'low',
        detail: `correct ${startsWithNumber(correct) ? 'starts' : 'does not start'} with number, all distractors ${allDistNum ? 'do' : 'do not'}`,
      });
    }
  }

  // 5. ALL DISTRACTORS SIMILAR — distractors share words/structure but correct is unique
  const getWords = (s) => new Set(s.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3));
  const correctWords = getWords(correct);
  const distWordSets = distractors.map(getWords);

  // Find words shared by all distractors but not in correct
  if (distWordSets.length >= 3) {
    const sharedDistWords = [...distWordSets[0]].filter(w =>
      distWordSets.every(s => s.has(w)) && !correctWords.has(w)
    );
    if (sharedDistWords.length >= 2) {
      issues.push({
        type: 'cluster_outlier',
        severity: 'medium',
        detail: `distractors share: "${sharedDistWords.slice(0, 3).join(', ')}" — correct doesn't`,
      });
    }
  }

  return issues.length > 0 ? { q: q.q, o: q.o, c: q.c, oi: q._oi, issues } : null;
}

// ── Main ──

function auditSubject(sid) {
  const filePath = join(DATA_DIR, `${sid}.json`);
  if (!existsSync(filePath)) return null;

  const questions = JSON.parse(readFileSync(filePath, 'utf8'));
  const flagged = [];

  for (const q of questions) {
    const result = analyzeQuestion(q);
    if (result) flagged.push(result);
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  flagged.sort((a, b) => {
    const aMax = Math.min(...a.issues.map(i => severityOrder[i.severity] ?? 3));
    const bMax = Math.min(...b.issues.map(i => severityOrder[i.severity] ?? 3));
    return aMax - bMax;
  });

  return {
    subject: sid,
    total: questions.length,
    flagged: flagged.length,
    high: flagged.filter(f => f.issues.some(i => i.severity === 'high')).length,
    medium: flagged.filter(f => f.issues.some(i => i.severity === 'medium') && !f.issues.some(i => i.severity === 'high')).length,
    low: flagged.filter(f => f.issues.every(i => i.severity === 'low')).length,
    examples: flagged.slice(0, 5),
    allFlagged: flagged,
  };
}

console.log('ENTprep Distractor Quality Audit\n');

const subjects = subjectArg ? [subjectArg] : SUBJECTS;
const allResults = [];
let totalFlagged = 0;
let totalQuestions = 0;
const allFlaggedIds = [];

for (const sid of subjects) {
  const result = auditSubject(sid);
  if (!result) continue;
  allResults.push(result);
  totalFlagged += result.flagged;
  totalQuestions += result.total;

  const name = SUBJECT_NAMES[sid] || sid;
  const bar = '█'.repeat(Math.ceil(result.flagged / 10)) || '▏';
  console.log(`${name.padEnd(22)} ${String(result.total).padStart(5)} total | ${String(result.flagged).padStart(4)} flagged (${String(result.high).padStart(2)} high, ${String(result.medium).padStart(2)} med, ${String(result.low).padStart(2)} low) ${bar}`);

  if (showExamples && result.examples.length > 0) {
    for (const ex of result.examples.slice(0, 3)) {
      console.log(`  Q: ${ex.q.slice(0, 80)}...`);
      ex.o.forEach((o, i) => console.log(`    ${i === ex.c ? '✓' : ' '} ${String.fromCharCode(65 + i)}) ${o.slice(0, 60)}`));
      for (const issue of ex.issues) {
        console.log(`    ⚠ ${issue.type} [${issue.severity}]: ${issue.detail}`);
      }
      console.log();
    }
  }

  if (exportIds) {
    for (const f of result.allFlagged) {
      if (f.oi != null) allFlaggedIds.push({ subject: sid, oi: f.oi, issues: f.issues.map(i => i.type) });
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`TOTAL: ${totalQuestions} questions, ${totalFlagged} flagged (${(totalFlagged / totalQuestions * 100).toFixed(1)}%)`);
console.log(`${'─'.repeat(60)}`);

if (exportIds && allFlaggedIds.length > 0) {
  const outPath = join(__dirname, 'flagged-distractors.json');
  writeFileSync(outPath, JSON.stringify(allFlaggedIds, null, 2));
  console.log(`\nExported ${allFlaggedIds.length} flagged IDs to ${outPath}`);
}
