import { supabase } from '../config/supabase';
import type { TestResult, Settings, SRCard } from '../types/index';
import { syncProfileStats } from './socialHelpers';
import { calcTotalXP, getLevel } from './xpHelpers';
import { calcStreak } from './adaptiveHelpers';
import { mergeSrCards } from './srEngine';
import { captureError } from '../config/sentry';

interface CloudData {
  hist: TestResult[];
  prof: string[];
  st: Settings;
  srCards?: SRCard[];
}

export type CloudLoadResult =
  | { status: 'ok'; data: CloudData }
  | { status: 'empty' } // user has no cloud record yet (first-time signin)
  | { status: 'failed'; error: string }; // network / 503 / RLS — MUST NOT overwrite cloud with local

/**
 * Load cloud user_data with retry. Distinguishes "no data" (PGRST116) from network/503 failure.
 * CRITICAL: callers MUST check status === 'failed' and skip cloudSave, otherwise a
 * new device with empty local state will wipe existing cloud data on sync.
 */
export async function cloudLoad(userId: string): Promise<CloudLoadResult> {
  if (!supabase) return { status: 'failed', error: 'no supabase' };
  let lastErr: { message?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('user_data')
      .select('hist, prof, st')
      .eq('id', userId)
      .single();
    if (error && error.code === 'PGRST116') return { status: 'empty' };
    if (error) {
      lastErr = error;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const raw = data as { hist: TestResult[]; prof: string[]; st: Settings & { srCards?: SRCard[] } };
    const srCards = raw.st?.srCards || [];
    const st = { ...raw.st };
    delete (st as Record<string, unknown>).srCards;
    return { status: 'ok', data: { hist: raw.hist, prof: raw.prof, st, srCards } };
  }
  const errMsg = lastErr?.message || 'cloudLoad failed';
  captureError(new Error(errMsg), { context: 'cloudLoad.failedAll3Attempts', userId, code: lastErr?.code });
  return { status: 'failed', error: lastErr?.message || 'cloudLoad failed after 3 attempts' };
}

export async function cloudSave(userId: string, { hist, prof, st, srCards }: CloudData): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no supabase' };
  // Pack srCards into st field to avoid schema changes
  const stWithSr = srCards && srCards.length > 0 ? { ...st, srCards } : st;
  // Retry with backoff on transient failures
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from('user_data')
      .upsert({ id: userId, hist, prof, st: stWithSr, updated_at: new Date().toISOString() });
    if (!error) { lastError = undefined; break; }
    lastError = error.message;
    captureError(error, { context: 'cloudSave', attempt });
    if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (lastError) return { ok: false, error: lastError };

  // Also sync XP/level/streak/avatar to profiles table (fire-and-forget)
  try {
    const totalXP = calcTotalXP(hist);
    const { level } = getLevel(totalXP);
    const { current: streak } = calcStreak(hist);
    const avatarUrl = supabase ? (await supabase.auth.getUser()).data.user?.user_metadata?.avatar_url : undefined;
    syncProfileStats(userId, totalXP, level, streak, avatarUrl);
  } catch (e) { captureError(e, { context: 'cloudSave.profileStatsSync' }); }

  return { ok: true };
}

/** Dedup identity for a history entry: a stable id when present, else a composite
 *  of the fields that distinguish genuinely different runs (dt/su/sc/tm/tp/co/to +
 *  answered count). Two array slots with the same key are the SAME run (e.g. one
 *  copy local + one copy from cloud), not two runs. */
function histKey(h: TestResult): string {
  if (h.id) return `id:${h.id}`;
  const qdLen = Array.isArray(h.qd) ? h.qd.length : 0;
  return `k:${h.dt}_${h.su}_${h.sc}_${h.tm ?? ''}_${h.tp ?? ''}_${h.co ?? ''}_${h.to ?? ''}_${qdLen}`;
}

export function mergeData(local: CloudData | null, cloud: CloudData | null): CloudData {
  if (!cloud) return local!;
  if (!local) return cloud;

  // LOCAL first — local data is fresher and takes priority on dedup collisions
  const allHist = [...(local.hist || []), ...(cloud.hist || [])];

  // Dedup by identity (see histKey), keeping the FIRST occurrence. This collapses
  // the SAME run appearing once locally and once from cloud into ONE entry. The
  // prior logic kept up to 10 identical-key copies, so a single run duplicated on
  // every sign-in (2 → 4 → ... → 10). Genuinely-different runs differ in id (new)
  // or in tm/score (legacy), so they survive.
  const seen = new Set<string>();
  const hist = allHist.filter(h => {
    const key = histKey(h);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Safety: NEVER lose a UNIQUE local entry. Compare against the DEDUPED-local
  // count — raw local length would misfire now, because collapsing the local+cloud
  // duplicate makes merged < raw-local the EXPECTED outcome, not data loss.
  const localHist = local.hist || [];
  const uniqLocal = new Set(localHist.map(histKey)).size;
  if (hist.length < uniqLocal) {
    // Genuine loss (should not happen with local-first dedup) — restore local + cloud-only.
    const localKeys = new Set(localHist.map(histKey));
    const cloudOnly = (cloud.hist || []).filter(h => !localKeys.has(histKey(h)));
    captureError(new Error(`mergeData lost entries: uniqLocal=${uniqLocal} merged=${hist.length}`), { context: 'mergeData.safety' });
    return { hist: [...localHist, ...cloudOnly], prof: local.prof || cloud.prof || [], st: { ...(cloud.st || {}), ...(local.st || {}) } as Settings, srCards: mergeSrCards(local.srCards || [], cloud.srCards || []) };
  }

  const prof = (cloud.prof?.length > 0) ? cloud.prof : (local.prof || []);
  const st = { ...(cloud.st || {}), ...(local.st || {}) } as Settings;
  if (!st.exp && st.exp !== false) st.exp = true;
  if (!st.tmr && st.tmr !== false) st.tmr = true;
  if (!st.shf && st.shf !== false) st.shf = true;
  const srCards = mergeSrCards(local.srCards || [], cloud.srCards || []);
  return { hist, prof, st, srCards };
}
