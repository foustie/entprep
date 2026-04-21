import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { setUser as setSentryUser } from '../config/sentry';
import { getMyProfile } from '../utils/socialHelpers';
import type { AuthUser, Profile } from '../types/index';
import { trackEvent } from '../utils/analytics';
import { ADMIN_EMAILS } from '../config/app';
import { initPurchases, loginPurchases, logoutPurchases, checkPremiumStatus } from '../config/purchases';

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  isPremium: boolean;
  isAdmin: boolean;
  needsNickname: boolean;
  refreshUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nativePremium, setNativePremium] = useState(false);
  const [dbPremium, setDbPremium] = useState(false);

  // Check subscriptions table (authoritative source, RLS allows reading own row)
  const checkSubscription = useCallback(async (userId: string) => {
    if (!supabase) return false;
    try {
      const { data } = await supabase.from('subscriptions')
        .select('is_active, expires_at')
        .eq('user_id', userId)
        .single();
      if (!data) return false;
      return data.is_active && (!data.expires_at || new Date(data.expires_at) > new Date());
    } catch (err) {
      console.error('checkSubscription error:', err);
      return false; // table may not exist yet — graceful fallback
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    try {
      const p = await getMyProfile();
      setProfile(p);
    } catch (err) {
      console.error('refreshProfile error:', err);
      // Profile fetch failed — will retry on next auth change
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    setUser((session?.user as AuthUser) ?? null);
  }, []);

  // Initialize RevenueCat on mount
  useEffect(() => {
    initPurchases().catch((err) => console.error('initPurchases failed:', err));
  }, []);

  // Single useEffect for all auth — trust Supabase's built-in autoRefreshToken
  // IMPORTANT: Do NOT call refreshSession() manually — it can consume the one-time
  // refresh token. If Supabase's internal refresh fails (token already used/expired),
  // it calls _removeSession() which deletes the session from localStorage and fires
  // SIGNED_OUT. This was the root cause of users being logged out on every reload.
  // Supabase auth-js already handles:
  //   - Auto-refresh via setInterval (AUTO_REFRESH_TICK_DURATION_MS = 30s)
  //   - Visibility change handler (refreshes when tab regains focus)
  //   - Session recovery from localStorage on init (_recoverAndRefresh)
  useEffect(() => {
    if (!supabase) return;

    // onAuthStateChange is the SOLE source of truth for auth state.
    // It fires INITIAL_SESSION once initialization completes (with session or null),
    // then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED as events occur.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = (session?.user as AuthUser) ?? null;
      setUser(u);
      setSentryUser(u?.id ?? null);

      if (u) {
        refreshProfile();
        checkSubscription(u.id).then(setDbPremium).catch(() => setDbPremium(false));
        try {
          await loginPurchases(u.id, u.email ?? undefined);
          const hasPremium = await checkPremiumStatus();
          setNativePremium(hasPremium);
        } catch (err) {
          console.error('RevenueCat login/check failed:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        // Only clear state on explicit SIGNED_OUT, not on INITIAL_SESSION with null
        setProfile(null);
        setDbPremium(false);
        setNativePremium(false);
        logoutPurchases().catch((err) => console.error('logoutPurchases failed:', err));
        // Clear session data to prevent bleed between users on same device
        try { sessionStorage.removeItem('entprep_challenge'); sessionStorage.removeItem('entprep_tutor_init'); } catch {}
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && u) {
        // Distinguish signup (new user, created <5min ago) from login (returning user).
        // 5-min window tolerates slow OAuth redirects (Google/Apple can take 30-60s on mobile).
        // Per-user localStorage flag prevents double-firing on OAuth redirect chains.
        // INITIAL_SESSION covers OAuth flows where user closes tab before SIGNED_IN fires.
        const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;
        const isNewUser = createdAt > 0 && (Date.now() - createdAt) < 300_000;
        const signupKey = `entprep_signup_tracked_${u.id}`;
        if (isNewUser && !localStorage.getItem(signupKey)) {
          localStorage.setItem(signupKey, '1');
          trackEvent('signup_completed', { provider: u.app_metadata?.provider || 'unknown' });
        } else if (event === 'SIGNED_IN') {
          // Only track Login for explicit sign-in action. INITIAL_SESSION = session restoration, not login.
          trackEvent('Login');
        }
      }
    });

    return () => { subscription.unsubscribe(); };
  }, [refreshProfile, checkSubscription]);

  const isAdmin = useMemo(() => !!user?.email && ADMIN_EMAILS.includes(user.email), [user]);
  const needsNickname = useMemo(() => !!profile && profile.nickname.startsWith('user_'), [profile]);

  const FREE_PREMIUM = false as boolean;
  const isPremium = useMemo(() => {
    if (FREE_PREMIUM || isAdmin || nativePremium || dbPremium) return true;
    // Fallback to user_metadata (cache, not authoritative)
    const meta = user?.user_metadata;
    if (!meta || !meta.is_premium) return false;
    const until = meta.premium_until;
    if (typeof until !== 'string') return false;
    return new Date(until) > new Date();
  }, [FREE_PREMIUM, user, isAdmin, nativePremium, dbPremium]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, isPremium, isAdmin, needsNickname, refreshUser, refreshProfile }),
    [user, profile, isPremium, isAdmin, needsNickname, refreshUser, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
