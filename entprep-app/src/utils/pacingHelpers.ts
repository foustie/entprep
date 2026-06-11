// Pacing vs platform: submit per-question answer times and fetch anonymous
// platform aggregates (per subject × difficulty) from /api/pacing.
// Pure functions (sample extraction, band math) are kept separate from the
// network functions so tests don't need to mock fetch.
import type { TestResult } from '../types';
import { API_BASE } from '../config/app';
import { supabase } from '../config/supabase';

export type PacingDifficulty = 'easy' | 'medium' | 'hard';

export interface PacingSample {
  df: PacingDifficulty;
  tms: number;
}

export interface SubjectSamples {
  subject: string;
  samples: PacingSample[];
}

export interface PacingDiffStat {
  n: number;
  mean: number;
  sd: number;
}

export interface PacingStats {
  easy: PacingDiffStat;
  medium: PacingDiffStat;
  hard: PacingDiffStat;
}

/** Server caps samples per POST; trim client-side to avoid rejections. */
export const MAX_SAMPLES_PER_POST = 200;
/** Minimum platform sample count before we show the band (no fake data). */
export const MIN_PLATFORM_N = 30;
const MAX_TMS = 600;

const DIFFICULTIES = new Set<PacingDifficulty>(['easy', 'medium', 'hard']);

function isValidSample(tms: unknown, df: unknown): df is PacingDifficulty {
  return (
    typeof tms === 'number' && Number.isInteger(tms) && tms >= 1 && tms <= MAX_TMS &&
    typeof df === 'string' && DIFFICULTIES.has(df as PacingDifficulty)
  );
}

/**
 * Extract pacing samples from a finished test result, grouped by subject.
 * Regular/rush/duel runs yield at most one group (result.su); full ENT runs
 * group qd entries by their per-entry `su` (one group per exam subject).
 * Entries missing `tms` or `df` are skipped.
 */
export function extractPacingSamples(result: TestResult): SubjectSamples[] {
  if (!result.qd || result.qd.length === 0) return [];
  const groups = new Map<string, PacingSample[]>();
  const isFullEnt = result.type === 'fullent';

  for (const d of result.qd) {
    if (!isValidSample(d.tms, d.df)) continue;
    const subject = isFullEnt ? d.su || d._su : result.su;
    if (!subject) continue;
    const list = groups.get(subject) || [];
    if (list.length >= MAX_SAMPLES_PER_POST) continue;
    list.push({ df: d.df as PacingDifficulty, tms: d.tms as number });
    groups.set(subject, list);
  }

  return Array.from(groups, ([subject, samples]) => ({ subject, samples }));
}

/** mean/sd from running sums: sd = sqrt(max(0, sum_sq/n - mean^2)). */
export function statsFromSums(n: number, sumSec: number, sumSq: number): PacingDiffStat {
  if (!(n > 0)) return { n: 0, mean: 0, sd: 0 };
  const mean = sumSec / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return { n, mean, sd };
}

/**
 * Display band (mean ± sd), rounded to whole seconds and clamped to >= 1s.
 * Returns null when the platform has fewer than MIN_PLATFORM_N samples.
 */
export function pacingBand(stat: PacingDiffStat | undefined): { lo: number; hi: number } | null {
  if (!stat || stat.n < MIN_PLATFORM_N) return null;
  const lo = Math.max(1, Math.round(stat.mean - stat.sd));
  const hi = Math.max(lo, Math.round(stat.mean + stat.sd));
  return { lo, hi };
}

// ── Network ──────────────────────────────────────────────────────────────────

/** Fire-and-forget: submit timed qd samples after a finished run. */
export async function submitPacing(result: TestResult): Promise<void> {
  if (!supabase) return;
  try {
    const groups = extractPacingSamples(result);
    if (groups.length === 0) return;
    const session = await supabase.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) return;
    await Promise.all(
      groups.map(g =>
        fetch(`${API_BASE}/api/pacing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject: g.subject, samples: g.samples }),
        }).catch(() => undefined),
      ),
    );
  } catch { /* silently fail — analytics is best-effort */ }
}

// In-memory per-session cache: subject → stats (or null after a failed fetch)
const pacingCache = new Map<string, PacingStats | null>();

/** Fetch platform pacing stats for a subject; cached per session, null on error. */
export async function fetchPacing(subject: string): Promise<PacingStats | null> {
  if (pacingCache.has(subject)) return pacingCache.get(subject) ?? null;
  try {
    const res = await fetch(`${API_BASE}/api/pacing?subject=${encodeURIComponent(subject)}`);
    if (!res.ok) {
      pacingCache.set(subject, null);
      return null;
    }
    const data = (await res.json()) as PacingStats;
    pacingCache.set(subject, data);
    return data;
  } catch {
    pacingCache.set(subject, null);
    return null;
  }
}
