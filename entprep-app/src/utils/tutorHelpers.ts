// AI Tutor client helpers: API calls, student profile builder, voice input

import { supabase } from '../config/supabase';
import { API_BASE } from '../config/app';
import type { TestResult } from '../types/index';
import { TOPIC_MAP } from '../config/topics';

// ── Types ──

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface StudentProfile {
  weakTopics: { name: string; pct: number; sid: string; topicId: string }[];
  strongTopics: { name: string; pct: number }[];
  prediction: number | null;
  targetUni: string | null;
  testsCount: number;
  streak: number;
}

export interface TutorResponse {
  text: string;
}

// ── Build student profile from test history ──

export function buildStudentProfile(hist: TestResult[], goal?: { target?: number } | null): StudentProfile {
  const subjectStats: Record<string, { total: number; correct: number; tests: number }> = {};

  for (const t of hist) {
    if (t.type === 'fullent' || !t.su) continue;
    if (!subjectStats[t.su]) subjectStats[t.su] = { total: 0, correct: 0, tests: 0 };
    subjectStats[t.su].tests++;
    if (t.qd) {
      for (const q of t.qd) {
        subjectStats[t.su].total++;
        if (q.ok) subjectStats[t.su].correct++;
      }
    } else if (t.co != null && t.to != null) {
      subjectStats[t.su].total += t.to;
      subjectStats[t.su].correct += t.co;
    }
  }

  const subjects = Object.entries(subjectStats)
    .map(([sid, s]) => ({
      sid,
      name: sid,
      pct: s.total > 0 ? Math.round(s.correct / s.total * 100) : 0,
      topicId: '',
    }))
    .filter(s => s.pct > 0);

  const weak = subjects.filter(s => s.pct < 65).sort((a, b) => a.pct - b.pct);
  const strong = subjects.filter(s => s.pct >= 75).sort((a, b) => b.pct - a.pct);

  // Prediction
  const regular = hist.filter(t => t.type !== 'fullent' && t.sc != null);
  let prediction: number | null = null;
  if (regular.length >= 3) {
    const recent = regular.slice(-15);
    let ws = 0, wt = 0;
    for (let i = 0; i < recent.length; i++) {
      const w = 1 + (i / recent.length);
      ws += (recent[i].sc || 0) * w;
      wt += w;
    }
    prediction = Math.round((ws / wt) * 1.4);
  }

  return {
    weakTopics: weak.slice(0, 5),
    strongTopics: strong.slice(0, 3),
    prediction,
    targetUni: null,
    testsCount: hist.length,
    streak: 0,
  };
}

// ── Get topic name by id ──

export function getTopicName(sid: string, topicId: string): string {
  const topics = TOPIC_MAP[sid];
  if (!topics) return topicId;
  for (const t of topics) {
    if (t.id === topicId) return t.name;
    for (const st of t.subtopics || []) {
      if (st.id === topicId) return st.name;
    }
  }
  return topicId;
}

// ── API call ──

export async function sendTutorMessage(
  messages: TutorMessage[],
  profile: StudentProfile,
  options: {
    subject?: string;
    topicId?: string;
    lang?: string;
    mode?: string;
  } = {},
  onChunk?: (text: string) => void,
): Promise<TutorResponse> {
  if (!supabase) throw new Error('Not configured');
  // Try getSession first, fallback to direct localStorage read
  let token: string | null = null;
  const sessionRes = await supabase.auth.getSession();
  token = sessionRes.data.session?.access_token || null;
  if (!token) {
    // Fallback: read directly from storage (workaround for Supabase session sync issues)
    try {
      const raw = localStorage.getItem('entprep-auth-v2') || localStorage.getItem('entprep-auth');
      if (raw) { const parsed = JSON.parse(raw); token = parsed.access_token || null; }
    } catch { /* ignore */ }
  }
  if (!token) throw new Error('Войдите в аккаунт чтобы использовать AI');

  const useStream = false; // Disabled: Netlify Functions buffer SSE, breaks streaming

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 30000); // 30s for streaming, 15s was too short

  const res = await fetch(`${API_BASE}/api/ai-tutor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: ac.signal,
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      profile,
      subject: options.subject,
      topicId: options.topicId,
      lang: options.lang || 'ru',
      mode: options.mode || 'chat',
      stream: useStream,
    }),
  });

  clearTimeout(timeout);
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const ua = navigator.userAgent.substring(0, 80);
    console.error('[AI Tutor] Error response:', res.status, errBody.slice(0, 200), 'UA:', ua);
    if (res.status === 401) throw new Error('Сессия истекла. Перезайдите в аккаунт.');
    try { const d = JSON.parse(errBody); throw new Error(d.error || (res.status === 429 ? 'Слишком много запросов. Подожди минутку.' : 'AI временно недоступен')); } catch(e) { if (e instanceof SyntaxError) throw new Error(res.status === 429 ? 'Слишком много запросов. Подожди минутку.' : 'AI временно недоступен'); throw e; }
  }

  // Non-streaming (streaming disabled — Netlify buffers SSE)
  const data = await res.json();
  return data as TutorResponse;
}

// ── Voice input (Web Speech API) ──

export function startVoiceInput(
  lang: string,
  onResult: (text: string) => void,
  onError: (err: string) => void,
): () => void {
  const SpeechRecognition = (window as unknown as Record<string, unknown>).webkitSpeechRecognition ||
    (window as unknown as Record<string, unknown>).SpeechRecognition;

  if (!SpeechRecognition) {
    onError('Голосовой ввод не поддерживается в этом браузере');
    return () => {};
  }

  const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
  recognition.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const text = event.results[0]?.[0]?.transcript;
    if (text) onResult(text);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error !== 'aborted') onError('Не удалось распознать речь');
  };

  recognition.start();
  return () => recognition.abort();
}
