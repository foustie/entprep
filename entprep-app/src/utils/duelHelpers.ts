// Client-side helpers for 1v1 duels: API calls, Realtime subscriptions, invite URLs

import { supabase } from '../config/supabase';
import { APP_URL, API_BASE } from '../config/app';
import type { DuelQuestion, DuelState, Profile } from '../types/index';

// ── API call helper ──────────────────────────────────────────────────────────

async function duelAPI<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/duel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

// ── Duel Actions ─────────────────────────────────────────────────────────────

export interface CreateDuelResult {
  duel_id: number;
  code: string;
  questions: DuelQuestion[];
  creator_profile: Profile | null;
}

export async function createDuel(subject: string): Promise<CreateDuelResult> {
  return duelAPI<CreateDuelResult>('create_duel', { subject });
}

export interface JoinDuelResult {
  duel_id: number;
  subject: string;
  questions: DuelQuestion[];
  creator_profile: Profile | null;
  opponent_profile: Profile | null;
}

export async function joinDuel(code: string): Promise<JoinDuelResult> {
  return duelAPI<JoinDuelResult>('join_duel', { code });
}

export interface SubmitAnswerResult {
  correct: boolean;
  correct_answer: number;
  your_score: number;
  done: boolean;
}

export async function submitAnswer(duelId: number, questionIndex: number, answer: number | null): Promise<SubmitAnswerResult> {
  return duelAPI<SubmitAnswerResult>('submit_answer', {
    duel_id: duelId,
    question_index: questionIndex,
    answer,
  });
}

export interface GetDuelResult {
  duel: DuelState;
  questions: DuelQuestion[];
  creator_profile: Profile | null;
  opponent_profile: Profile | null;
}

export async function getDuel(duelId: number): Promise<GetDuelResult> {
  return duelAPI<GetDuelResult>('get_duel', { duel_id: duelId });
}

export async function forfeitDuel(duelId: number): Promise<void> {
  await duelAPI('forfeit', { duel_id: duelId });
}

// ── Realtime subscription ────────────────────────────────────────────────────
// Uses Realtime as notification-only: when a change is detected, fetches
// safe data via the API instead of trusting the raw Realtime payload
// (which contains question_ids and full answer maps).

export type DuelRealtimeCallback = (payload: DuelState) => void;

export function subscribeToDuel(duelId: number, callback: DuelRealtimeCallback): () => void {
  if (!supabase) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const fetchAndNotify = () => {
    if (destroyed) return;
    getDuel(duelId)
      .then((res) => {
        if (!destroyed) callback(res.duel as unknown as DuelState);
      })
      .catch(() => {
        // Silently ignore — polling fallback will cover gaps
      });
  };

  const channel = supabase
    .channel(`duel-${duelId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'duels',
        filter: `id=eq.${duelId}`,
      },
      () => {
        // Debounce: avoid hammering the API on rapid successive updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchAndNotify, 500);
      }
    )
    .subscribe();

  return () => {
    destroyed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    supabase!.removeChannel(channel);
  };
}

// ── Invite URL ───────────────────────────────────────────────────────────────

export function buildDuelInviteUrl(code: string): string {
  return `${APP_URL}?duel=${code}`;
}

export function parseDuelInviteParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('duel');
}
