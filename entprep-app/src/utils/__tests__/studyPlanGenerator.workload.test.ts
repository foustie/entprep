import { describe, it, expect } from 'vitest';
import { generateStudyPlan } from '../studyPlanGenerator';
import type { GenerateStudyPlanInput, StudyTask } from '../../types/index';

const BASE: GenerateStudyPlanInput = {
  examDate: '2026-09-01',
  target: 122,
  profileSubjects: ['physics', 'chemistry'],
  weakTopics: [{ id: 'math', score: 80 }],
  strongTopics: [{ id: 'history', score: 30 }],
  today: '2026-06-28',
  seed: 'workload-seed-1',
};

/** Count tasks (excluding AI tips, which the generator never emits) in week N (1-based). */
const weekTasks = (input: GenerateStudyPlanInput, weekNum = 1): StudyTask[] => {
  const plan = generateStudyPlan(input)!;
  return plan.weeks[weekNum - 1].tasks;
};

/** Group a week's tasks by ISO date. */
const byDay = (tasks: StudyTask[]): Record<string, StudyTask[]> => {
  const m: Record<string, StudyTask[]> = {};
  for (const t of tasks) (m[t.date] ||= []).push(t);
  return m;
};

describe('study plan workload density', () => {
  it('defaults to medium and records it on the plan', () => {
    const plan = generateStudyPlan(BASE)!;
    expect(plan.workload).toBe('medium');
  });

  it('denser workload yields strictly more tasks per week', () => {
    const light = weekTasks({ ...BASE, workload: 'light' }).length;
    const medium = weekTasks({ ...BASE, workload: 'medium' }).length;
    const intense = weekTasks({ ...BASE, workload: 'intense' }).length;
    expect(light).toBeLessThan(medium);
    expect(medium).toBeLessThan(intense);
    // light: Mon–Fri 2×5 + Sat 1 + Sun 1 + 1 challenge = 13
    expect(light).toBe(13);
    // medium: 4×5 + 2 + 2 + challenge = 25
    expect(medium).toBe(25);
    // intense: 6×5 + 3 + 3 + challenge = 37
    expect(intense).toBe(37);
  });

  it('places multiple tasks on a single weekday (the core "more per day" ask)', () => {
    const tasks = weekTasks({ ...BASE, workload: 'medium' });
    const monday = tasks[0].date; // week startDate = Monday
    expect(byDay(tasks)[monday].length).toBe(4);
  });

  it('keeps exactly one challenge per week, premium, on Sunday', () => {
    const plan = generateStudyPlan({ ...BASE, workload: 'medium' })!;
    const week = plan.weeks[0];
    const challenges = week.tasks.filter(t => t.type === 'challenge');
    expect(challenges).toHaveLength(1);
    expect(challenges[0].premium).toBe(true);
    expect(challenges[0].date).toBe(week.endDate); // Sunday
    expect(challenges[0].id).toBe('week_1_challenge');
  });

  it('puts the review-week fullent alone on Saturday (mock-exam day)', () => {
    const plan = generateStudyPlan({ ...BASE, workload: 'intense' })!;
    const review = plan.weeks.find(w => w.phase === 'review')!;
    const fullents = review.tasks.filter(t => t.type === 'fullent');
    expect(fullents).toHaveLength(1);
    const saturday = fullents[0].date;
    // Saturday holds nothing but the exam.
    expect(byDay(review.tasks)[saturday]).toHaveLength(1);
  });

  it('is deterministic for the same input + seed', () => {
    const a = generateStudyPlan({ ...BASE, workload: 'intense' });
    const b = generateStudyPlan({ ...BASE, workload: 'intense' });
    expect(a).toEqual(b);
  });

  it('marks every task in a premium week (week >= 3) as premium', () => {
    const plan = generateStudyPlan({ ...BASE, workload: 'light' })!;
    const wk3 = plan.weeks[2];
    expect(wk3.premium).toBe(true);
    expect(wk3.tasks.every(t => t.premium)).toBe(true);
  });
});
