/**
 * Simple keyword-based RAG for textbook context.
 * Loads textbook JSONs from CDN, caches in memory, returns top-K relevant chunks.
 */

// In-memory cache (persists across warm invocations)
const cache = {};

const SUBJECT_TO_TEXTBOOK = {
  chemistry: ['chemistry'],
  physics: ['physics', 'physics_ogn'],
};

const CDN_BASE = 'https://entprep.org/data/textbooks';

async function loadTextbook(name) {
  if (cache[name]) return cache[name];
  try {
    const res = await fetch(`${CDN_BASE}/${name}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    cache[name] = data.chunks || [];
    return cache[name];
  } catch {
    return null;
  }
}

/**
 * Simple keyword relevance scoring.
 * Extracts meaningful words from the question, scores chunks by keyword overlap.
 */
function scoreChunk(chunkText, keywords) {
  const lower = chunkText.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score++;
  }
  return score;
}

function extractKeywords(text) {
  // Remove common stop words, keep meaningful terms
  const stopWords = new Set([
    'что', 'как', 'какой', 'какая', 'какие', 'при', 'для', 'это', 'его', 'её',
    'они', 'или', 'если', 'когда', 'где', 'был', 'была', 'были', 'будет',
    'можно', 'нужно', 'следующий', 'равна', 'равно', 'равен', 'является',
    'называется', 'определите', 'найдите', 'вычислите', 'укажите',
    'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
  ]);

  return text
    .toLowerCase()
    .replace(/[^а-яёa-z0-9₂₃\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Get relevant textbook context for a question.
 * @param {string} subject - Subject ID (e.g. 'chemistry')
 * @param {string} questionText - Full question text
 * @param {number} topK - Number of chunks to return (default 3)
 * @returns {string|null} - Concatenated context or null if no textbook
 */
export async function getContext(subject, questionText, topK = 3) {
  const textbookNames = SUBJECT_TO_TEXTBOOK[subject];
  if (!textbookNames) return null;

  const allChunks = [];
  for (const name of textbookNames) {
    const chunks = await loadTextbook(name);
    if (chunks) allChunks.push(...chunks);
  }

  if (allChunks.length === 0) return null;

  const keywords = extractKeywords(questionText);
  if (keywords.length === 0) return null;

  // Score and rank chunks
  const scored = allChunks
    .map(chunk => ({ text: chunk.text, chapter: chunk.chapter, score: scoreChunk(chunk.text, keywords) }))
    .filter(c => c.score >= 2) // At least 2 keyword matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length === 0) return null;

  return scored.map(c => `[${c.chapter}]\n${c.text}`).join('\n\n---\n\n');
}
