import { describe, it, expect } from 'vitest';
import { toggleTaskDone, autoCompleteFromResult } from '../studyPlanStore';
import { mergeData } from '../cloudSync';
import type {
  PlanCompletion,
  Settings,
  StudyPlan,
  StudyPlanSnapshot,
  StudyTask,
  TestResult,
} from '../../types/index';

const NOW = '2026-06-27T10:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const task = (over: Partial<StudyTask> = {}): StudyTask => ({
  id: 'week_1_0',
  date: '2026-06-22',
  type: 'practice',
  subject: 'math',
  topic: 't1',
  title: 'practice:math:t1',
  durationMin: 5,
  premium: false,
  ...over,
});

const plan = (tasks: StudyTask[]): StudyPlan => ({
  id: 'p1',
  createdAt: '2026-06-20T00:00:00.000Z',
  examDate: '2026-09-01',
  target: 180,
  weeksCount: 1,
  weeks: [{ weekNum: 1, startDate: '2026-06-22', endDate: '2026-06-28', phase: 'foundation', premium: false, tasks }],
});

// History dt is `DD.MM.YYYY` in production (ru-RU toLocaleDateString).
const result = (over: Partial<TestResult> = {}): TestResult => ({
  id: 'r1',
  su: 'math',
  sc: 80,
  dt: '25.06.2026',
  tp: 't1',
  ...over,
});

// ── toggleTaskDone ──────────────────────────────────────────────────────────────

describe('toggleTaskDone', () => {
  it('false → true sets done + completedAt, without mutating input', () => {
    const before: PlanCompletion = {};
    const after = toggleTaskDone(before, 'week_1_0', NOW);
    expect(after.week_1_0).toEqual({ done: true, completedAt: NOW });
    expect(before).toEqual({}); // immutability
    expect(after).not.toBe(before);
  });

  it('true → false clears completedAt/resultId', () => {
    const before: PlanCompletion = { week_1_0: { done: true, completedAt: NOW, resultId: 'r1' } };
    const after = toggleTaskDone(before, 'week_1_0', NOW);
    expect(after.week_1_0).toEqual({ done: false });
  });

  it('leaves other tasks untouched', () => {
    const before: PlanCompletion = { other: { done: true, completedAt: NOW } };
    const after = toggleTaskDone(before, 'week_1_0', NOW);
    expect(after.other).toEqual({ done: true, completedAt: NOW });
    expect(after.week_1_0).toEqual({ done: true, completedAt: NOW });
  });
});

// ── autoCompleteFromResult ──────────────────────────────────────────────────────

describe('autoCompleteFromResult', () => {
  it('marks a matching practice task done (subject + topic + date) and stamps resultId', () => {
    const p = plan([task()]);
    const out = autoCompleteFromResult(p, {}, result(), NOW);
    expect(out.week_1_0).toEqual({ done: true, completedAt: NOW, resultId: 'r1' });
  });

  it('does not mutate the input completion', () => {
    const p = plan([task()]);
    const before: PlanCompletion = {};
    autoCompleteFromResult(p, before, result(), NOW);
    expect(before).toEqual({});
  });

  it('is idempotent — same result never marks a second task', () => {
    const p = plan([task({ id: 'a', date: '2026-06-22' }), task({ id: 'b', date: '2026-06-23' })]);
    const once = autoCompleteFromResult(p, {}, result(), NOW);
    expect(once.a?.done).toBe(true);
    expect(once.b).toBeUndefined();
    // Re-running with the SAME result id changes nothing (returns same ref).
    const twice = autoCompleteFromResult(p, once, result(), NOW);
    expect(twice).toBe(once);
    expect(twice.b).toBeUndefined();
  });

  it('a DIFFERENT result marks the next earliest pending matching task', () => {
    const p = plan([task({ id: 'a', date: '2026-06-22' }), task({ id: 'b', date: '2026-06-23' })]);
    const first = autoCompleteFromResult(p, {}, result({ id: 'r1' }), NOW);
    const second = autoCompleteFromResult(p, first, result({ id: 'r2' }), NOW);
    expect(second.a?.resultId).toBe('r1');
    expect(second.b?.resultId).toBe('r2');
  });

  it('skips already-done tasks and matches the next pending one', () => {
    const p = plan([task({ id: 'a' }), task({ id: 'b', date: '2026-06-23' })]);
    const pre: PlanCompletion = { a: { done: true, completedAt: NOW, resultId: 'prev' } };
    const out = autoCompleteFromResult(p, pre, result({ id: 'r9' }), NOW);
    expect(out.b?.resultId).toBe('r9');
  });

  it('topic-less subject (reading) matches on subject alone', () => {
    const p = plan([task({ id: 'rd', subject: 'reading', topic: undefined })]);
    const out = autoCompleteFromResult(p, {}, result({ su: 'reading', tp: undefined }), NOW);
    expect(out.rd?.done).toBe(true);
  });

  it('no match (wrong subject) → returns the SAME completion reference', () => {
    const p = plan([task()]);
    const before: PlanCompletion = {};
    const out = autoCompleteFromResult(p, before, result({ su: 'physics' }), NOW);
    expect(out).toBe(before);
  });

  it('does not match a task dated AFTER the result', () => {
    const p = plan([task({ date: '2026-06-30' })]); // after result dt 25.06
    const before: PlanCompletion = {};
    const out = autoCompleteFromResult(p, before, result(), NOW);
    expect(out).toBe(before);
  });

  it('does not match when topic differs', () => {
    const p = plan([task({ topic: 't1' })]);
    const before: PlanCompletion = {};
    const out = autoCompleteFromResult(p, before, result({ tp: 't2' }), NOW);
    expect(out).toBe(before);
  });

  it('ignores lesson/review/challenge task types', () => {
    const p = plan([task({ id: 'l', type: 'lesson' }), task({ id: 'rv', type: 'review' })]);
    const before: PlanCompletion = {};
    const out = autoCompleteFromResult(p, before, result(), NOW);
    expect(out).toBe(before);
  });
});

// ── mergeData — plan last-write-wins (NOT array dedup) ────────────────────────────

describe('mergeData — plan snapshot last-write-wins', () => {
  const ST: Settings = { exp: true, tmr: true, shf: true };
  const snap = (updatedAt: string, planId: string): StudyPlanSnapshot => ({
    plan: { ...plan([task()]), id: planId },
    completion: {},
    updatedAt,
  });
  const cd = (planSnap?: StudyPlanSnapshot) => ({ hist: [] as TestResult[], prof: [] as string[], st: ST, srCards: [], plan: planSnap });

  it('cloud newer (updatedAt) → cloud plan wins', () => {
    const local = cd(snap('2026-06-25T00:00:00.000Z', 'local'));
    const cloud = cd(snap('2026-06-26T00:00:00.000Z', 'cloud'));
    expect(mergeData(local, cloud).plan?.plan.id).toBe('cloud');
  });

  it('local newer (updatedAt) → local plan wins', () => {
    const local = cd(snap('2026-06-26T00:00:00.000Z', 'local'));
    const cloud = cd(snap('2026-06-25T00:00:00.000Z', 'cloud'));
    expect(mergeData(local, cloud).plan?.plan.id).toBe('local');
  });

  it('equal updatedAt → cloud wins (tie-break)', () => {
    const t = '2026-06-26T00:00:00.000Z';
    const local = cd(snap(t, 'local'));
    const cloud = cd(snap(t, 'cloud'));
    expect(mergeData(local, cloud).plan?.plan.id).toBe('cloud');
  });

  it('only one side has a plan → that plan is kept', () => {
    const withPlan = cd(snap('2026-06-26T00:00:00.000Z', 'only'));
    const without = cd(undefined);
    expect(mergeData(without, withPlan).plan?.plan.id).toBe('only');
    expect(mergeData(withPlan, without).plan?.plan.id).toBe('only');
  });

  it('neither side has a plan → undefined', () => {
    expect(mergeData(cd(undefined), cd(undefined)).plan).toBeUndefined();
  });
});
