// AI usage daily limits (stored in localStorage)
// Free users: 2 AI explanations/day, 10 AI tutor messages/day
// Premium users: unlimited

const STORAGE_KEY = 'entprep_ai_usage';

interface AIUsage {
  explainCount: number;
  explainDate: string; // YYYY-MM-DD
  tutorCount: number;
  tutorDate: string;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load(): AIUsage {
  const defaults: AIUsage = { explainCount: 0, explainDate: today(), tutorCount: 0, tutorDate: today() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      explainCount: Math.max(0, parsed.explainCount ?? 0),
      explainDate: parsed.explainDate ?? today(),
      tutorCount: Math.max(0, parsed.tutorCount ?? 0),
      tutorDate: parsed.tutorDate ?? today(),
    };
  } catch {
    return defaults;
  }
}

function save(usage: AIUsage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

const DAILY_EXPLAIN_LIMIT = 2;
const DAILY_TUTOR_LIMIT = 10;

// --- AI Explain ---

export function getExplainRemaining(): number {
  const usage = load();
  if (usage.explainDate !== today()) return DAILY_EXPLAIN_LIMIT;
  return Math.max(0, DAILY_EXPLAIN_LIMIT - usage.explainCount);
}

export function consumeExplain(): boolean {
  const usage = load();
  if (usage.explainDate !== today()) {
    usage.explainCount = 0;
    usage.explainDate = today();
  }
  if (usage.explainCount >= DAILY_EXPLAIN_LIMIT) return false;
  usage.explainCount++;
  save(usage);
  return true;
}

// --- AI Tutor ---

export function getTutorRemaining(): number {
  const usage = load();
  if (usage.tutorDate !== today()) return DAILY_TUTOR_LIMIT;
  return Math.max(0, DAILY_TUTOR_LIMIT - usage.tutorCount);
}

export function consumeTutor(): boolean {
  const usage = load();
  if (usage.tutorDate !== today()) {
    usage.tutorCount = 0;
    usage.tutorDate = today();
  }
  if (usage.tutorCount >= DAILY_TUTOR_LIMIT) return false;
  usage.tutorCount++;
  save(usage);
  return true;
}
