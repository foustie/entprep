import type {
  PlanCompletion,
  StudyPlan,
  StudyPlanSnapshot,
  StudyTask,
  TestResult,
} from '../types/index';
import { loadData, saveData } from './storage';

/**
 * Study-plan persistence + progress helpers.
 *
 * The snapshot ({ plan, completion, updatedAt }) is embedded in the existing
 * `entprep_data` localStorage UserData and in the synced `user_data` row — it
 * reuses the load/save/merge + new-device safety already built for hist/srCards.
 *
 * `toggleTaskDone` and `autoCompleteFromResult` are PURE: no Date.now(), no
 * mutation of their inputs — they return a NEW PlanCompletion (or the same
 * reference when nothing changes, so callers can skip a needless write/sync).
 */

const DEFAULT_ST = { exp: true, tmr: true, shf: true } as const;

/** Normalize a date to a `yyyy-mm-dd` day string (lexicographically comparable).
 *  Handles BOTH the history format `DD.MM.YYYY` (ru-RU `toLocaleDateString`, used by
 *  TestResult.dt) and ISO `yyyy-mm-dd[...]` (used by StudyTask.date). Returns '' for
 *  missing/invalid input. */
function isoDay(d?: string): string {
  if (!d || typeof d !== 'string') return '';
  const dmy = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const day = d.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}

// ── localStorage cache (embedded in entprep_data UserData) ────────────────────

/** Read the study-plan snapshot from the embedded entprep_data UserData. */
export function loadPlanSnapshot(): StudyPlanSnapshot | null {
  return loadData()?.plan ?? null;
}

/** Persist the snapshot into entprep_data WITHOUT clobbering hist/prof/st/srCards.
 *  Pass null to clear the plan. */
export function savePlanSnapshot(snapshot: StudyPlanSnapshot | null): boolean {
  const cur = loadData();
  return saveData({
    hist: cur?.hist || [],
    prof: cur?.prof || [],
    st: cur?.st || { ...DEFAULT_ST },
    srCards: cur?.srCards || [],
    lastLogin: cur?.lastLogin,
    plan: snapshot ?? undefined,
  });
}

// ── Pure progress helpers ─────────────────────────────────────────────────────

/** Flip a task's done flag. Returns a NEW PlanCompletion; never mutates input.
 *  false → true stamps completedAt=now; true → false clears completedAt/resultId. */
export function toggleTaskDone(
  completion: PlanCompletion,
  taskId: string,
  now: string,
): PlanCompletion {
  const nextDone = !completion[taskId]?.done;
  return {
    ...completion,
    [taskId]: nextDone ? { done: true, completedAt: now } : { done: false },
  };
}

/**
 * Mark the earliest pending `practice`/`fullent` task that this test result
 * satisfies as done, stamping `resultId` so the SAME result can never
 * double-mark. Pure + idempotent: returns the SAME `completion` reference when
 * nothing changes.
 *
 * Match rule (all must hold):
 *   1. task.subject === result.su
 *   2. task.topic === result.tp  (only when task.topic is defined; topic-less
 *      subjects like reading match on subject alone)
 *   3. task.date <= result.dt (by yyyy-mm-dd day)
 *   4. task not already done
 */
export function autoCompleteFromResult(
  plan: StudyPlan,
  completion: PlanCompletion,
  result: TestResult,
  now: string,
): PlanCompletion {
  const resultDay = isoDay(result.dt);
  if (!resultDay || !result.su) return completion;

  // Flatten practice/fullent tasks, earliest date first (earliest pending wins).
  const candidates: StudyTask[] = [];
  for (const week of plan.weeks) {
    for (const task of week.tasks) {
      if (task.type === 'practice' || task.type === 'fullent') candidates.push(task);
    }
  }
  candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const task of candidates) {
    const c = completion[task.id];
    if (c?.done) {
      // This exact result already marked a task → don't let it mark a second one.
      if (result.id && c.resultId === result.id) return completion;
      continue;
    }
    if (task.subject !== result.su) continue;
    if (task.topic != null && task.topic !== result.tp) continue;
    if (isoDay(task.date) > resultDay) continue;
    return {
      ...completion,
      [task.id]: { done: true, completedAt: now, resultId: result.id },
    };
  }
  return completion;
}
