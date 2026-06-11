// Helpers for building QuestionDetail (qd) entries with per-question
// answer time (tms, seconds) and difficulty (df) for analytics.
import type { Question, QuestionDetail, AnswerValue } from '../types';
import { scoreQuestion } from './scoringEngine';

/** Max recorded per-question time, seconds (outliers / abandoned tabs). */
export const QD_TIME_CAP = 600;

/** Clamp a per-question time to a whole number of seconds in [0, QD_TIME_CAP]. */
export function clampQdTime(seconds: number): number {
  if (Number.isNaN(seconds)) return 0;
  return Math.min(QD_TIME_CAP, Math.max(0, Math.round(seconds)));
}

/** Difficulty of a question at answer time (defaults to 'medium'). */
export function qdDifficulty(q: Question): 'easy' | 'medium' | 'hard' {
  return q.difficulty || 'medium';
}

/**
 * Build the qd array for a TestResult.
 * `times` maps question index → seconds spent answering (omitted entries stay undefined).
 */
export function buildQd(
  qs: Question[],
  ans: Record<number, AnswerValue>,
  times?: Record<number, number>,
): QuestionDetail[] {
  return qs.map((q, i) => ({
    oi: q._oi!,
    ok: ans[i] !== undefined && scoreQuestion(q, ans[i]).correct,
    tp: q._topic,
    stp: q._subtopic,
    picked: ans[i] ?? null,
    tms: times?.[i] !== undefined ? clampQdTime(times[i]) : undefined,
    df: qdDifficulty(q),
  }));
}
