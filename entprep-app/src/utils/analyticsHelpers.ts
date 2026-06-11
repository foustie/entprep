// Pure computation helpers for the per-subject analytics block (SubjectAnalytics)
import type { TestResult } from '../types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface WeekActivity {
  /** Monday of the week (local midnight) */
  weekStart: Date;
  correct: number;
  wrong: number;
}

export interface DifficultyTimeEntry {
  count: number;
  totalSec: number;
  avgSec: number;
  /** Share of total time across all difficulties, 0..1 */
  share: number;
}

export interface TimeByDifficultyResult {
  easy: DifficultyTimeEntry;
  medium: DifficultyTimeEntry;
  hard: DifficultyTimeEntry;
  /** Total number of timed answers counted */
  samples: number;
  /** Average seconds per question across all difficulties */
  totalAvgSec: number;
}

/** Parse history date "DD.MM.YYYY" (toLocaleDateString ru-RU); falls back to Date.parse */
function parseDt(dt: string | undefined): Date | null {
  if (!dt) return null;
  const parts = dt.split('.');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 1970) return new Date(y, m - 1, d);
  }
  const t = Date.parse(dt);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Local midnight of the Monday of the week containing `d` */
function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (r.getDay() + 6) % 7; // Mon=0 … Sun=6
  r.setDate(r.getDate() - offset);
  return r;
}

/** Practice history for one subject: regular/rush/duel tests, full ENT excluded */
export function subjectPracticeHistory(hist: TestResult[], sid: string): TestResult[] {
  return hist.filter(r => r.su === sid && r.type !== 'fullent');
}

/**
 * Correct/wrong answer counts per week for the last `weeks` Monday-based weeks
 * (oldest first, current week last). Counts come from `qd` when present,
 * falling back to `co` / `to - co`.
 */
export function weeklyActivity(
  hist: TestResult[],
  sid: string,
  weeks: number = 10,
  now: Date = new Date(),
): WeekActivity[] {
  const currentMonday = mondayOf(now);
  const buckets: WeekActivity[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(currentMonday);
    ws.setDate(currentMonday.getDate() - i * 7);
    buckets.push({ weekStart: ws, correct: 0, wrong: 0 });
  }
  const firstMs = buckets[0].weekStart.getTime();
  const WEEK_MS = 7 * 86400000;

  for (const r of subjectPracticeHistory(hist, sid)) {
    const d = parseDt(r.dt);
    if (!d) continue;
    const idx = Math.round((mondayOf(d).getTime() - firstMs) / WEEK_MS);
    if (idx < 0 || idx >= buckets.length) continue;
    let correct = 0;
    let wrong = 0;
    if (r.qd && r.qd.length > 0) {
      for (const q of r.qd) {
        if (q.ok) correct++;
        else wrong++;
      }
    } else if (typeof r.co === 'number' && typeof r.to === 'number') {
      correct = r.co;
      wrong = Math.max(0, r.to - r.co);
    }
    buckets[idx].correct += correct;
    buckets[idx].wrong += wrong;
  }
  return buckets;
}

/**
 * Average answer time per difficulty for one subject. Only `qd` entries that
 * carry both `tms` (seconds) and `df` are counted; everything else is ignored.
 */
export function timeByDifficulty(hist: TestResult[], sid: string): TimeByDifficultyResult {
  const acc: Record<Difficulty, { count: number; totalSec: number }> = {
    easy: { count: 0, totalSec: 0 },
    medium: { count: 0, totalSec: 0 },
    hard: { count: 0, totalSec: 0 },
  };

  for (const r of subjectPracticeHistory(hist, sid)) {
    if (!r.qd) continue;
    for (const d of r.qd) {
      if (typeof d.tms !== 'number' || d.tms <= 0) continue;
      if (d.df !== 'easy' && d.df !== 'medium' && d.df !== 'hard') continue;
      acc[d.df].count++;
      acc[d.df].totalSec += d.tms;
    }
  }

  const samples = acc.easy.count + acc.medium.count + acc.hard.count;
  const grandTotal = acc.easy.totalSec + acc.medium.totalSec + acc.hard.totalSec;
  const entry = (k: Difficulty): DifficultyTimeEntry => ({
    count: acc[k].count,
    totalSec: acc[k].totalSec,
    avgSec: acc[k].count > 0 ? acc[k].totalSec / acc[k].count : 0,
    share: grandTotal > 0 ? acc[k].totalSec / grandTotal : 0,
  });

  return {
    easy: entry('easy'),
    medium: entry('medium'),
    hard: entry('hard'),
    samples,
    totalAvgSec: samples > 0 ? grandTotal / samples : 0,
  };
}
