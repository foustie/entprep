import { describe, it, expect } from 'vitest';
import {
  generateStudyPlan,
  dateAddDays,
  weeksBetween,
  clamp,
} from '../studyPlanGenerator';
import type { GenerateStudyPlanInput, StudyPlanTopicRef } from '../../types/index';

const TODAY = '2026-06-27';

const base = (over: Partial<GenerateStudyPlanInput> = {}): GenerateStudyPlanInput => ({
  examDate: dateAddDays(TODAY, 70), // 10 weeks
  target: 180,
  profileSubjects: ['math_profile', 'physics'],
  weakTopics: [],
  strongTopics: [],
  today: TODAY,
  seed: '2026-06-27T12:00:00.000Z',
  ...over,
});

const weak = (ids: string[]): StudyPlanTopicRef[] =>
  ids.map((id, i) => ({ id, score: 80 - i * 5 }));
const strong = (ids: string[]): StudyPlanTopicRef[] =>
  ids.map(id => ({ id, score: 30 }));

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(13, 2, 26)).toBe(13);
    expect(clamp(99, 2, 26)).toBe(26);
    expect(clamp(0, 2, 26)).toBe(2);
  });

  it('weeksBetween floors to whole weeks', () => {
    expect(weeksBetween('2026-06-27', '2026-09-27')).toBe(13); // 92 days
    expect(weeksBetween('2026-06-27', '2026-07-10')).toBe(1); // 13 days
    expect(weeksBetween('2026-06-27', '2026-06-27')).toBe(0); // same day
  });

  it('dateAddDays is UTC-stable', () => {
    expect(dateAddDays('2026-06-27', 7)).toBe('2026-07-04');
    expect(dateAddDays('2026-06-27', -1)).toBe('2026-06-26');
  });
});

// ── weeksCount from exam date ─────────────────────────────────────────────────

describe('weeksCount', () => {
  it('derives from exam date (92 days → 13 weeks)', () => {
    const plan = generateStudyPlan(base({ examDate: '2026-09-27' }))!;
    expect(plan.weeksCount).toBe(13);
    expect(plan.weeks).toHaveLength(13);
  });

  it('clamps far-future exam dates to 26', () => {
    const plan = generateStudyPlan(base({ examDate: '2028-12-31' }))!;
    expect(plan.weeksCount).toBe(26);
    expect(plan.weeks).toHaveLength(26);
  });

  it('clamps very short runway to a 2-week crash plan', () => {
    const plan = generateStudyPlan(base({ examDate: dateAddDays(TODAY, 13) }))!;
    expect(plan.weeksCount).toBe(2);
    expect(plan.weeks[0].phase).toBe('foundation');
    expect(plan.weeks[1].phase).toBe('review');
    // No build phase
    expect(plan.weeks.some(w => w.phase === 'build')).toBe(false);
  });

  it('exam date == today → minimum 2 weeks', () => {
    const plan = generateStudyPlan(base({ examDate: TODAY }))!;
    expect(plan.weeksCount).toBe(2);
  });
});

// ── Phase boundaries (40 / 40 / 20) ───────────────────────────────────────────

describe('phase boundaries', () => {
  it('10-week plan → foundation 1-4, build 5-8, review 9-10', () => {
    const plan = generateStudyPlan(base({ examDate: dateAddDays(TODAY, 70) }))!;
    expect(plan.weeksCount).toBe(10);
    const phases = plan.weeks.map(w => w.phase);
    expect(phases.slice(0, 4)).toEqual(['foundation', 'foundation', 'foundation', 'foundation']);
    expect(phases.slice(4, 8)).toEqual(['build', 'build', 'build', 'build']);
    expect(phases.slice(8, 10)).toEqual(['review', 'review']);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same inputs + seed → deep-equal output', () => {
    const input = base({ weakTopics: weak(['math', 'history']), strongTopics: strong(['reading']) });
    const a = generateStudyPlan(input);
    const b = generateStudyPlan(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seed → different plan', () => {
    const a = generateStudyPlan(base({ seed: '2026-06-27T12:00:00.000Z' }));
    const b = generateStudyPlan(base({ seed: '2026-06-27T12:00:01.000Z' }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('fuzz: 100 seeds all produce valid plans', () => {
    for (let i = 0; i < 100; i++) {
      const plan = generateStudyPlan(base({ seed: `seed-${i}` }))!;
      expect(plan).not.toBeNull();
      expect(plan.weeksCount).toBeGreaterThanOrEqual(2);
      expect(plan.weeksCount).toBeLessThanOrEqual(26);
      for (const w of plan.weeks) {
        expect(w.tasks.length).toBeGreaterThanOrEqual(4);
        expect(w.tasks.length).toBeLessThanOrEqual(6);
      }
    }
  });
});

// ── Premium flags ─────────────────────────────────────────────────────────────

describe('premium flags', () => {
  it('week >= 3 is premium', () => {
    const plan = generateStudyPlan(base({ examDate: dateAddDays(TODAY, 35) }))!; // 5 weeks
    expect(plan.weeks.map(w => w.premium)).toEqual([false, false, true, true, true]);
  });

  it('all challenge tasks are premium', () => {
    const plan = generateStudyPlan(base())!;
    for (const w of plan.weeks) {
      for (const t of w.tasks) {
        if (t.type === 'challenge') expect(t.premium).toBe(true);
      }
    }
  });

  it('week >= 3 → every task premium', () => {
    const plan = generateStudyPlan(base())!;
    for (const w of plan.weeks) {
      if (w.weekNum >= 3) {
        for (const t of w.tasks) expect(t.premium).toBe(true);
      }
    }
  });
});

// ── Task counts & spread ──────────────────────────────────────────────────────

describe('tasks', () => {
  it('exactly one challenge per week', () => {
    const plan = generateStudyPlan(base())!;
    for (const w of plan.weeks) {
      expect(w.tasks.filter(t => t.type === 'challenge')).toHaveLength(1);
    }
  });

  it('4-6 tasks spread across distinct weekdays (no overlapping dates)', () => {
    const plan = generateStudyPlan(base())!;
    for (const w of plan.weeks) {
      expect(w.tasks.length).toBeGreaterThanOrEqual(4);
      expect(w.tasks.length).toBeLessThanOrEqual(6);
      const dates = w.tasks.map(t => t.date);
      expect(new Set(dates).size).toBe(dates.length); // distinct
      // every task date falls within [startDate, endDate]
      for (const d of dates) {
        expect(d >= w.startDate && d <= w.endDate).toBe(true);
      }
      // tasks sorted ascending by date
      expect([...dates].sort()).toEqual(dates);
    }
  });

  it('no back-to-back same subject (when more than one subject in the week)', () => {
    const plan = generateStudyPlan(
      base({ weakTopics: weak(['math', 'history', 'physics']) }),
    )!;
    for (const w of plan.weeks) {
      const defined = w.tasks.filter(t => t.subject).map(t => t.subject!);
      if (new Set(defined).size > 1) {
        for (let i = 1; i < defined.length; i++) {
          expect(defined[i]).not.toBe(defined[i - 1]);
        }
      }
    }
  });

  it('task types per phase', () => {
    const plan = generateStudyPlan(
      base({ examDate: dateAddDays(TODAY, 70), weakTopics: weak(['math', 'history']), strongTopics: strong(['reading']) }),
    )!;
    const foundation = plan.weeks.filter(w => w.phase === 'foundation').flatMap(w => w.tasks);
    const build = plan.weeks.filter(w => w.phase === 'build').flatMap(w => w.tasks);
    const review = plan.weeks.filter(w => w.phase === 'review').flatMap(w => w.tasks);
    expect(foundation.some(t => t.type === 'lesson')).toBe(true);
    expect(foundation.some(t => t.type === 'practice')).toBe(true);
    expect(build.some(t => t.type === 'practice')).toBe(true);
    expect(review.some(t => t.type === 'fullent')).toBe(true);
    expect(review.some(t => t.type === 'review')).toBe(true);
    expect(review.some(t => t.type === 'challenge')).toBe(true);
  });

  it('stable task id format week_X_Y / week_X_challenge', () => {
    const plan = generateStudyPlan(base())!;
    for (const w of plan.weeks) {
      for (const t of w.tasks) {
        expect(t.id).toMatch(new RegExp(`^week_${w.weekNum}_(\\d+|challenge)$`));
      }
    }
  });
});

// ── Topic coverage ────────────────────────────────────────────────────────────

describe('topic coverage', () => {
  it('weak subjects drive foundation; strong subjects appear later', () => {
    const plan = generateStudyPlan(
      base({ examDate: dateAddDays(TODAY, 70), weakTopics: weak(['math', 'history']), strongTopics: strong(['reading']) }),
    )!;
    const foundationSubjects = new Set(
      plan.weeks.filter(w => w.phase === 'foundation').flatMap(w => w.tasks.map(t => t.subject)).filter(Boolean),
    );
    expect(foundationSubjects.has('math')).toBe(true);
    expect(foundationSubjects.has('history')).toBe(true);
    // strong subject excluded from foundation
    expect(foundationSubjects.has('reading')).toBe(false);
    // ... but appears in build/review
    const laterSubjects = new Set(
      plan.weeks.filter(w => w.phase !== 'foundation').flatMap(w => w.tasks.map(t => t.subject)).filter(Boolean),
    );
    expect(laterSubjects.has('reading')).toBe(true);
  });

  it('reading (no subtopics) → topic-less practice tasks', () => {
    const plan = generateStudyPlan(base({ weakTopics: weak(['reading']) }))!;
    const readingTasks = plan.weeks.flatMap(w => w.tasks).filter(t => t.subject === 'reading');
    expect(readingTasks.length).toBeGreaterThan(0);
    for (const t of readingTasks) expect(t.topic).toBeUndefined();
  });
});

// ── Cold start (no history) ───────────────────────────────────────────────────

describe('cold start (no weak/strong topics)', () => {
  it('week 1 contains a diagnostic fullent and foundation covers mandatory subjects', () => {
    const plan = generateStudyPlan(
      base({ examDate: dateAddDays(TODAY, 56), weakTopics: [], strongTopics: [] }),
    )!; // 8 weeks
    expect(plan.weeks[0].tasks.some(t => t.type === 'fullent')).toBe(true);

    const mandatory = ['math', 'reading', 'history'];
    const firstTwoFoundationSubjects = new Set(
      plan.weeks.slice(0, 2).flatMap(w => w.tasks)
        .filter(t => t.type === 'lesson' || t.type === 'practice')
        .map(t => t.subject),
    );
    // at least one mandatory subject covered in weeks 1-2
    expect(mandatory.some(m => firstTwoFoundationSubjects.has(m))).toBe(true);
  });
});

// ── Invalid input ─────────────────────────────────────────────────────────────

describe('invalid input', () => {
  it('examDate < today → null', () => {
    expect(generateStudyPlan(base({ examDate: dateAddDays(TODAY, -5) }))).toBeNull();
  });

  it('malformed exam date → null', () => {
    expect(generateStudyPlan(base({ examDate: 'invalid-date' }))).toBeNull();
  });

  it('malformed today → null', () => {
    expect(generateStudyPlan(base({ today: 'nope' }))).toBeNull();
  });
});
