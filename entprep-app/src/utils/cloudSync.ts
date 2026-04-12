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

export async function cloudLoad(userId: string): Promise<CloudData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('hist, prof, st')
    .eq('id', userId)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) { captureError(error, { context: 'cloudLoad' }); return null; }
  const raw = data as { hist: TestResult[]; prof: string[]; st: Settings & { srCards?: SRCard[] } };
  // Unpack srCards from st field
  const srCards = raw.st?.srCards || [];
  const st = { ...raw.st };
  delete (st as Record<string, unknown>).srCards;
  return { hist: raw.hist, prof: raw.prof, st, srCards };
}

export async function cloudSave(userId: string, { hist, prof, st, srCards }: CloudData): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no supabase' };
  // Pack srCards into st field to avoid schema changes
  const stWithSr = srCards && srCards.length > 0 ? { ...st, srCards } : st;
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, hist, prof, st: stWithSr, updated_at: new Date().toISOString() });
  if (error) { captureError(error, { context: 'cloudSave' }); return { ok: false, error: error.message }; }

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

export function mergeData(local: CloudData | null, cloud: CloudData | null): CloudData {
  if (!cloud) return local!;
  if (!local) return cloud;

  // LOCAL first — local data is fresher and takes priority on dedup collisions
  const allHist = [...(local.hist || []), ...(cloud.hist || [])];

  // Dedup with COUNTER — same key can appear multiple times legitimately
  // (user takes same subject twice with same score on same day)
  const keyCount = new Map<string, number>();
  const hist = allHist.filter(h => {
    // Include index-like uniqueness: use qd length or tm (time taken) for extra differentiation
    const qdLen = Array.isArray(h.qd) ? h.qd.length : 0;
    const key = `${h.dt}_${h.su}_${h.sc}_${h.tm ?? ''}_${h.tp ?? ''}_${h.co ?? ''}_${h.to ?? ''}_${qdLen}`;
    const count = keyCount.get(key) || 0;
    // Allow up to 10 tests with identical keys per day (generous limit)
    if (count >= 10) return false;
    keyCount.set(key, count + 1);
    return true;
  });

  // Safety: NEVER lose local data. If merge somehow produced fewer entries, keep local.
  const localHist = local.hist || [];
  if (hist.length < localHist.length) {
    // Merge lost data — fallback to local + any cloud-only entries
    const localKeys = new Set(localHist.map(h => JSON.stringify({ dt: h.dt, su: h.su, sc: h.sc, co: h.co, to: h.to, tm: h.tm })));
    const cloudOnly = (cloud.hist || []).filter(h =>
      !localKeys.has(JSON.stringify({ dt: h.dt, su: h.su, sc: h.sc, co: h.co, to: h.to, tm: h.tm }))
    );
    captureError(new Error(`mergeData lost entries: local=${localHist.length} merged=${hist.length}`), { context: 'mergeData.safety' });
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
