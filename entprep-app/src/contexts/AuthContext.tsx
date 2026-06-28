import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  /** True between sign-in and the first resolution of the subscription check.
   * While true, premium status is not yet known — callers must NOT treat the user
   * as free (e.g. the test-start paywall defers until this settles). */
  premiumLoading: boolean;
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
  // Tracks whether the subscription check has resolved at least once for the
  // current user. Drives `premiumLoading` so the test-start gate never bounces a
  // (possibly premium) user to the paywall during the async load window.
  const [premiumChecked, setPremiumChecked] = useState(false);
  // Same idea for the RevenueCat native check — on web it's an instant no-op, on native it
  // resolves a beat later. premiumLoading waits for BOTH so a native subscriber (premium only
  // in RC, not the DB) isn't briefly bounced to the paywall before RC settles.
  const [nativeChecked, setNativeChecked] = useState(false);

  // Check subscriptions table (authoritative source, RLS allows reading own row).
  // maybeSingle() — return null on 0 rows instead of throwing, since most users
  // are free-tier and have no subscription row at all.
  const checkSubscription = useCallback(async (userId: string) => {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.from('subscriptions')
        .select('is_active, expires_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('checkSubscription error:', error);
        return false;
      }
      if (!data) return false;
      return data.is_active && (!data.expires_at || new Date(data.expires_at) > new Date());
    } catch (err) {
      console.error('checkSubscription threw:', err);
      return false;
    }
  }, []);

  // Guard against race conditions — onAuthStateChange can fire INITIAL_SESSION →
  // SIGNED_IN → TOKEN_REFRESHED rapidly. Without a token, 3 parallel retry loops
  // (9 /api/social requests) fight over setProfile(). Each new refresh cancels
  // the previous in-flight cycle.
  const refreshTokenRef = useRef(0);
  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const myToken = ++refreshTokenRef.current;
    // Retry 2x with exponential backoff — /api/social can 503 under Supabase pool pressure.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const p = await getMyProfile();
        if (refreshTokenRef.current !== myToken) return; // superseded
        setProfile(p);
        return;
      } catch (err) {
        if (refreshTokenRef.current !== myToken) return; // superseded
        if (attempt === 2) {
          console.error('refreshProfile failed after 3 attempts:', err);
          return;
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
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
        checkSubscription(u.id)
          .then(setDbPremium)
          .catch(() => setDbPremium(false))
          .finally(() => setPremiumChecked(true));
        try {
          await loginPurchases(u.id, u.email ?? undefined);
          const hasPremium = await checkPremiumStatus();
          setNativePremium(hasPremium);
        } catch (err) {
          console.error('RevenueCat login/check failed:', err);
        } finally {
          setNativeChecked(true);
        }
      } else if (event === 'SIGNED_OUT') {
        // Only clear state on explicit SIGNED_OUT, not on INITIAL_SESSION with null
        setProfile(null);
        setDbPremium(false);
        setNativePremium(false);
        setPremiumChecked(false);
        setNativeChecked(false);
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

  // Post-checkout refresh: when the user comes back from the Lemon Squeezy
  // checkout tab (or refocuses the app), re-check subscription status so the
  // newly-granted premium becomes visible without a hard reload.
  // Webhook activates premium server-side, but onAuthStateChange doesn't fire
  // for a tab regaining focus — without this, users see "still free" until login.
  useEffect(() => {
    if (!supabase || !user) return;
    let lastCheck = Date.now();
    const REFRESH_THROTTLE_MS = 5_000;
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastCheck < REFRESH_THROTTLE_MS) return;
      lastCheck = now;
      checkSubscription(user.id).then(setDbPremium).catch(() => {});
      checkPremiumStatus().then(setNativePremium).catch(() => {});
    };
    document.addEventListener('visibilitychange', maybeRefresh);
    window.addEventListener('focus', maybeRefresh);
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh);
      window.removeEventListener('focus', maybeRefresh);
    };
  }, [user, checkSubscription]);

  const isAdmin = useMemo(() => !!user?.email && ADMIN_EMAILS.includes(user.email), [user]);
  const needsNickname = useMemo(() => !!profile && profile.nickname.startsWith('user_'), [profile]);

  const FREE_PREMIUM = false as boolean;
  // PAY-3: premium is derived only from authoritative sources. The previous
  // user_metadata.is_premium fallback was client-writable (supabase.auth.updateUser),
  // letting any user self-grant Premium — removed.
  const isPremium = useMemo(
    () => FREE_PREMIUM || isAdmin || nativePremium || dbPremium,
    [FREE_PREMIUM, isAdmin, nativePremium, dbPremium],
  );
  // A signed-in user whose subscription check hasn't resolved yet. Admins are known
  // synchronously from the email, so they're never considered "loading".
  const premiumLoading = useMemo(
    () => !!user && !isAdmin && !(premiumChecked && nativeChecked),
    [user, isAdmin, premiumChecked, nativeChecked],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, isPremium, premiumLoading, isAdmin, needsNickname, refreshUser, refreshProfile }),
    [user, profile, isPremium, premiumLoading, isAdmin, needsNickname, refreshUser, refreshProfile],
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
