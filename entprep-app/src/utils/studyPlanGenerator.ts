import type {
  GenerateStudyPlanInput,
  StudyPlan,
  StudyPlanTopicRef,
  StudyTask,
  StudyWeek,
} from '../types/index';
import { TOPIC_MAP } from '../config/topics';

/**
 * Generates a deterministic, long-horizon study plan from today to examDate.
 *
 * Pure function — NO Date.now(), NO Math.random(), NO argless `new Date()`.
 * Same inputs + seed → byte-identical output (deep-equal, reproducible).
 * Returns null on invalid input (examDate < today, malformed dates).
 *
 * Algorithm (see blueprint):
 * 1. weeksCount = clamp(weeksBetween(today, examDate), 2, 26)
 * 2. Phases: ~40% foundation, ~40% build, ~20% review
 * 3. Weak topics drive foundation; strong appear in build/review
 * 4. 4-6 tasks/week across weekdays (lighter on weekends), exactly one challenge/week
 * 5. Premium: weekNum >= 3 → whole week premium; all challenge tasks premium
 */

// ── Mandatory ENT subjects (always covered for cold-start / fallback) ────────
const MANDATORY_SUBJECTS = ['math', 'reading', 'history'];

// ── Deterministic helpers ────────────────────────────────────────────────────

/** Seeded PRNG returning 0..1. Same seed → same stream. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (deterministic seed source). */
export function hashString(s: string): number {
  let a = 0;
  for (let i = 0; i < s.length; i++) {
    a = ((a << 5) - a + s.charCodeAt(i)) | 0;
  }
  return a >>> 0;
}

/** Short hex id derived from a string (stable). */
function hashId(s: string): string {
  return hashString(s).toString(16).padStart(8, '0');
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Parse an ISO `yyyy-mm-dd` (or full ISO) into UTC midnight ms, or NaN if invalid. */
function parseISODay(d: string): number {
  if (!d || typeof d !== 'string') return NaN;
  const day = d.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return ms;
}

/** Whole weeks between two ISO dates (floor). Negative if examDate < today. */
export function weeksBetween(today: string, examDate: string): number {
  const a = parseISODay(today);
  const b = parseISODay(examDate);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  const days = Math.floor((b - a) / 86_400_000);
  return Math.floor(days / 7);
}

/** Add `days` to an ISO `yyyy-mm-dd`, returning ISO `yyyy-mm-dd`. */
export function dateAddDays(date: string, days: number): string {
  const ms = parseISODay(date) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Round an ISO date back to the previous Monday, returning ISO `yyyy-mm-dd`. */
export function roundToMonday(date: string): string {
  const ms = parseISODay(date);
  const dow = new Date(ms).getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  return dateAddDays(date, -back);
}

/** Fisher-Yates shuffle using a seeded RNG (returns a new array). */
export function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Per-type metadata ─────────────────────────────────────────────────────────

const DURATION: Record<StudyTask['type'], number> = {
  lesson: 8,
  practice: 5,
  review: 12,
  fullent: 240,
  challenge: 15,
  tip: 3,
};

/** Resolve the topic id for a subject. reading (TOPIC_MAP null) → undefined. */
function resolveTopic(subject: string, ref?: StudyPlanTopicRef): string | undefined {
  if (TOPIC_MAP[subject] == null) return undefined; // topic-less subject (e.g. reading)
  return ref?.topic;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

/** Distinct subject ids from a topic-ref list, preserving (weakest-first) order. */
function subjectsOf(refs: StudyPlanTopicRef[]): string[] {
  return uniq(refs.map(r => r.id));
}

/** First topic ref matching a subject (for topic resolution). */
function refForSubject(refs: StudyPlanTopicRef[], subject: string): StudyPlanTopicRef | undefined {
  return refs.find(r => r.id === subject);
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateStudyPlan(input: GenerateStudyPlanInput): StudyPlan | null {
  const { examDate, target, profileSubjects, weakTopics, strongTopics, today, seed } = input;

  // 1. Validate inputs
  const todayMs = parseISODay(today);
  const examMs = parseISODay(examDate);
  if (Number.isNaN(todayMs) || Number.isNaN(examMs)) return null;
  if (examMs < todayMs) return null;
  if (!seed || typeof seed !== 'string') return null;

  // 1b. weeksCount = clamp(weeksBetween, 2, 26)
  const weeksCount = clamp(weeksBetween(today, examDate), 2, 26);

  // 2. PRNG
  const rng = mulberry32(hashString(seed));

  // 3. Phase boundaries (~40 / ~40 / ~20). Guarantee >= 1 foundation week and >= 1 review week.
  const foundationEnd = Math.max(1, Math.floor(weeksCount * 0.4));
  const buildEnd = Math.max(foundationEnd, Math.floor(weeksCount * 0.8));
  // reviewEnd === weeksCount implicitly

  // 4. Topic pools
  const weakSubjects = subjectsOf(weakTopics);
  const strongSubjects = subjectsOf(strongTopics);
  const allSubjects = uniq([...MANDATORY_SUBJECTS, ...profileSubjects]);
  const coldStart = weakTopics.length === 0 && strongTopics.length === 0;
  const createdAt = seed;
  const startMonday = roundToMonday(today);

  const weeks: StudyWeek[] = [];

  for (let weekNum = 1; weekNum <= weeksCount; weekNum++) {
    const phase: StudyWeek['phase'] =
      weekNum <= foundationEnd ? 'foundation' : weekNum <= buildEnd ? 'build' : 'review';

    const startDate = dateAddDays(startMonday, (weekNum - 1) * 7);
    const endDate = dateAddDays(startDate, 6);
    const weekPremium = weekNum >= 3;

    // Diagnostic fullent in week 1 for cold start; fullent every review week.
    const includeFullent = phase === 'review' || (coldStart && weekNum === 1);

    // 4-6 tasks/week
    const perWeekCount = 4 + Math.floor(rng() * 3); // 4, 5 or 6

    // Subject pool for this week's content tasks (challenge/fullent excluded).
    let poolSubjects: string[];
    if (phase === 'foundation') {
      poolSubjects = weakSubjects.length ? weakSubjects : allSubjects;
    } else if (phase === 'build') {
      poolSubjects = uniq([...weakSubjects, ...strongSubjects]);
      if (!poolSubjects.length) poolSubjects = allSubjects;
    } else {
      poolSubjects = uniq([...weakSubjects, ...strongSubjects]);
      if (!poolSubjects.length) poolSubjects = allSubjects;
    }
    const cycle = shuffleArray(poolSubjects, rng);

    // Reserve slots: 1 challenge always; 1 fullent when included.
    const contentCount = Math.max(1, perWeekCount - 1 - (includeFullent ? 1 : 0));

    // Build ordered task descriptors: [fullent?] + content (subject-alternating) + challenge.
    const descriptors: Array<Pick<StudyTask, 'type' | 'subject' | 'topic' | 'title'>> = [];

    if (includeFullent) {
      descriptors.push({
        type: 'fullent',
        title: coldStart && weekNum === 1 ? 'Diagnostic full ENT' : 'Full ENT simulation',
      });
    }

    for (let i = 0; i < contentCount; i++) {
      // Cycle distinct subjects → alternating, no back-to-back same subject (when >1 subject).
      const subject = cycle[i % cycle.length];
      const ref = refForSubject(weakTopics, subject) ?? refForSubject(strongTopics, subject);
      const topic = resolveTopic(subject, ref);

      let type: StudyTask['type'];
      if (phase === 'foundation') {
        type = i % 2 === 0 ? 'lesson' : 'practice';
      } else if (phase === 'build') {
        type = 'practice';
      } else {
        type = 'review';
      }

      descriptors.push({
        type,
        subject,
        topic,
        title: `${type}:${subject}${topic ? `:${topic}` : ''}`,
      });
    }

    // Exactly one challenge per week (premium).
    descriptors.push({ type: 'challenge', title: 'Weekly challenge' });

    // 5. Spread across distinct weekdays — prefer Mon-Fri, spill to weekend only if needed.
    const weekdayOffsets = shuffleArray([0, 1, 2, 3, 4], rng); // Mon..Fri
    const weekendOffsets = shuffleArray([5, 6], rng); // Sat, Sun
    const allOffsets = [...weekdayOffsets, ...weekendOffsets];
    const chosenOffsets = allOffsets.slice(0, descriptors.length).sort((a, b) => a - b);

    const tasks: StudyTask[] = descriptors.map((d, idx) => {
      const isChallenge = d.type === 'challenge';
      return {
        id: isChallenge ? `week_${weekNum}_challenge` : `week_${weekNum}_${idx}`,
        date: dateAddDays(startDate, chosenOffsets[idx]),
        type: d.type,
        subject: d.subject,
        topic: d.topic,
        title: d.title,
        durationMin: DURATION[d.type],
        premium: weekPremium || d.type === 'challenge',
      };
    });

    weeks.push({
      weekNum,
      startDate,
      endDate,
      phase,
      premium: weekPremium,
      tasks,
    });
  }

  return {
    id: hashId(`${createdAt}|${examDate}|${target}`),
    createdAt,
    examDate,
    target,
    weeksCount,
    weeks,
  };
}
