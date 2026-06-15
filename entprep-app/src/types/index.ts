// ── Spaced Repetition ─────────────────────────────────────────────────────

export interface SRCard {
  sid: string;        // subject ID
  oi: number;         // question original index in pool
  interval: number;   // days until next review (0 = new, 1, 3, 7, 14, 30...)
  ease: number;       // ease factor (default 2.5, min 1.3)
  due: string;        // ISO date string "2026-03-15" when review is due
  reps: number;       // consecutive correct answers
  lapses: number;     // total times forgotten
}

// ── Question & Data Types ──────────────────────────────────────────────────

export type QuestionType = 'single' | 'multiple' | 'matching';

export interface Question {
  q: string;
  o: string[];                    // 4 for single, 6 for multiple, [] for matching
  c: number | number[];           // index for single, indices for multiple
  e: string;
  type?: QuestionType;            // default 'single'
  pairs?: [string, string][];     // for matching: 5 pairs [left, right]
  difficulty?: 'easy' | 'medium' | 'hard';
  block?: 'single' | 'context' | 'multiple' | 'matching';
  _oi?: number;
  _topic?: string;
  _subtopic?: string;
  _su?: string;
  pt?: string;
  px?: string;
  /** Shuffle mapping: _shuffleMap[shuffledIdx] = originalIdx. Set by shuffleOptions. */
  _shuffleMap?: number[];
  // Kazakh translations (same row, shared c/type/difficulty)
  q_kk?: string;
  o_kk?: string[];
  e_kk?: string;
  pairs_kk?: [string, string][];
  pt_kk?: string;
  px_kk?: string;
}

/** Get the question type, defaulting to 'single' for legacy questions.
 *  Infers 'matching' from presence of pairs[] — prod data pipeline sometimes
 *  omits the `type` field on matching questions, which would otherwise cause
 *  the Test screen to render via the single-choice path (empty q.o = blank screen). */
export function getQType(q: Question): QuestionType {
  if (q.type) return q.type;
  if (Array.isArray(q.pairs) && q.pairs.length > 0) return 'matching';
  return 'single';
}

/** Get the correct answer index for single-choice questions (backward compat) */
export function getSingleCorrect(q: Question): number {
  return typeof q.c === 'number' ? q.c : q.c[0];
}

/** Type for answers that can be single index, multiple indices, or matching map */
export type AnswerValue = number | number[] | Record<number, number>;

export interface Passage {
  t: string;
  tx: string;
  qs: Omit<Question, '_oi' | '_topic' | 'pt' | 'px'>[];
}

// ── Test Result & History ──────────────────────────────────────────────────

export interface QuestionDetail {
  oi: number;
  ok: boolean;
  su?: string;
  _su?: string;
  tp?: string;  // topic (section) ID from question._topic
  stp?: string; // subtopic ID from question._subtopic
  picked?: number | number[] | Record<number, number> | null; // which answer(s) the user selected — gold data for AI
  tms?: number;                     // seconds spent answering this question (integer >= 0, cap at 600)
  df?: 'easy' | 'medium' | 'hard';  // difficulty of the question at answer time
}

/** One subject's result inside a Full ENT run. Newer runs store an array of these. */
export interface ENTSectionResult {
  sid?: string;
  label?: string;
  icon?: string;
  pts?: number;
  maxPts?: number;
  passed?: boolean;
  correct?: number;
  total?: number;
}

export interface TestResult {
  /** Stable unique id stamped at creation (addHist). Lets cloud-sync dedup the
   *  same run appearing once locally and once from cloud. Optional for backward
   *  compat with history entries written before ids existed. */
  id?: string;
  su: string;
  co?: number;
  to?: number;
  sc: number;
  dt: string;
  tm?: number;
  tp?: string;
  type?: 'fullent' | 'regular' | 'duel' | 'rush';
  qd?: QuestionDetail[];
  /**
   * Per-section results for a Full ENT. Newer runs store an array of section
   * results; legacy history persisted a keyed object. Consumers MUST normalize
   * (Array.isArray check) and derive the total from `pts` — see fullEntTotalPts.
   */
  sections?: ENTSectionResult[] | Record<string, ENTSectionResult>;
  /** Server-verified leaderboard submission data. Not persisted to history. */
  _leaderboard?: { question_indices: number[]; answers: (number | number[] | Record<number, number> | null)[]; };
}

// ── User Data & Settings ───────────────────────────────────────────────────

export interface GoalSettings {
  target: number;
  date: string;
}

export interface Settings {
  exp: boolean;
  tmr: boolean;
  shf: boolean;
  theme?: 'light' | 'dark';  // UI theme — restored Apr 22 after eye-strain user request
  lang?: 'ru' | 'kk';  // UI language: Russian (default) or Kazakh
  goal?: GoalSettings;
  dailyGoal?: number;  // target tests per day (default 3)
  streakFreezeUsedAt?: string; // ISO date — last time streak freeze was used (premium, 1/week)
  pushEnabled?: boolean;       // master push notifications toggle
  pushStreak?: boolean;        // streak reminders (default true)
  pushErrors?: boolean;        // error review reminders (default true)
  pushWeekly?: boolean;        // weekly report (default true)
}

export interface UserData {
  prof: string[];
  hist: TestResult[];
  st: Settings;
  srCards?: SRCard[];   // spaced repetition cards
  lastLogin?: string;
  is_premium?: boolean;
  premium_until?: string; // ISO date
}

export type PaywallReason = 'daily_limit' | 'fullent' | 'ai' | 'upgrade' | null;

// ── Subject Configuration ──────────────────────────────────────────────────

export interface SubjectMeta {
  name: string;
  color: string;
}

export interface SubjectConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  cnt: number;
  pool?: number;
}

export interface ProfileSubject extends SubjectConfig {
  available: boolean;
  examCnt?: number;  // 40 for profile subjects in full ENT exam mode
}

export type SubjectId =
  | 'math' | 'reading' | 'history'
  | 'geography' | 'english' | 'math_profile'
  | 'physics' | 'biology' | 'chemistry'
  | 'world_history' | 'informatics' | 'law' | 'literature';

// ── ENT Exam Config ────────────────────────────────────────────────────────

export interface ENTSection {
  sid: string;
  label: string;
  icon: string;
  cnt: number;
  maxPts: number;
  threshold: number;
  ptsPerQ: number;
}

export interface ProfileBlock {
  key: 'single' | 'context' | 'multiple' | 'matching';
  label: string;
  range: [number, number];      // [start, end] inclusive indices within 40-question section
  count: number;
  questionType: QuestionType;
  ptsPerQ: number;
}

export interface ENTConfigType {
  totalTime: number;
  sections: ENTSection[];
  profileCnt: number;
  profileMaxPts: number;
  profileThreshold: number;
  profilePtsPerQ: number;        // kept for backward compat (average)
  profileBlocks: ProfileBlock[];
}

// ── Topics ─────────────────────────────────────────────────────────────────

export interface Subtopic {
  id: string;
  name: string;
  name_kk?: string;
}

export interface Topic {
  id: string;
  name: string;
  name_kk?: string;
  icon: string;
  ranges: [number, number][];
  subtopics?: Subtopic[];
}

export type TopicMap = Record<string, Topic[] | null>;

// ── University ─────────────────────────────────────────────────────────────

export interface University {
  n: string;
  c: string;
  i: string;
  min: number;
  tp: 'national' | 'medical' | 'pedagogical' | 'agro' | 'technical' | 'it' | 'other';
  sp: string;
  inf: string;
}

// ── Theme ──────────────────────────────────────────────────────────────────

export type ThemePalette = Record<string, string>;

// ── Screens ────────────────────────────────────────────────────────────────

export type ScreenId =
  | 'home' | 'profile' | 'topics' | 'test'
  | 'fullent' | 'calc' | 'prog' | 'set'
  | 'adaptive' | 'errors' | 'admin' | 'challenge'
  | 'leaderboard' | 'friends' | 'duel' | 'review';

// ── Navigation ─────────────────────────────────────────────────────────────

export interface ChallengeData {
  subjectId: string;
  score: number;
  topicId?: string | null;
}

// ── Toast ──────────────────────────────────────────────────────────────────

export interface ToastOptions {
  duration?: number;
  action?: () => void;
  actionLabel?: string;
}

export interface ToastItem {
  id: number;
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  action?: () => void;
  actionLabel?: string;
}

export interface ToastAPI {
  error: (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: ToastOptions) => void;
  warning: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: { provider?: string };
  created_at?: string;
}

// ── Adaptive & Stats ───────────────────────────────────────────────────────

export interface WeaknessAnalysis {
  score: number;
  avg: number;
  trend: 'improving' | 'declining' | 'stable' | 'none';
  count: number;
  message: string;
}

export interface TopicStats {
  id: string;
  name: string;
  name_kk?: string;
  icon: string;
  total: number;
  correct: number;
  pct: number;
  weak: boolean;
}

export interface Recommendations {
  weak: (SubjectConfig & WeaknessAnalysis)[];
  strong: (SubjectConfig & WeaknessAnalysis)[];
  overall: number;
  totalTests: number;
}

export interface Streak {
  current: number;
  best: number;
  frozenToday?: boolean; // true if streak was saved by a freeze
}

export interface StreakMilestone {
  isMilestone: boolean;
  milestone: number;
  next: number | null;
  message: string | null;
}

export interface PersonalBest {
  best: number;
  date: string;
  count: number;
}

export interface GoalProgress {
  currentAvg: number;
  approxScore: number;
  target: number;
  pct: number;
  daysLeft: number;
  onTrack: boolean;
}

export interface DailyChallenge {
  date: string;
  subjectId: string;
  completed: boolean;
  score: number | null;
  prevScore: number | null;
  sub: SubjectConfig;
}

// ── Async Data Hook ────────────────────────────────────────────────────────

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// ── Responsive ────────────────────────────────────────────────────────────

export type { Breakpoint } from '../hooks/useBreakpoint';

// ── Social Types ──────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  nickname: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak: number;
  last_active: string;
  region?: string;
}

export type FriendStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: number;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: string;
  profile: Profile; // the OTHER user's profile (joined client-side)
}

// ── Duel Types ─────────────────────────────────────────────────────────────

export interface DuelQuestion {
  idx: number;
  q: string;
  o: string[];
  _topic?: string;
}

export type DuelStatus = 'waiting' | 'active' | 'finished' | 'expired' | 'forfeit';

export interface DuelState {
  id: number;
  code?: string;
  subject: string;
  creator_id: string;
  opponent_id: string | null;
  status: DuelStatus;
  creator_score: number;
  opponent_score: number;
  // SafeDuel fields returned by get_duel API
  my_role: 'creator' | 'opponent';
  my_answers: Record<string, number | null>;
  my_done: boolean;
  opponent_done: boolean;
  opponent_progress: number;
  // Only present when status === 'finished' (both players' answers revealed)
  creator_answers?: Record<string, number | null>;
  opponent_answers?: Record<string, number | null>;
  creator_done?: boolean;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
}

// ── Style Types ────────────────────────────────────────────────────────────

export type CSSProperties = React.CSSProperties;
