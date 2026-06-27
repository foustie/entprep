// Phase 3 study-plan week-view UI (Adaptive.tsx). Covers: empty/create CTA,
// week navigation + boundaries, checkbox toggle, deep-link Start, PRO gating by
// LIVE isPremium, and ru/kk locale-key presence.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ru from '../../locales/ru';
import kk from '../../locales/kk';
import { generateStudyPlan } from '../../utils/studyPlanGenerator';
import type { StudyPlanSnapshot } from '../../types/index';

const h = vi.hoisted(() => ({
  premium: false,
  user: { id: 'u1' } as { id: string } | null,
  totalTests: 5,
  lang: 'ru' as 'ru' | 'kk',
  t: null as unknown,
  snapshot: null as StudyPlanSnapshot | null,
  goal: { date: '', target: 130 } as { date: string; target: number } | undefined,
  setPlanSnapshot: vi.fn(),
  nav: vi.fn(),
  openPaywall: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../locales', () => ({ useT: () => h.t }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ hist: [], prof: ['physics'], st: { lang: h.lang, goal: h.goal }, plan: h.snapshot, setPlanSnapshot: h.setPlanSnapshot }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user, isPremium: h.premium }) }));
vi.mock('../../contexts/NavigationContext', () => ({ useNav: () => ({ nav: h.nav, openPaywall: h.openPaywall }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));
vi.mock('../../hooks/useBreakpoint', () => ({ useBreakpoint: () => 'mobile' }));
vi.mock('../../utils/analytics', () => ({ trackEvent: h.trackEvent }));
vi.mock('../../utils/adaptiveHelpers', () => ({
  getRecommendations: () => ({ weak: [], strong: [], overall: 50, totalTests: h.totalTests }),
  calcTopicStats: () => null,
  calcSubtopicStats: () => null,
  getWrongQuestions: () => [],
}));
vi.mock('../ui/SubjectIcon', () => ({ default: () => null }));
vi.mock('../ui/EmptyState', () => ({ default: () => null }));

import Adaptive from '../Adaptive';

function makeSnapshot(weeksAhead: number): StudyPlanSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  const exam = new Date(Date.now() + weeksAhead * 7 * 86400000).toISOString().slice(0, 10);
  const plan = generateStudyPlan({
    examDate: exam,
    target: 130,
    profileSubjects: ['physics'],
    weakTopics: [{ id: 'math', topic: 'quantitative_reasoning', score: 60 }],
    strongTopics: [],
    today,
    seed: 'fixed-test-seed',
  })!;
  return { plan, completion: {}, updatedAt: today };
}

beforeEach(() => {
  cleanup();
  h.premium = false;
  h.user = { id: 'u1' };
  h.totalTests = 5;
  h.lang = 'ru';
  h.t = ru;
  h.snapshot = null;
  h.goal = { date: new Date(Date.now() + 8 * 7 * 86400000).toISOString().slice(0, 10), target: 130 };
  h.setPlanSnapshot.mockClear();
  h.nav.mockClear();
  h.openPaywall.mockClear();
  h.trackEvent.mockClear();
});

describe('Adaptive study plan — empty state', () => {
  it('shows the Create Plan CTA when no plan exists', () => {
    render(<Adaptive />);
    expect(screen.getByText(ru.study_plan.createPlan)).toBeInTheDocument();
    expect(screen.getByText(ru.study_plan.empty)).toBeInTheDocument();
  });

  it('clicking Create opens the workload picker; choosing a level generates the plan', () => {
    render(<Adaptive />);
    fireEvent.click(screen.getByText(ru.study_plan.createPlan));
    // workload survey is now open — choosing a level is what generates the plan
    fireEvent.click(screen.getByText(ru.study_plan.workload.medium.label));
    expect(h.setPlanSnapshot).toHaveBeenCalledTimes(1);
    const snap = h.setPlanSnapshot.mock.calls[0][0];
    expect(snap.plan.weeks.length).toBeGreaterThan(0);
    expect(snap.plan.workload).toBe('medium');
    expect(h.trackEvent).toHaveBeenCalledWith('Study Plan Created', expect.objectContaining({ weeks: snap.plan.weeksCount }));
  });

  it('keeps the plan VISIBLE with no test history (totalTests=0) — visible to all', () => {
    h.totalTests = 0;
    render(<Adaptive />);
    expect(screen.getByText(ru.study_plan.createPlan)).toBeInTheDocument();
  });

  it('gates creation on login — a logged-out click does not create a plan', () => {
    h.user = null;
    render(<Adaptive />);
    fireEvent.click(screen.getByText(ru.study_plan.createPlan));
    expect(h.setPlanSnapshot).not.toHaveBeenCalled();
  });
});

describe('Adaptive study plan — week navigation', () => {
  it('disables prev on week 1, enables next', () => {
    h.snapshot = makeSnapshot(2);
    render(<Adaptive />);
    const navBtns = screen.getAllByLabelText(ru.study_plan.weekLabel);
    expect(navBtns[0]).toBeDisabled(); // prev
    expect(navBtns[1]).not.toBeDisabled(); // next
  });

  it('next advances the week and disables at the final week', () => {
    h.snapshot = makeSnapshot(2); // 2-week plan: week1 -> week2 is the last
    render(<Adaptive />);
    expect(screen.getByText(`${ru.study_plan.weekLabel} 1 ${ru.study_plan.weekOf} 2`)).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(ru.study_plan.weekLabel)[1]);
    expect(screen.getByText(`${ru.study_plan.weekLabel} 2 ${ru.study_plan.weekOf} 2`)).toBeInTheDocument();
    expect(screen.getAllByLabelText(ru.study_plan.weekLabel)[1]).toBeDisabled();
  });
});

describe('Adaptive study plan — checkbox toggle', () => {
  it('toggling a task checkbox flips completion and persists', () => {
    h.snapshot = makeSnapshot(8);
    render(<Adaptive />);
    const boxes = screen.getAllByLabelText(ru.study_plan.done);
    fireEvent.click(boxes[0]);
    expect(h.setPlanSnapshot).toHaveBeenCalledTimes(1);
    const snap = h.setPlanSnapshot.mock.calls[0][0];
    const doneIds = Object.keys(snap.completion).filter((id: string) => snap.completion[id].done);
    expect(doneIds.length).toBe(1);
  });
});

describe('Adaptive study plan — deep links', () => {
  it('clicking a Start button navigates', () => {
    h.snapshot = makeSnapshot(8);
    render(<Adaptive />);
    const starts = screen.getAllByText(ru.study_plan.start);
    expect(starts.length).toBeGreaterThan(0);
    fireEvent.click(starts[0]);
    expect(h.nav).toHaveBeenCalled();
  });
});

describe('Adaptive study plan — PRO gating by LIVE isPremium', () => {
  it('free user: challenge is locked on week 1 (challenge CTA shown)', () => {
    h.premium = false;
    h.snapshot = makeSnapshot(8);
    render(<Adaptive />);
    expect(screen.getByText(ru.study_plan.proLock.challenge)).toBeInTheDocument();
  });

  it('premium user: week 1 has no lock CTA', () => {
    h.premium = true;
    h.snapshot = makeSnapshot(8);
    render(<Adaptive />);
    expect(screen.queryByText(ru.study_plan.proLock.challenge)).toBeNull();
    expect(screen.queryByText(ru.study_plan.proLock.week3Plus)).toBeNull();
  });

  it('free user: week 3+ shows the week3Plus lock and paywall CTA', () => {
    h.premium = false;
    h.snapshot = makeSnapshot(8);
    render(<Adaptive />);
    // navigate to week 3
    const next = () => screen.getAllByLabelText(ru.study_plan.weekLabel)[1];
    fireEvent.click(next());
    fireEvent.click(next());
    expect(screen.getByText(ru.study_plan.proLock.week3Plus)).toBeInTheDocument();
    fireEvent.click(screen.getByText(ru.study_plan.proLock.unlock));
    expect(h.openPaywall).toHaveBeenCalledWith('study_plan_locked');
    expect(h.trackEvent).toHaveBeenCalledWith('Study Plan Paywall Click', { reason: 'week3Plus' });
  });
});

describe('Adaptive study plan — localization', () => {
  it('renders Kazakh create-plan strings', () => {
    h.lang = 'kk';
    h.t = kk;
    h.snapshot = null;
    render(<Adaptive />);
    expect(screen.getByText(kk.study_plan.createPlan)).toBeInTheDocument();
  });
});
