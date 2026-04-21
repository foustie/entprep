import type { TestResult } from '../types/index';

/**
 * ENT Score Prediction
 *
 * Calculates predicted ENT score from user's test history.
 * Uses weighted average of last N tests per subject × max points.
 *
 * ENT structure (140 pts total):
 *   History:    20q × 1pt = 20 max
 *   Math lit:   10q × 1pt = 10 max
 *   Reading:    10q × 1pt = 10 max
 *   Profile 1:  25×1 + 5×1 + 5×2 + 5×2 = 50 max
 *   Profile 2:  same = 50 max
 */

const MANDATORY = [
  { sid: 'history', maxPts: 20 },
  { sid: 'math', maxPts: 10 },
  { sid: 'reading', maxPts: 10 },
] as const;

const PROFILE_MAX_PTS = 50;
const TOTAL_MAX = 140;
const MIN_TESTS_PER_SUBJECT = 1;
const MIN_SUBJECTS_WITH_DATA = 3;
const LAST_N_TESTS = 10;

export interface SubjectPrediction {
  sid: string;
  accuracy: number;     // 0-1
  predicted: number;    // points
  maxPts: number;
  testCount: number;
}

export interface ScorePrediction {
  total: number;         // predicted total (0-140)
  range: number;         // ± uncertainty
  maxPossible: number;   // 140
  bySubject: SubjectPrediction[];
  ready: boolean;        // enough data?
  testsNeeded: number;   // how many more tests needed (0 if ready)
}

function getSubjectAccuracy(hist: TestResult[], sid: string): { accuracy: number; count: number; scores: number[] } {
  const tests = hist
    .filter(t => t.su === sid && t.co !== undefined && t.to !== undefined && t.to > 0 && t.type !== 'fullent')
    .slice(-LAST_N_TESTS);

  if (tests.length === 0) return { accuracy: 0, count: 0, scores: [] };

  // Recent tests weighted more: last test × 1.5, second-last × 1.3, rest × 1.0
  const scores = tests.map(t => t.co! / t.to!);
  const weights = scores.map((_, i) => {
    const recency = scores.length - i;
    if (recency === 1) return 1.5;
    if (recency === 2) return 1.3;
    return 1.0;
  });

  const weightedSum = scores.reduce((sum, s, i) => sum + s * weights[i], 0);
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  return {
    accuracy: weightedSum / weightTotal,
    count: tests.length,
    scores,
  };
}

export function predictScore(hist: TestResult[], profileSubjects: string[]): ScorePrediction {
  const subjects = [
    ...MANDATORY.map(m => ({ sid: m.sid, maxPts: m.maxPts })),
    ...profileSubjects.map(sid => ({ sid, maxPts: PROFILE_MAX_PTS })),
  ];

  const bySubject: SubjectPrediction[] = [];
  let totalPredicted = 0;
  let allScores: number[] = [];
  let subjectsWithData = 0;

  for (const { sid, maxPts } of subjects) {
    const { accuracy, count, scores } = getSubjectAccuracy(hist, sid);

    if (count >= MIN_TESTS_PER_SUBJECT) {
      subjectsWithData++;
    }

    const predicted = Math.round(accuracy * maxPts * 10) / 10;
    totalPredicted += predicted;
    allScores.push(...scores);

    bySubject.push({ sid, accuracy, predicted, maxPts, testCount: count });
  }

  // Calculate uncertainty range from score variance
  let range = 8; // default wide range
  if (allScores.length >= 5) {
    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const variance = allScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / allScores.length;
    const sd = Math.sqrt(variance);
    // Scale SD to total points and round
    range = Math.max(2, Math.min(15, Math.round(sd * TOTAL_MAX * 0.5)));
  }

  const ready = subjectsWithData >= MIN_SUBJECTS_WITH_DATA;
  const testsNeeded = ready ? 0 : Math.max(0, MIN_SUBJECTS_WITH_DATA - subjectsWithData);

  return {
    total: Math.round(totalPredicted),
    range,
    maxPossible: TOTAL_MAX,
    bySubject,
    ready,
    testsNeeded,
  };
}

/** Find nearest grant threshold for a given score */
export function getGrantTarget(score: number, universities: { name: string; threshold: number }[]): { name: string; threshold: number; gap: number } | null {
  // Find the nearest university grant threshold above current score
  const above = universities
    .filter(u => u.threshold > score)
    .sort((a, b) => a.threshold - b.threshold);

  if (above.length === 0) return null;
  const nearest = above[0];
  return { name: nearest.name, threshold: nearest.threshold, gap: nearest.threshold - score };
}

/** Calculate score trend from last 5 predictions */
export function getScoreTrend(hist: TestResult[], profileSubjects: string[]): { direction: 'up' | 'down' | 'flat'; delta: number } {
  if (hist.length < 5) return { direction: 'flat', delta: 0 };

  // Calculate prediction from older tests vs newer tests
  const mid = Math.floor(hist.length / 2);
  const olderHist = hist.slice(0, mid);
  const newerHist = hist.slice(mid);

  const olderScore = predictScore(olderHist, profileSubjects).total;
  const newerScore = predictScore(newerHist, profileSubjects).total;
  const delta = newerScore - olderScore;

  if (delta > 2) return { direction: 'up', delta };
  if (delta < -2) return { direction: 'down', delta };
  return { direction: 'flat', delta: 0 };
}
