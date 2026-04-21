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
      const cloud = await cloudLoad(user.id);
      if (cancelled) return;
      // Read fresh local data from localStorage (not stale closure values)
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
    if (meta) meta.setAttribute('content', '#FAFAF8');
  }, []);

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
    // Show auth prompt for unauthenticated first-time users
    if (!user && !localStorage.getItem('entprep_auth_prompted')) {
      setShowAuthPrompt(true);
    }
  }, [user]);

  const resetProfile = useCallback(() => {
    setProf([]);
  }, []);

  const finishOnboarding = useCallback(() => {
    localStorage.setItem('entprep_onboarded', '1');
    setShowOnboarding(false);
  }, []);

  const finishAuthPrompt = useCallback(() => {
    localStorage.setItem('entprep_auth_prompted', '1');
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
