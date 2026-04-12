// Client-side helpers for Arena: API calls, Realtime, invite URLs

import { supabase } from '../config/supabase';
import { APP_URL, API_BASE } from '../config/app';
import type { DuelQuestion } from '../types/index';

// ── Types ──

export interface ArenaPlayer {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  score: number;
  answered_current?: boolean;
}

export interface ArenaState {
  id: number;
  code: string;
  status: string;
  subject: string;
  host_id: string;
  current_question: number;
  question_count: number;
  question_started_at: string | null;
}

export interface CreateArenaResult {
  arena_id: number;
  code: string;
  questions: DuelQuestion[];
}

export interface JoinArenaResult {
  arena_id: number;
  code: string;
  subject: string;
  question_count: number;
  host_id: string;
  questions: DuelQuestion[];
  players: ArenaPlayer[];
}

export interface SubmitArenaAnswerResult {
  correct: boolean;
  correct_answer: number;
  points: number;
  speed_bonus: number;
  your_score: number;
  elapsed: number;
}

export interface CheckAdvanceResult {
  status: string;
  leaderboard?: ArenaPlayer[];
  answered?: number;
  total?: number;
}

export interface GetArenaStateResult {
  arena: ArenaState;
  players: ArenaPlayer[];
}

// ── API helper ──

async function arenaAPI<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/arena`, {
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

// ── Actions ──

export async function createArena(subject: string, questionCount: number = 10): Promise<CreateArenaResult> {
  return arenaAPI<CreateArenaResult>('create_arena', { subject, question_count: questionCount });
}

export async function joinArena(code: string): Promise<JoinArenaResult> {
  return arenaAPI<JoinArenaResult>('join_arena', { code });
}

export async function startArena(arenaId: number): Promise<{ ok: boolean }> {
  return arenaAPI<{ ok: boolean }>('start_arena', { arena_id: arenaId });
}

export async function submitArenaAnswer(arenaId: number, questionIndex: number, answer: number | null): Promise<SubmitArenaAnswerResult> {
  return arenaAPI<SubmitArenaAnswerResult>('submit_answer', { arena_id: arenaId, question_index: questionIndex, answer });
}

export async function checkAdvance(arenaId: number): Promise<CheckAdvanceResult> {
  return arenaAPI<CheckAdvanceResult>('check_advance', { arena_id: arenaId });
}

export async function getArenaState(arenaId: number): Promise<GetArenaStateResult> {
  return arenaAPI<GetArenaStateResult>('get_state', { arena_id: arenaId });
}

// ── Realtime ──

export function subscribeToArena(arenaId: number, callback: (status: string) => void): () => void {
  if (!supabase) return () => {};

  let destroyed = false;

  const channel = supabase
    .channel(`arena-${arenaId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'arenas',
        filter: `id=eq.${arenaId}`,
      },
      (payload) => {
        if (!destroyed && payload.new?.status) {
          callback(payload.new.status as string);
        }
      }
    )
    .subscribe();

  return () => {
    destroyed = true;
    supabase!.removeChannel(channel);
  };
}

// ── Invite URL ──

export function buildArenaInviteUrl(code: string): string {
  return `${APP_URL}?arena=${code}`;
}

export function parseArenaInviteParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('arena');
}
