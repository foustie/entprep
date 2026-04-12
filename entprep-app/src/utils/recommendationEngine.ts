import type { TestResult } from '../types';
import { SUBJECT_META } from '../config/subjects';
import { TOPIC_MAP } from '../config/topics';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Recommendation {
  type: 'weak_subject' | 'weak_topic' | 'not_practiced' | 'error_review' | 'full_ent' | 'first_test';
  subject?: string;
  topic?: string;
  topicName?: string;
  score?: number;
  message: string;
  priority: number;
}

export interface DailyPlan {
  tasks: Array<{
    type: 'weak_topic' | 'error_review' | 'full_ent' | 'practice';
    subject?: string;
    topic?: string;
    label: string;
    estimate?: string;
    completed: boolean;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const subName = (id: string): string => SUBJECT_META[id]?.name ?? id;

const daysBetween = (a: string, b: string): number =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

const today = (): string => new Date().toISOString().slice(0, 10);

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function topicName(subjectId: string, topicId: string): string {
  const topics = TOPIC_MAP[subjectId];
  if (!topics) return topicId;
  for (const t of topics) {
    if (t.id === topicId) return t.name;
    if (t.subtopics) {
      const st = t.subtopics.find(s => s.id === topicId);
      if (st) return st.name;
    }
  }
  return topicId;
}

/** Last N tests for a subject, sorted newest first */
function lastNTests(hist: TestResult[], sid: string, n: number): TestResult[] {
  return hist
    .filter(t => t.su === sid && t.type !== 'fullent')
    .sort((a, b) => b.dt.localeCompare(a.dt))
    .slice(0, n);
}

function avgScore(tests: TestResult[]): number {
  if (!tests.length) return -1;
  return tests.reduce((s, t) => s + t.sc, 0) / tests.length;
}

/** Returns topic error rates: { topicId: errorRate } for a subject */
function topicErrors(hist: TestResult[], sid: string): Map<string, { errors: number; total: number }> {
  const map = new Map<string, { errors: number; total: number }>();
  for (const t of hist) {
    if (t.su !== sid || !t.qd) continue;
    for (const q of t.qd) {
      const tp = q.tp;
      if (!tp) continue;
      const entry = map.get(tp) ?? { errors: 0, total: 0 };
      entry.total++;
      if (!q.ok) entry.errors++;
      map.set(tp, entry);
    }
  }
  return map;
}

function yesterdayErrors(hist: TestResult[]): number {
  const yd = yesterday();
  let count = 0;
  for (const t of hist) {
    if (!t.dt.startsWith(yd) || !t.qd) continue;
    count += t.qd.filter(q => !q.ok).length;
  }
  return count;
}

// ── Main Functions ───────────────────────────────────────────────────────────

export function getRecommendation(hist: TestResult[], profileSubjects: string[]): Recommendation {
  if (!hist.length) {
    return { type: 'first_test', message: 'Начни с пробного теста чтобы найти слабые места', priority: 10 };
  }

  const now = today();
  let best: Recommendation | null = null;
  const pick = (r: Recommendation) => { if (!best || r.priority > best.priority) best = r; };

  // Check each subject
  for (const sid of profileSubjects) {
    const recent = lastNTests(hist, sid, 3);
    const avg = avgScore(recent);
    const lastDate = recent[0]?.dt.slice(0, 10);
    const daysSince = lastDate ? daysBetween(lastDate, now) : 999;

    // a. Weak subject (avg < 50%)
    if (avg >= 0 && avg < 50) {
      const rounded = Math.round(avg);
      pick({ type: 'weak_subject', subject: sid, score: rounded, message: `${subName(sid)}`, priority: 9 });
    }

    // b. Weak topic (error rate > 60%)
    const te = topicErrors(hist, sid);
    for (const [tp, { errors, total }] of te) {
      if (total < 3) continue; // need enough data
      const rate = (errors / total) * 100;
      if (rate > 60) {
        const tName = topicName(sid, tp);
        const rounded = Math.round(100 - rate);
        pick({ type: 'weak_topic', subject: sid, topic: tp, topicName: tName, score: rounded, message: `${subName(sid)} · ${tName}`, priority: 8 });
      }
    }

    // c. Not practiced > 3 days
    if (daysSince > 3 && avg >= 0) {
      pick({ type: 'not_practiced', subject: sid, message: `${subName(sid)} — давно не решал`, priority: 6 });
    }
  }

  // d. Yesterday errors
  const ydErrors = yesterdayErrors(hist);
  if (ydErrors > 0) {
    pick({ type: 'error_review', score: ydErrors, message: `Разбери ${ydErrors} ошибок из вчера`, priority: 7 });
  }

  // e. Never done Full ENT
  if (!hist.some(t => t.type === 'fullent')) {
    pick({ type: 'full_ent', message: 'Попробуй полный пробник ЕНТ', priority: 5 });
  }

  // f. Default: lowest scoring subject
  if (!best) {
    let lowest = { sid: profileSubjects[0], avg: 100 };
    for (const sid of profileSubjects) {
      const a = avgScore(lastNTests(hist, sid, 3));
      if (a >= 0 && a < lowest.avg) lowest = { sid, avg: a };
    }
    const rounded = Math.round(lowest.avg);
    best = { type: 'weak_subject', subject: lowest.sid, score: rounded, message: `${subName(lowest.sid)}`, priority: 4 };
  }

  return best;
}

export function getDailyPlan(hist: TestResult[], profileSubjects: string[]): DailyPlan {
  const tasks: DailyPlan['tasks'] = [];
  const rec = getRecommendation(hist, profileSubjects);

  // 1. Practice weak area
  if (rec.type !== 'first_test') {
    const sid = rec.subject ?? profileSubjects[0];
    tasks.push({
      type: rec.topic ? 'weak_topic' : 'practice',
      subject: sid,
      topic: rec.topic,
      label: `10 вопросов по ${subName(sid)}`,
      estimate: '~8 мин',
      completed: false,
    });
  }

  // 2. Yesterday errors
  const ydErrors = yesterdayErrors(hist);
  if (ydErrors > 0) {
    tasks.push({ type: 'error_review', label: `Разбор ${ydErrors} ошибок`, estimate: '~5 мин', completed: false });
  }

  // 3. Full ENT suggestion
  if (hist.length > 0 && !hist.some(t => t.type === 'fullent')) {
    tasks.push({ type: 'full_ent', label: 'Попробуй Full ЕНТ', estimate: '~4 часа', completed: false });
  }

  // 4. If everything is fine, suggest a duel
  if (!tasks.length) {
    tasks.push({ type: 'practice', label: 'Дуэль с другом', estimate: '~3 мин', completed: false });
  }

  return { tasks };
}

export function getLastResult(hist: TestResult[]): { subject: string; score: number; date: string; trend: number } | null {
  if (!hist.length) return null;

  const sorted = [...hist].sort((a, b) => b.dt.localeCompare(a.dt));
  const last = sorted[0];
  const prev = sorted.find(t => t.su === last.su && t.dt !== last.dt);
  const trend = prev ? last.sc - prev.sc : 0;

  return { subject: last.su, score: last.sc, date: last.dt, trend };
}

/** Context-aware CTA copy — replaces generic "Начать" with specific action */
export function getContextualCTA(rec: Recommendation): string {
  switch (rec.type) {
    case 'weak_subject':
      return `10 вопросов по ${subName(rec.subject || '').toLowerCase()}`;
    case 'weak_topic':
      return rec.topicName ? `Разобрать тему` : '10 вопросов';
    case 'error_review':
      return rec.score != null ? `Разобрать ${rec.score} ошибок` : 'Разобрать ошибки';
    case 'not_practiced':
      return `Вернуться к ${subName(rec.subject || '').toLowerCase()}`;
    case 'full_ent':
      return 'Пробник на 4 часа';
    case 'first_test':
      return 'Первый тест — 10 вопросов';
    default:
      return 'Начать';
  }
}

/** Andy's speech — what he SAYS to the user in first person. This IS the interface. */
export function getAndySpeech(rec: Recommendation, streak: number, hour: number = new Date().getHours()): string {
  // Night
  if (hour >= 23 || hour < 5) return 'Уже поздно. Отдохни, завтра продолжим';

  // Streak celebrations
  if (streak >= 30) return `${streak} дней подряд! Ты легенда`;
  if (streak >= 7) return `${streak} дней подряд! Не останавливайся`;

  switch (rec.type) {
    case 'first_test':
      return 'Привет! Давай узнаем твой уровень?';
    case 'weak_subject': {
      const name = subName(rec.subject || '');
      if (rec.score != null && rec.score < 30) return `${name} — ${rec.score}%. Разберёмся вместе`;
      if (rec.score != null) return `${name} — ${rec.score}%. Подтянем?`;
      return `Давай позанимаемся ${name.toLowerCase()}`;
    }
    case 'weak_topic': {
      const tName = rec.topicName || 'эту тему';
      return `${tName} — слабое место. Разберём?`;
    }
    case 'error_review':
      return rec.score != null
        ? `У тебя ${rec.score} ошибок. Давай разберём`
        : 'Есть ошибки. Давай разберём';
    case 'not_practiced':
      return `Давно не решал ${subName(rec.subject || '').toLowerCase()}. Вернёмся?`;
    case 'full_ent':
      return 'Готов к пробнику? Я буду рядом';
    default:
      return 'Готов заниматься?';
  }
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро!';
  if (h >= 12 && h < 18) return 'Добрый день!';
  return 'Добрый вечер!';
}
