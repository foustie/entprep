import { supabase } from '../config/supabase';
import { captureError } from '../config/sentry';

/**
 * AI Conversation Memory
 *
 * Stores a rolling summary of AI conversations per user.
 * Loaded into system prompt so AI "remembers" past sessions.
 * This is the foundation of the Intelligence Trap.
 *
 * Table: ai_memory (create via Supabase Dashboard SQL Editor):
 *
 * CREATE TABLE ai_memory (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   summary text NOT NULL DEFAULT '',
 *   weak_topics text[] DEFAULT ARRAY[]::text[],
 *   strong_topics text[] DEFAULT ARRAY[]::text[],
 *   last_subjects text[] DEFAULT ARRAY[]::text[],
 *   conversation_count int DEFAULT 0,
 *   updated_at timestamptz DEFAULT now()
 * );
 * CREATE INDEX idx_ai_memory_user ON ai_memory(user_id);
 * ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY ai_memory_own ON ai_memory FOR ALL USING (auth.uid() = user_id);
 */

export interface AiMemory {
  summary: string;          // rolling text summary of past conversations
  weak_topics: string[];    // topics user struggles with
  strong_topics: string[];  // topics user is good at
  last_subjects: string[];  // last discussed subjects
  conversation_count: number;
}

const EMPTY_MEMORY: AiMemory = {
  summary: '',
  weak_topics: [],
  strong_topics: [],
  last_subjects: [],
  conversation_count: 0,
};

// In-memory cache to avoid repeated fetches
let memoryCache: { userId: string; data: AiMemory } | null = null;

export async function loadMemory(userId: string): Promise<AiMemory> {
  if (memoryCache?.userId === userId) return memoryCache.data;
  if (!supabase) return EMPTY_MEMORY;

  try {
    const { data, error } = await supabase
      .from('ai_memory')
      .select('summary, weak_topics, strong_topics, last_subjects, conversation_count')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found (first time user), not an error
      captureError(error, { context: 'aiMemory.load' });
    }

    const memory = data ? {
      summary: data.summary || '',
      weak_topics: data.weak_topics || [],
      strong_topics: data.strong_topics || [],
      last_subjects: data.last_subjects || [],
      conversation_count: data.conversation_count || 0,
    } : EMPTY_MEMORY;

    memoryCache = { userId, data: memory };
    return memory;
  } catch (err) {
    captureError(err, { context: 'aiMemory.load' });
    return EMPTY_MEMORY;
  }
}

export async function saveMemory(userId: string, memory: Partial<AiMemory>): Promise<void> {
  if (!supabase) return;

  try {
    const current = await loadMemory(userId);
    const updated: AiMemory = {
      summary: memory.summary ?? current.summary,
      weak_topics: memory.weak_topics ?? current.weak_topics,
      strong_topics: memory.strong_topics ?? current.strong_topics,
      last_subjects: memory.last_subjects ?? current.last_subjects,
      conversation_count: (memory.conversation_count ?? current.conversation_count) + 1,
    };

    await supabase
      .from('ai_memory')
      .upsert({
        user_id: userId,
        ...updated,
        updated_at: new Date().toISOString(),
      });

    memoryCache = { userId, data: updated };
  } catch (err) {
    captureError(err, { context: 'aiMemory.save' });
  }
}

/**
 * Build context string for AI system prompt from memory.
 * Keep it short — this goes into every API call.
 */
export function buildMemoryContext(memory: AiMemory): string {
  if (memory.conversation_count === 0) return '';

  const parts: string[] = [];

  if (memory.weak_topics.length > 0) {
    parts.push(`Слабые темы: ${memory.weak_topics.join(', ')}`);
  }
  if (memory.strong_topics.length > 0) {
    parts.push(`Сильные: ${memory.strong_topics.join(', ')}`);
  }
  if (memory.summary) {
    // Keep only last 300 chars of summary to save tokens
    const trimmed = memory.summary.length > 300
      ? '...' + memory.summary.slice(-300)
      : memory.summary;
    parts.push(`Прошлые разговоры: ${trimmed}`);
  }
  parts.push(`Сессий: ${memory.conversation_count}`);

  return parts.join('\n');
}

/**
 * Generate summary update from a conversation.
 * Called after AI chat ends. Extracts key info to remember.
 * This runs client-side to avoid extra API calls.
 */
export function extractMemoryUpdate(
  messages: { role: 'user' | 'assistant'; content: string }[],
  currentMemory: AiMemory,
): Partial<AiMemory> {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const assistantMessages = messages.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
  const allText = [...userMessages, ...assistantMessages].join(' ');

  // Extract subjects mentioned
  const subjectKeywords: Record<string, string[]> = {
    'математика': ['математик', 'мат', 'производн', 'интеграл', 'уравнени', 'функци'],
    'физика': ['физик', 'кинематик', 'динамик', 'электричеств', 'магнит', 'оптик'],
    'химия': ['хими', 'реакц', 'элемент', 'молекул', 'атом', 'кислот'],
    'биология': ['биолог', 'клетк', 'ген', 'эволюц', 'организм'],
    'история': ['истори', 'казахстан', 'хан', 'каганат', 'независим'],
    'информатика': ['информатик', 'алгоритм', 'программ', 'код', 'массив'],
    'география': ['географ', 'рельеф', 'климат', 'населен'],
  };

  const mentionedSubjects: string[] = [];
  for (const [subj, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(kw => allText.includes(kw))) {
      mentionedSubjects.push(subj);
    }
  }

  // Build summary line for this conversation
  const topicsSummary = mentionedSubjects.length > 0
    ? `Обсуждали: ${mentionedSubjects.join(', ')}`
    : 'Общий разговор';

  const questionCount = userMessages.length;
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const newLine = `[${date}] ${topicsSummary} (${questionCount} вопр.)`;

  // Append to existing summary, keep last 5 entries
  const existingLines = currentMemory.summary.split('\n').filter(Boolean);
  const updatedLines = [...existingLines, newLine].slice(-5);

  return {
    summary: updatedLines.join('\n'),
    last_subjects: mentionedSubjects.length > 0 ? mentionedSubjects : currentMemory.last_subjects,
  };
}

export function clearMemoryCache(): void {
  memoryCache = null;
}
