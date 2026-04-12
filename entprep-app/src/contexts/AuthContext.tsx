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
    } catch {
      return false; // table may not exist yet — graceful fallback
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    try {
      const p = await getMyProfile();
      setProfile(p);
    } catch {
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
    initPurchases().catch(() => {});
  }, []);

  // Eagerly restore session on mount (before onAuthStateChange fires)
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as AuthUser);
        refreshProfile();
        checkSubscription(session.user.id).then(setDbPremium).catch(() => {});
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabase) return;
    // Force-refresh session when tab regains focus — getSession() only reads stale localStorage,
    // refreshSession() actually exchanges refresh_token for new JWT on the server.
    // This is the fix for "users getting kicked out after backgrounding tab".
    const handleFocus = () => {
      supabase!.auth.refreshSession().then(({ data: { session: s } }) => {
        if (s?.user) setUser(s.user as AuthUser);
      }).catch(() => {
        // Refresh truly failed (refresh_token expired or revoked) — read whatever is left
        supabase!.auth.getSession().then(({ data: { session: s } }) => {
          setUser((s?.user as AuthUser) ?? null);
        }).catch(() => {});
      });
    };
    window.addEventListener('focus', handleFocus);

    // Periodic heartbeat: refresh token every 30 min even if tab stays active.
    // Supabase JWT defaults to 1h — refresh at 30min gives buffer.
    const heartbeat = setInterval(() => {
      supabase!.auth.refreshSession().then(({ data: { session: s } }) => {
        // If refresh returned no session, user was logged out server-side
        if (!s) setUser(null);
      }).catch(() => {
        // Network error or token truly dead — don't force logout (might be offline)
      });
    }, 30 * 60 * 1000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      let u = (session?.user as AuthUser) ?? null;
      // Fetch fresh user_metadata from server (session JWT may have stale metadata)
      if (u && event !== 'SIGNED_OUT') {
        try {
          const { data } = await supabase!.auth.getUser();
          if (data.user) u = data.user as AuthUser;
        } catch { /* use session user as fallback */ }
      }
      setUser(u);
      setSentryUser(u?.id ?? null);
      if (u) {
        refreshProfile();
        // Check subscriptions table (authoritative)
        checkSubscription(u.id).then(setDbPremium).catch(() => setDbPremium(false));
        // Link RevenueCat user and check entitlements
        try {
          await loginPurchases(u.id, u.email ?? undefined);
          const hasPremium = await checkPremiumStatus();
          setNativePremium(hasPremium);
        } catch {
          // RC not available (web) — nativePremium stays false
        }
      } else {
        setProfile(null);
        setDbPremium(false);
        setNativePremium(false);
        logoutPurchases().catch(() => {});
      }
      if (event === 'SIGNED_IN') trackEvent('Login');
    });
    return () => { subscription.unsubscribe(); window.removeEventListener('focus', handleFocus); clearInterval(heartbeat); };
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
