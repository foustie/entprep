import React, { Suspense, useEffect, useRef, useState } from "react";
import { TOTAL_Q } from './config/questionPools';
import { prefetchCounts, getTotalQ, prefetchSubjects } from './utils/questionStore';
import { GLOBAL_STYLES, LAYOUT, COLORS, FF } from './constants/styles';
import { LIGHT, DARK, themeToCss } from './constants/themes';
import { SCREENS } from './constants/screens';
import { useBreakpoint } from './hooks/useBreakpoint';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';
import { NavigationProvider, useNav } from './contexts/NavigationContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { useT } from './locales';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { Home as HomeIcon, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ProfileSelect from './components/ProfileSelect';
import CoachHome from './components/CoachHome';
import ProfileTab from './components/ProfileTab';
import SubjectDetail from './components/SubjectDetail';
import Challenge from './components/Challenge';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import UpdatePrompt from './components/UpdatePrompt';
import { API_BASE } from './config/app';
import { supabase } from './config/supabase';
import { useAuth } from './contexts/AuthContext';
import { trackEvent } from './utils/analytics';
import type { TestResult, SRCard } from './types';

const submitLeaderboard = async (result: TestResult) => {
  if (!supabase || result.type === 'fullent') return;
  try {
    const session = await supabase.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) return;
    const lb = result._leaderboard;
    if (!lb) return; // No verification data available
    await fetch(`${API_BASE}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        subject: result.su,
        question_indices: lb.question_indices,
        answers: lb.answers,
      }),
    });
  } catch { /* silently fail */ }
};

const Test = React.lazy(() => import('./components/Test'));
const FullENT = React.lazy(() => import('./components/FullENT'));
const Calc = React.lazy(() => import('./components/Calc'));
const ErrorReview = React.lazy(() => import('./components/ErrorReview'));
const Admin = React.lazy(() => import('./components/Admin'));
const Leaderboard = React.lazy(() => import('./components/Leaderboard'));
const Friends = React.lazy(() => import('./components/Friends'));
const Duel = React.lazy(() => import('./components/Duel'));
const ReviewSession = React.lazy(() => import('./components/ReviewSession'));
const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const Progress = React.lazy(() => import('./components/Progress'));
const Settings = React.lazy(() => import('./components/Settings'));
const Adaptive = React.lazy(() => import('./components/Adaptive'));
const Landing = React.lazy(() => import('./components/Landing'));
const AuthPrompt = React.lazy(() => import('./components/AuthPrompt'));
const PaywallModal = React.lazy(() => import('./components/PaywallModal'));
const PushPrompt = React.lazy(() => import('./components/PushPrompt'));
const AiTutor = React.lazy(() => import('./components/AiTutor'));

interface NavItem {
  id: string;
  key: 'home' | 'profile';
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", key: "home", Icon: HomeIcon },
  { id: "profile_tab", key: "profile", Icon: User },
];

function AppContent() {
  const { screen, curSub, selTopic, customQs, tab, challengeData, paywallReason, nav, goHome, changeTab, setScreen, setTab, closePaywall } = useNav();
  const { hist, prof, st, srCards, syncError, showAuthPrompt, addHist, confirmProfile, finishAuthPrompt, addSrFromResult, setSrCards } = useApp();
  const toast = useToast();
  const tr = useT();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  const isDark = st.theme === 'dark';
  const palette = isDark ? DARK : LIGHT;

  useEffect(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 400);
    }
  }, []);

  // Dynamic document.title per screen
  useEffect(() => {
    const SCREEN_TITLES: Record<string, string> = {
      [SCREENS.HOME]: tr.tabs.home,
      [SCREENS.PROFILE]: tr.tabs.profile,
      [SCREENS.SUBJECT]: tr.tabs.subjects,
      [SCREENS.TEST]: tr.tabs.subjects,
      [SCREENS.CHALLENGE]: tr.duel.title,
      [SCREENS.FULL_ENT]: tr.fullent.title,
      [SCREENS.CALC]: tr.calc.title,
      [SCREENS.PROGRESS]: tr.progress.title,
      [SCREENS.SETTINGS]: tr.settings.title,
      [SCREENS.ADAPTIVE]: tr.adaptive.title,
      [SCREENS.ERROR_REVIEW]: tr.errorReview.title,
      [SCREENS.ADMIN]: 'Admin',
      [SCREENS.LEADERBOARD]: tr.leaderboard.title,
      [SCREENS.FRIENDS]: tr.friends.title,
      [SCREENS.DUEL]: tr.duel.title,
      [SCREENS.REVIEW]: tr.review.title,
      [SCREENS.TEACHER]: tr.teacher.panel,
      profile_tab: tr.tabs.profile,
      tutor: 'AI Tutor',
    };
    const title = SCREEN_TITLES[screen];
    document.title = title ? `${title} — ENTprep` : 'ENTprep — Бесплатная подготовка к ЕНТ';
    if (screen) trackEvent('Screen View', { screen });
  }, [screen, tr]);

  // Sync html lang attribute with app language
  useEffect(() => {
    document.documentElement.lang = st.lang === 'kk' ? 'kk' : 'ru';
  }, [st.lang]);

  const [totalQ, setTotalQ] = useState(TOTAL_Q);
  useEffect(() => {
    prefetchCounts().then(ok => { if (ok) setTotalQ(getTotalQ()); });
    // Background prefetch all ENT subjects so Full ENT loads instantly
    setTimeout(() => prefetchSubjects(['math', 'reading', 'history']), 1000);
    setTimeout(() => {
      const profileSubs = JSON.parse(localStorage.getItem('entprep_profile') || '[]');
      if (profileSubs.length > 0) prefetchSubjects(profileSubs);
    }, 3000);
  }, []);

  // Persist UTM params for users who haven't signed in yet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('entprep_utm', JSON.stringify(utm));
    }
    if (Object.keys(utm).length > 0) {
      const url = new URL(window.location.href);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  const prevSyncError = useRef<string | null>(null);
  const mountTime = useRef(Date.now());
  useEffect(() => {
    if (syncError && syncError !== prevSyncError.current) {
      // Suppress sync error toast in first 5s — auth token may not be restored yet
      if (Date.now() - mountTime.current > 5000) {
        toast.warning(tr.auth.syncFailed);
      }
    }
    prevSyncError.current = syncError;
  }, [syncError]); // eslint-disable-line react-hooks/exhaustive-deps

  const needProfile = prof.length === 0 && screen !== SCREENS.PROFILE;
  const showNav = !needProfile && screen !== SCREENS.TEST && screen !== SCREENS.FULL_ENT && screen !== SCREENS.PROFILE && screen !== SCREENS.SUBJECT && screen !== SCREENS.ERROR_REVIEW && screen !== SCREENS.ADMIN && screen !== SCREENS.CHALLENGE && screen !== SCREENS.LEADERBOARD && screen !== SCREENS.FRIENDS && screen !== SCREENS.DUEL && screen !== SCREENS.REVIEW && screen !== SCREENS.TEACHER && !showAuthPrompt;

  const { user, isPremium, needsNickname } = useAuth();

  // PRO welcome toast — show once when user first becomes premium
  useEffect(() => {
    if (!isPremium) return;
    const key = 'entprep_pro_welcomed';
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    toast.success('Спасибо за подписку! PRO активирован');
  }, [isPremium, toast]);

  // Nickname nudge — show once per user after first sign-in when still on default user_xxx.
  // Without this, new users never learn they have an auto-generated ник — Leaderboard/Duel/Friends
  // all show "user_abcd1234" until they explicitly open Settings.
  useEffect(() => {
    if (!user || !needsNickname) return;
    const key = `entprep_nickname_nudged_${user.id}`;
    if (localStorage.getItem(key)) return;
    const msg = tr.settings.chooseNickname || 'Выбери ник — его видят в рейтинге';
    try {
      toast.info(msg, {
        duration: 8000,
        action: () => nav('settings'),
        actionLabel: tr.tabs.settings || 'Настройки',
      });
      // Only set guard AFTER toast succeeds — if ToastProvider isn't mounted
      // or throws, we retry on the next render cycle instead of burning the flag.
      localStorage.setItem(key, '1');
    } catch (err) {
      console.warn('Nickname nudge toast failed:', err);
    }
  }, [user, needsNickname, toast, tr, nav]);

  // Handle referral + UTM tracking after user signs in
  const refClaimedRef = useRef(false);
  useEffect(() => {
    if (!user || refClaimedRef.current) return;
    refClaimedRef.current = true;
    const utmRaw = sessionStorage.getItem('entprep_utm');
    if (utmRaw) {
      try { trackEvent('Signup UTM', JSON.parse(utmRaw)); } catch { /* ignore */ }
      sessionStorage.removeItem('entprep_utm');
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = (result: TestResult) => { addHist(result); addSrFromResult(result); if (user) { submitLeaderboard(result); } };
  const handleReviewFinish = (updated: SRCard[]) => {
    setSrCards(prev => {
      const map = new Map(prev.map(c => [`${c.sid}:${c.oi}`, c]));
      for (const c of updated) map.set(`${c.sid}:${c.oi}`, c);
      return Array.from(map.values());
    });
    goHome();
  };
  const handleConfirmProfile = (sel: string[], goal?: import('./types/index').GoalSettings) => {
    confirmProfile(sel, goal);
    // Always go home — Andy will invite user to first test via speech bubble
    goHome();
  };
  // Landing page for unauthenticated visitors with no test history
  const [landingDismissed, setLandingDismissed] = useState(() => !!localStorage.getItem('entprep_landing_seen'));
  const isNewVisitor = !user && hist.length === 0 && !landingDismissed;

  if (isNewVisitor && !landingDismissed) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: FF.body }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <Suspense fallback={<LoadingSpinner />}><Landing totalQ={totalQ} onStart={() => { localStorage.setItem('entprep_landing_seen', '1'); setLandingDismissed(true); }} /></Suspense>
    </div>
  );

  if (showAuthPrompt) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: FF.body, maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <Suspense fallback={<LoadingSpinner />}><AuthPrompt onFinish={finishAuthPrompt} /></Suspense>
    </div>
  );

  const mainContent = (
    <>
      <main role="main" key={screen} style={{ paddingTop: 10, paddingBottom: !isDesktop && showNav ? 80 : 0 }}>
        {needProfile && <ProfileSelect onConfirm={handleConfirmProfile} />}
        {!needProfile && screen === SCREENS.PROFILE && <ProfileSelect onConfirm={handleConfirmProfile} />}
        {!needProfile && screen === SCREENS.HOME && <CoachHome />}
        {!needProfile && screen === 'profile_tab' && <ProfileTab />}
        {!needProfile && screen === 'tutor' && <Suspense fallback={<LoadingSpinner />}><AiTutor /></Suspense>}
        {!needProfile && screen === SCREENS.SUBJECT && curSub && (
          <ErrorBoundary key="subject" title={tr.errors.subjectTitle} message={tr.errors.subjectMessage} onRecover={goHome}>
            <SubjectDetail sid={curSub} />
          </ErrorBoundary>
        )}
        {!needProfile && screen === SCREENS.CHALLENGE && challengeData && (
          <ErrorBoundary key="challenge" title={tr.errors.challengeTitle} message={tr.errors.challengeMessage} onRecover={goHome}>
            <Challenge data={challengeData} />
          </ErrorBoundary>
        )}
        <Suspense fallback={<LoadingSpinner />}>
          {!needProfile && screen === SCREENS.TEST && curSub && (
            <ErrorBoundary key="test" title={tr.errors.testTitle} message={tr.errors.testMessage} onRecover={goHome}>
              <Test sid={curSub} tid={selTopic} customQs={customQs} finish={handleFinish} />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.CALC && (
            <ErrorBoundary key="calc" title={tr.errors.calcTitle} message={tr.errors.calcMessage} onRecover={goHome}>
              <Calc />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.FULL_ENT && (
            <ErrorBoundary key="fullent" title={tr.errors.fullentTitle} message={tr.errors.fullentMessage} onRecover={goHome}>
              <FullENT finish={handleFinish} />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.ERROR_REVIEW && (
            <ErrorBoundary key="errors" title={tr.errors.errorReviewTitle} message={tr.errors.errorReviewMessage} onRecover={goHome}>
              <ErrorReview />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.ADMIN && (
            <ErrorBoundary key="admin" title={tr.errors.adminTitle} message={tr.errors.adminMessage} onRecover={goHome}>
              <Admin />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.LEADERBOARD && (
            <ErrorBoundary key="leaderboard" title={tr.errors.leaderboardTitle} message={tr.errors.leaderboardMessage} onRecover={goHome}>
              <Leaderboard />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.FRIENDS && (
            <ErrorBoundary key="friends" title={tr.errors.friendsTitle} message={tr.errors.friendsMessage} onRecover={goHome}>
              <Friends />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.DUEL && (
            <ErrorBoundary key="duel" title={tr.errors.duelTitle} message={tr.errors.duelMessage} onRecover={goHome}>
              <Duel />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.REVIEW && (
            <ErrorBoundary key="review" title={tr.errors.reviewTitle} message={tr.errors.reviewMessage} onRecover={goHome}>
              <ReviewSession cards={srCards} onFinish={handleReviewFinish} />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.TEACHER && (
            <TeacherDashboard onBack={goHome} />
          )}
        </Suspense>
        <Suspense fallback={<LoadingSpinner />}>
          {!needProfile && screen === SCREENS.ADAPTIVE && (
            <ErrorBoundary key="adaptive" title={tr.errors.adaptiveTitle} message={tr.errors.adaptiveMessage} onRecover={() => changeTab(SCREENS.HOME)}>
              <Adaptive />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.PROGRESS && (
            <ErrorBoundary key="progress" title={tr.errors.progressTitle} message={tr.errors.progressMessage} onRecover={() => changeTab(SCREENS.HOME)}>
              <Progress />
            </ErrorBoundary>
          )}
          {!needProfile && screen === SCREENS.SETTINGS && (
            <ErrorBoundary key="settings" title={tr.errors.settingsTitle} message={tr.errors.settingsMessage} onRecover={() => changeTab(SCREENS.HOME)}>
              <Settings />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>
    </>
  );

  const sidebarNav = (
    <aside style={{ width: 220, flexShrink: 0, position: "sticky", top: 0, height: "100vh", background: "var(--bg-footer)", borderRight: "1px solid var(--border-light)", display: "flex", flexDirection: "column", padding: "20px 0" }}>
      <div style={{ padding: "0 20px 24px", fontSize: 15, fontWeight: 800, fontFamily: FF.display, letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--text)' }}>ENT</span>
        <span style={{ color: COLORS.streak }}>prep.</span>
      </div>
      {NAV_ITEMS.map(ni => {
        const active = tab === ni.id;
        const label = tr.tabs[ni.key];
        return (
          <button key={ni.id} onClick={() => changeTab(ni.id)} aria-label={label} aria-current={active ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, background: active ? "rgba(255,107,53,0.08)" : "none", border: "none", cursor: "pointer", padding: "12px 20px", borderRadius: 0, borderLeft: active ? `3px solid ${COLORS.accent}` : "3px solid transparent", transition: "all 0.2s", width: "100%", textAlign: "left" }}>
            <ni.Icon size={20} strokeWidth={active ? 2.2 : 1.8} color={active ? COLORS.accent : "var(--text-muted)"} style={{ transition: "color 0.2s" }} />
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? COLORS.accent : "var(--text-secondary)", transition: "color 0.2s" }}>{label}</span>
          </button>
        );
      })}
    </aside>
  );

  const bottomNav = (
    <nav role="navigation" aria-label={tr.tabs.home} style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: LAYOUT.maxWidth, background: "var(--bg-footer)", borderTop: "2px solid #0F0F10", padding: "10px 16px 14px", display: "flex" }}>
      {NAV_ITEMS.map(ni => {
        const active = tab === ni.id;
        const label = tr.tabs[ni.key];
        return (
          <button key={ni.id} onClick={() => changeTab(ni.id)} aria-label={label} aria-current={active ? "page" : undefined} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0", position: "relative" }}>
            <ni.Icon size={22} strokeWidth={active ? 2.6 : 2} color={active ? COLORS.streak : "var(--text-muted)"} />
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Nunito',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? COLORS.streak : "var(--text-muted)", marginTop: 5, transition: 'color 0.15s' }}>{label}</span>
            <div style={{ width: 22, height: 3, borderRadius: 2, background: active ? COLORS.streak : 'transparent', marginTop: 4, transition: 'background 0.15s' }} />
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: FF.body }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <OfflineBanner />
      {isDesktop && showNav ? (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {sidebarNav}
          <div style={{ flex: 1, maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
            <header role="banner" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border-light)", background: "var(--bg-header)",  }}>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FF.display, letterSpacing: '-0.02em' }}>
                <span style={{ color: 'var(--text)' }}>ENT</span>
                <span style={{ color: COLORS.streak }}>prep.</span>
              </div>
            </header>
            {mainContent}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
          {/* Mobile header — minimal v2: thin bar with wordmark left, no border */}
          <header role="banner" style={{ padding: "12px 20px 6px", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
            <div style={{ fontSize: 17, fontWeight: 900, fontFamily: FF.display, letterSpacing: '-0.03em' }}>
              <span style={{ color: 'var(--text)' }}>ENT</span>
              <span style={{ color: COLORS.streak }}>prep.</span>
            </div>
          </header>
          {mainContent}
          {showNav && bottomNav}
        </div>
      )}
      <InstallPrompt />
      <UpdatePrompt />
      <Suspense fallback={null}><PushPrompt /></Suspense>
      <Suspense fallback={null}><PaywallModal open={paywallReason !== null} reason={paywallReason} onClose={closePaywall} /></Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <NavigationProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </NavigationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
