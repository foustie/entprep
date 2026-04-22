import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { loadData, saveData } from '../utils/storage';
import { cloudLoad, cloudSave, mergeData } from '../utils/cloudSync';
import { useAuth } from './AuthContext';
import { addWrongAnswers } from '../utils/srEngine';
import type { TestResult, Settings, GoalSettings, SRCard } from '../types/index';

interface AppContextValue {
  hist: TestResult[];
  prof: string[];
  st: Settings;
  srCards: SRCard[];
  syncError: string | null;
  showOnboarding: boolean;
  showAuthPrompt: boolean;
  addHist: (result: TestResult) => void;
  clearHist: () => void;
  updSt: (newSt: Settings) => void;
  confirmProfile: (sel: string[], goal?: GoalSettings) => void;
  resetProfile: () => void;
  finishOnboarding: () => void;
  finishAuthPrompt: () => void;
  addSrFromResult: (result: TestResult) => void;
  setSrCards: React.Dispatch<React.SetStateAction<SRCard[]>>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Auth prompt re-trigger logic — previously a boolean flag silenced prompt forever
// after first skip. Now we track attempts and re-show when engagement signals rise
// (more tests done) or enough time has passed. Caps at MAX_AUTH_PROMPTS to avoid harassment.
interface AuthPromptState {
  count: number;          // how many times prompt has been shown
  lastShownAt: number;    // unix ms of last display
  testsAtSkip: number;    // hist.length when user last skipped
}
const AUTH_PROMPT_KEY = 'entprep_auth_prompted';
const MAX_AUTH_PROMPTS = 4;               // initial + 3 re-prompts
const RETRIGGER_TESTS_DELTA = 3;          // show again after N more tests completed
const RETRIGGER_DAYS_DELTA = 3;           // ...or N days since last prompt

function loadAuthPromptState(): AuthPromptState | null {
  try {
    const raw = localStorage.getItem(AUTH_PROMPT_KEY);
    if (!raw) return null;
    // Legacy value: bare '1' written before re-trigger logic existed.
    // Treat as "shown once, long ago, at 0 tests" — engaged users will re-qualify.
    if (raw === '1') return { count: 1, lastShownAt: 0, testsAtSkip: 0 };
    const parsed = JSON.parse(raw) as Partial<AuthPromptState>;
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 1,
      lastShownAt: typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : 0,
      testsAtSkip: typeof parsed.testsAtSkip === 'number' ? parsed.testsAtSkip : 0,
    };
  } catch {
    return null;
  }
}

function recordAuthPromptSkip(histLength: number) {
  const prev = loadAuthPromptState();
  const next: AuthPromptState = {
    count: (prev?.count ?? 0) + 1,
    lastShownAt: Date.now(),
    testsAtSkip: histLength,
  };
  try { localStorage.setItem(AUTH_PROMPT_KEY, JSON.stringify(next)); } catch {}
}

function shouldReTriggerAuthPrompt(state: AuthPromptState, histLength: number): boolean {
  if (state.count >= MAX_AUTH_PROMPTS) return false;
  const testsSince = histLength - state.testsAtSkip;
  if (testsSince >= RETRIGGER_TESTS_DELTA) return true;
  const daysSince = (Date.now() - state.lastShownAt) / 86400000;
  // Day-based re-trigger still requires at least one test after skip — don't pester idle users
  if (daysSince >= RETRIGGER_DAYS_DELTA && testsSince >= 1) return true;
  return false;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [hist, setHist] = useState<TestResult[]>(() => loadData()?.hist || []);
  const [prof, setProf] = useState<string[]>(() => loadData()?.prof || []);
  const [st, setSt] = useState<Settings>(() => loadData()?.st || { exp: true, tmr: true, shf: true });
  const [srCards, setSrCards] = useState<SRCard[]>(() => loadData()?.srCards || []);
  // Onboarding removed — Landing page already covers the same content.
  // Keeping the state/callbacks to avoid breaking type contracts.
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const syncedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const debouncedCloudSave = useCallback((userId: string, _data: { hist: TestResult[]; prof: string[]; st: Settings; srCards?: SRCard[] }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      // Read fresh data from localStorage to avoid stale closure
      const fresh = loadData();
      const data = fresh ? { hist: fresh.hist || [], prof: fresh.prof || [], st: fresh.st || _data.st, srCards: fresh.srCards || _data.srCards || [] } : _data;
      const result = await cloudSave(userId, data);
      if (!result.ok) setSyncError(result.error ?? null);
      else setSyncError(null);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!user) {
      syncedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await cloudLoad(user.id);
      if (cancelled) return;
      // CRITICAL: if cloudLoad FAILED (network/503), do NOT save local over cloud —
      // a fresh device with empty localStorage would wipe the user's entire history.
      // Only sync when we definitively know the cloud state (ok or empty).
      if (result.status === 'failed') {
        setSyncError(result.error);
        syncedRef.current = false;
        return;
      }
      const cloud = result.status === 'ok' ? result.data : null;
      const stored = loadData();
      const local = { hist: stored?.hist || [], prof: stored?.prof || [], st: stored?.st || { exp: true, tmr: true, shf: true }, srCards: stored?.srCards || [] };
      const merged = mergeData(local, cloud);
      setHist(merged.hist);
      setProf(merged.prof);
      setSt(merged.st);
      setSrCards(merged.srCards || []);
      syncedRef.current = true;
      await cloudSave(user.id, merged);
    })();
    return () => { cancelled = true; };
  }, [user]);  

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', st.theme === 'dark' ? '#0B0B12' : '#FAFAF8');
  }, [st.theme]);

  useEffect(() => {
    saveData({ hist, st, prof, srCards, lastLogin: new Date().toISOString() });
    if (user && syncedRef.current) debouncedCloudSave(user.id, { hist, prof, st, srCards });
  }, [hist, st, prof, srCards]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state from other tabs writing to localStorage
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'entprep_data' || !e.newValue) return;
      try {
        const fresh = JSON.parse(e.newValue) as { hist?: TestResult[]; prof?: string[]; st?: Settings; srCards?: SRCard[] };
        if (fresh.hist) setHist(fresh.hist);
        if (fresh.prof) setProf(fresh.prof);
        if (fresh.st) setSt(fresh.st);
        if (fresh.srCards) setSrCards(fresh.srCards);
      } catch { /* ignore malformed data */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addHist = useCallback((result: TestResult) => {
    // Strip _leaderboard before persisting — it's only used for server submission
    const { _leaderboard: _, ...clean } = result;
    setHist(prev => [...prev, clean]);
  }, []);

  const clearHist = useCallback(() => {
    setHist([]);
  }, []);

  const addSrFromResult = useCallback((result: TestResult) => {
    setSrCards(prev => addWrongAnswers(prev, result));
  }, []);

  const updSt = useCallback((newSt: Settings) => {
    setSt(newSt);
  }, []);

  const confirmProfile = useCallback((sel: string[], goal?: GoalSettings) => {
    setProf(sel);
    // Save immediately to localStorage so it persists even if app is closed before useEffect fires
    try {
      const current = loadData();
      const currentSt = current?.st || { exp: true, tmr: true, shf: true };
      const newSt = goal ? { ...currentSt, goal } : currentSt;
      if (goal) setSt(newSt);
      saveData({ hist: current?.hist || [], st: newSt, prof: sel, lastLogin: new Date().toISOString() });
    } catch {}
    // Show auth prompt for unauthenticated first-time users (no prior state = never shown)
    if (!user && loadAuthPromptState() === null) {
      setShowAuthPrompt(true);
    }
  }, [user]);

  // Re-trigger auth prompt on engagement — engaged users who skipped initial prompt
  // should see it again after 3 more tests OR 3+ days (with ≥1 test). Capped at
  // MAX_AUTH_PROMPTS total to avoid harassment. Fixes lifecycle leak where the old
  // boolean flag silenced the prompt forever after a single skip.
  useEffect(() => {
    // User just signed in (via OAuth redirect or native flow) — always dismiss the prompt.
    // Without this guard, a re-triggered prompt that was still visible when the auth
    // callback lands would leave the user stuck on the auth screen after successful login.
    if (user) {
      if (showAuthPrompt) setShowAuthPrompt(false);
      return;
    }
    if (showAuthPrompt) return; // already showing — don't double-fire
    const state = loadAuthPromptState();
    if (!state) return; // first-time path handled in confirmProfile
    if (shouldReTriggerAuthPrompt(state, hist.length)) {
      setShowAuthPrompt(true);
    }
  }, [user, showAuthPrompt, hist.length]);

  const resetProfile = useCallback(() => {
    setProf([]);
  }, []);

  const finishOnboarding = useCallback(() => {
    localStorage.setItem('entprep_onboarded', '1');
    setShowOnboarding(false);
  }, []);

  const finishAuthPrompt = useCallback(() => {
    // Read hist.length via functional setHist to avoid adding it as a dep —
    // otherwise finishAuthPrompt rebuilds on every test completion, cascading
    // through context value → all consumers re-render.
    setHist(h => { recordAuthPromptSkip(h.length); return h; });
    setShowAuthPrompt(false);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      hist, prof, st, srCards, syncError,
      showOnboarding, showAuthPrompt,
      addHist, clearHist, updSt,
      confirmProfile, resetProfile,
      finishOnboarding, finishAuthPrompt,
      addSrFromResult, setSrCards,
    }),
    [hist, prof, st, srCards, syncError, showOnboarding, showAuthPrompt, addHist, clearHist, updSt, confirmProfile, resetProfile, finishOnboarding, finishAuthPrompt, addSrFromResult],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
