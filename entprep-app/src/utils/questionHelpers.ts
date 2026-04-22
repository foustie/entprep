import type { Question, Passage } from '../types/index';
import { getQType } from '../types/index';
import { getPool, getPassages } from './questionStore';
import { TOPIC_MAP, getTopicQuestions } from '../config/topics';
import { ALL_PROFILES_BASE } from '../config/subjects';

const PROFILE_IDS = new Set(ALL_PROFILES_BASE.map(p => p.id));

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Deep copy a question to prevent cache mutation
function copyQuestion(q: Question): Question {
  return {
    ...q,
    o: [...q.o],
    ...(q.pairs ? { pairs: q.pairs.map(p => [...p] as [string, string]) } : {}),
    ...(Array.isArray(q.c) ? { c: [...q.c] } : {}),
  };
}

/** Shuffle options for any question type.
 *  Sets _shuffleMap so the user's shuffled answer can be mapped back to original indices.
 *  _shuffleMap[shuffledIdx] = originalIdx
 */
function shuffleOptions(q: Question): Question {
  const qType = getQType(q);

  if (qType === 'matching') {
    // MatchingCard handles right-side shuffle via shuffledRightIndices
    // Do NOT shuffle pairs here — it breaks the pair[i][0]↔pair[i][1] correspondence
    return copyQuestion(q);
  }

  if (qType === 'multiple') {
    // 6 options, multiple correct indices
    const indices = shuffleArray(Array.from({ length: q.o.length }, (_, i) => i));
    const correctArr = Array.isArray(q.c) ? q.c : [q.c];
    const newCorrect = correctArr.map(ci => indices.indexOf(ci));
    return { ...q, o: indices.map(i => q.o[i]), c: newCorrect, _shuffleMap: indices };
  }

  // single: 4 options
  const indices = shuffleArray(Array.from({ length: q.o.length }, (_, i) => i));
  const c = typeof q.c === 'number' ? q.c : q.c[0];
  return { ...q, o: indices.map(i => q.o[i]), c: indices.indexOf(c), _shuffleMap: indices };
}

/**
 * Assemble a balanced mix for regular tests on profile subjects.
 * Target: ~70% single, ~15% multiple, ~15% matching.
 * Falls back to single if not enough questions of other types.
 */
function assembleRegularMix(source: Question[], n: number, shuffle: boolean): Question[] {
  const multiTarget = Math.max(1, Math.round(n * 0.15));
  const matchTarget = Math.max(1, Math.round(n * 0.15));

  const singles = source.filter(q => (q.type || 'single') === 'single');
  const multiples = source.filter(q => q.type === 'multiple');
  const matchings = source.filter(q => q.type === 'matching');

  const shuf = <T>(arr: T[]): T[] => shuffle ? shuffleArray(arr) : [...arr];

  const pickedMulti = shuf(multiples).slice(0, multiTarget);
  const pickedMatch = shuf(matchings).slice(0, matchTarget);
  const singleCount = n - pickedMulti.length - pickedMatch.length;
  const pickedSingle = shuf(singles).slice(0, singleCount);

  let result = [...pickedSingle, ...pickedMulti, ...pickedMatch];

  // If total < n, fill from any remaining questions
  if (result.length < n) {
    const usedOis = new Set(result.map(q => q._oi));
    const remaining = source.filter(q => !usedOis.has(q._oi));
    result.push(...shuf(remaining).slice(0, n - result.length));
  }

  result = shuffle ? shuffleArray(result) : result;
  return shuffle ? result.map(shuffleOptions) : result.map(copyQuestion);
}

/**
 * Sample questions balanced by topic and difficulty.
 * ENT spec: 50% easy, 30% medium, 20% hard. Even across topics.
 *
 * Granularity priority: _subtopic (matches official ENT spec topic IDs, 12-55 per subject)
 * → _topic (section-level fallback, 3-13 per subject) → '_' bucket.
 * Audited Apr 22: 95-100% _subtopic coverage in CDN data, IDs match spec for 8/10 subjects.
 */
function balancedSample(source: Question[], n: number, shuffle: boolean): Question[] {
  // Group by subtopic when available (ENT spec granularity), fall back to section, then catch-all
  const byTopic: Record<string, Question[]> = {};
  for (const q of source) (byTopic[q._subtopic || q._topic || '_'] ||= []).push(q);
  const topicKeys = Object.keys(byTopic);

  // If only 1 topic or very few questions, just shuffle
  if (topicKeys.length <= 1 || source.length <= n) {
    return shuffle ? shuffleArray(source).slice(0, n) : source.slice(0, n);
  }

  const perTopic = Math.max(1, Math.floor(n / topicKeys.length));
  const result: Question[] = [];

  for (const k of topicKeys) {
    let topicQs = shuffle ? shuffleArray(byTopic[k]) : byTopic[k];
    // Within topic, try to match difficulty distribution: 50/30/20
    const easy = topicQs.filter(q => q.difficulty === 'easy');
    const medium = topicQs.filter(q => q.difficulty === 'medium');
    const hard = topicQs.filter(q => q.difficulty === 'hard');
    const untagged = topicQs.filter(q => !q.difficulty);

    const easyTarget = Math.round(perTopic * 0.5);
    const medTarget = Math.round(perTopic * 0.3);
    const hardTarget = perTopic - easyTarget - medTarget;

    const picked = [
      ...easy.slice(0, easyTarget),
      ...medium.slice(0, medTarget),
      ...hard.slice(0, hardTarget),
    ];
    // Fill shortfall from untagged, then any
    if (picked.length < perTopic) {
      const used = new Set(picked.map(q => q._oi));
      const fill = [...untagged, ...topicQs].filter(q => !used.has(q._oi));
      picked.push(...fill.slice(0, perTopic - picked.length));
    }
    result.push(...picked);
  }

  // Fill remaining
  if (result.length < n) {
    const used = new Set(result.map(q => q._oi));
    const rest = source.filter(q => !used.has(q._oi));
    result.push(...(shuffle ? shuffleArray(rest) : rest).slice(0, n - result.length));
  }

  return shuffle ? shuffleArray(result).slice(0, n) : result.slice(0, n);
}

async function getQs(sid: string, n: number, shuffle: boolean = true, topicId: string | null = null, lang?: 'ru' | 'kk'): Promise<Question[]> {
  if (sid === "reading") {
    const passages: Passage[] = await getPassages(lang);
    const s = shuffle ? shuffleArray(passages) : [...passages];
    const need = Math.ceil(n / 5);
    const ps = s.slice(0, need);
    const r: Question[] = [];
    ps.forEach(p => {
      const pi = passages.indexOf(p);
      p.qs.forEach((q, qi) => r.push({ ...q, _oi: pi * 5 + qi, pt: lang === 'kk' && q.pt_kk ? q.pt_kk : p.t, px: lang === 'kk' && q.px_kk ? q.px_kk : p.tx }));
    });
    return shuffle ? r.slice(0, n).map(shuffleOptions) : r.slice(0, n).map(copyQuestion);
  }

  const pool: Question[] = await getPool(sid, lang);
  if (!pool || pool.length === 0) return [];

  let source: Question[] = pool;
  if (topicId && TOPIC_MAP[sid]) {
    const topics = TOPIC_MAP[sid]!;
    const isSection = topics.find(t => t.id === topicId);
    if (isSection) {
      // Filter by section (topic) ID
      const hasDbTopics = pool.some(q => q._topic);
      if (hasDbTopics) {
        source = pool.filter(q => q._topic === topicId);
      } else {
        source = getTopicQuestions(pool, isSection.ranges);
      }
    } else {
      // Check if it's a subtopic ID
      const isSubtopic = topics.some(t => t.subtopics?.some(st => st.id === topicId));
      if (isSubtopic) {
        source = pool.filter(q => q._subtopic === topicId);
      }
    }
  }

  // Profile subjects: balanced mix of single/multiple/matching
  if (PROFILE_IDS.has(sid)) {
    return assembleRegularMix(source, Math.min(n, source.length), shuffle);
  }

  // Mandatory subjects: topic + difficulty balanced single-choice
  const take = Math.min(n, source.length);
  const balanced = balancedSample(source, take, shuffle);
  return shuffle ? balanced.map(shuffleOptions) : balanced.map(copyQuestion);
}

export { shuffleOptions, getQs };
