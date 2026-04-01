import React, { Suspense, useEffect, useRef, useState } from "react";
import { TOTAL_Q } from './config/questionPools';
import { prefetchCounts, getTotalQ } from './utils/questionStore';
import { GLOBAL_STYLES, LAYOUT, COLORS } from './constants/styles';
import { DARK, LIGHT, themeToCss } from './constants/themes';
import { SCREENS } from './constants/screens';
import { useBreakpoint } from './hooks/useBreakpoint';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';
import { NavigationProvider, useNav } from './contexts/NavigationContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { useT } from './locales';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { Home as HomeIcon, Brain, BarChart3, Settings as SettingsIcon, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ProfileSelect from './components/ProfileSelect';
import Home from './components/Home';
import Progress from './components/Progress';
import Settings from './components/Settings';
import Adaptive from './components/Adaptive';
import SubjectDetail from './components/SubjectDetail';
import Challenge from './components/Challenge';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import UpdatePrompt from './components/UpdatePrompt';
import PaywallModal from './components/PaywallModal';
import Onboarding from './components/Onboarding';
import AuthPrompt from './components/AuthPrompt';
import Landing from './components/Landing';
import { API_BASE } from './config/app';
import PushPrompt from './components/PushPrompt';
import { supabase } from './config/supabase';
import { useAuth } from './contexts/AuthContext';
import { parseReferralParam, claimReferral } from './utils/socialHelpers';
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

interface NavItem {
  id: string;
  key: 'home' | 'adaptive' | 'progress' | 'settings';
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", key: "home", Icon: HomeIcon },
  { id: "adaptive", key: "adaptive", Icon: Brain },
  { id: "prog", key: "progress", Icon: BarChart3 },
  { id: "set", key: "settings", Icon: SettingsIcon },
];

function AppContent() {
  const { screen, curSub, selTopic, customQs, tab, challengeData, paywallReason, nav, goHome, changeTab, setScreen, setTab, setCustomQs, setSelTopic, closePaywall } = useNav();
  const { hist, prof, st, srCards, syncError, showOnboarding, showAuthPrompt, addHist, confirmProfile, resetProfile, finishOnboarding, finishAuthPrompt, updSt, clearHist, addSrFromResult, setSrCards } = useApp();
  const toast = useToast();
  const tr = useT();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  const isDark = st.theme !== 'light';
  const palette = isDark ? DARK : LIGHT;

  useEffect(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 400);
    }
  }, []);

  const [totalQ, setTotalQ] = useState(TOTAL_Q);
  useEffect(() => { prefetchCounts().then(ok => { if (ok) setTotalQ(getTotalQ()); }); }, []);

  // Persist ?ref= and UTM params for users who haven't signed in yet
  useEffect(() => {
    const refNick = parseReferralParam();
    if (refNick) {
      sessionStorage.setItem('entprep_ref', refNick);
    }
    // Save UTM params (Plausible tracks these automatically, but store for user_data on signup)
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('entprep_utm', JSON.stringify(utm));
    }
    // Clean URL
    if (refNick || Object.keys(utm).length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  const prevSyncError = useRef<string | null>(null);
  useEffect(() => {
    if (syncError && syncError !== prevSyncError.current) {
      toast.warning(tr.auth.syncFailed);
    }
    prevSyncError.current = syncError;
  }, [syncError]); // eslint-disable-line react-hooks/exhaustive-deps

  const needProfile = prof.length === 0 && screen !== SCREENS.PROFILE;
  const showNav = !needProfile && screen !== SCREENS.TEST && screen !== SCREENS.FULL_ENT && screen !== SCREENS.PROFILE && screen !== SCREENS.SUBJECT && screen !== SCREENS.ERROR_REVIEW && screen !== SCREENS.ADMIN && screen !== SCREENS.CHALLENGE && screen !== SCREENS.LEADERBOARD && screen !== SCREENS.FRIENDS && screen !== SCREENS.DUEL && screen !== SCREENS.REVIEW && screen !== SCREENS.TEACHER && !showOnboarding && !showAuthPrompt;

  const { user } = useAuth();

  // Handle referral + UTM tracking after user signs in
  const refClaimedRef = useRef(false);
  useEffect(() => {
    if (!user || refClaimedRef.current) return;
    refClaimedRef.current = true;
    const refNick = sessionStorage.getItem('entprep_ref');
    if (refNick) {
      sessionStorage.removeItem('entprep_ref');
      claimReferral(refNick).then(ok => { if (ok) toast.success(tr.settings.referralSuccess); });
    }
    const utmRaw = sessionStorage.getItem('entprep_utm');
    if (utmRaw) {
      try { trackEvent('Signup UTM', JSON.parse(utmRaw)); } catch { /* ignore */ }
      sessionStorage.removeItem('entprep_utm');
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = (result: TestResult) => { addHist(result); addSrFromResult(result); if (user) { submitLeaderboard(result); } goHome(); };
  const handleReviewFinish = (updated: SRCard[]) => {
    setSrCards(prev => {
      const map = new Map(prev.map(c => [`${c.sid}:${c.oi}`, c]));
      for (const c of updated) map.set(`${c.sid}:${c.oi}`, c);
      return Array.from(map.values());
    });
    goHome();
  };
  const handleConfirmProfile = (sel: string[], goal?: import('./types/index').GoalSettings) => {
    const isFirstTime = hist.length === 0;
    confirmProfile(sel, goal);
    if (isFirstTime) {
      // First-time users: auto-navigate to a short reading test
      nav('test', 'reading');
      setTimeout(() => toast.success((tr.onboarding as Record<string, string>).tryFirst || 'Попробуй свой первый тест!'), 500);
    } else {
      goHome();
    }
  };
  const handleResetProfile = () => { resetProfile(); setScreen(SCREENS.PROFILE); setTab(SCREENS.HOME); };

  // Landing page for unauthenticated visitors with no test history
  const [landingDismissed, setLandingDismissed] = useState(() => !!localStorage.getItem('entprep_landing_seen'));
  const isNewVisitor = !user && hist.length === 0 && !landingDismissed;

  if (isNewVisitor && !landingDismissed) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Segoe UI',-apple-system,sans-serif" }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <Landing totalQ={totalQ} onStart={() => { localStorage.setItem('entprep_landing_seen', '1'); setLandingDismissed(true); }} />
    </div>
  );

  if (showOnboarding) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Segoe UI',-apple-system,sans-serif", maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <Onboarding onFinish={finishOnboarding} />
    </div>
  );

  if (showAuthPrompt) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Segoe UI',-apple-system,sans-serif", maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <AuthPrompt onFinish={finishAuthPrompt} />
    </div>
  );

  const mainContent = (
    <>
      <main role="main" key={screen} style={{ paddingTop: 10, paddingBottom: !isDesktop && showNav ? 80 : 0, animation: "screenIn 0.35s cubic-bezier(0.16,1,0.3,1)", willChange: "opacity,transform" }}>
        {needProfile && <ProfileSelect onConfirm={handleConfirmProfile} />}
        {!needProfile && screen === SCREENS.PROFILE && <ProfileSelect onConfirm={handleConfirmProfile} />}
        {!needProfile && screen === SCREENS.HOME && <Home />}
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
      </main>
    </>
  );

  const sidebarNav = (
    <aside style={{ width: 220, flexShrink: 0, position: "sticky", top: 0, height: "100vh", background: "var(--bg-footer)", borderRight: "1px solid var(--border-light)", display: "flex", flexDirection: "column", padding: "20px 0" }}>
      <div style={{ padding: "0 20px 24px", fontSize: 15, fontWeight: 800, fontFamily: "'Unbounded',sans-serif" }}>
        <span style={{ color: COLORS.accent }}>ENT</span>
        <span style={{ color: COLORS.teal }}>prep</span>
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
    <nav role="navigation" aria-label={tr.tabs.home} style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: LAYOUT.maxWidth, background: "var(--bg-footer)", borderTop: "1px solid var(--border-light)", padding: "8px 16px 14px", display: "flex", justifyContent: "space-around" }}>
      {NAV_ITEMS.map(ni => {
        const active = tab === ni.id;
        const label = tr.tabs[ni.key];
        return (
          <button key={ni.id} onClick={() => changeTab(ni.id)} aria-label={label} aria-current={active ? "page" : undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "6px 18px", borderRadius: 12, transition: "all 0.2s", position: "relative" }}>
            <ni.Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? COLORS.accent : "var(--text-muted)"} style={{ transition: "color 0.2s" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: active ? COLORS.accent : "var(--text-muted)", marginTop: 4, transition: "color 0.2s" }}>{label}</span>
            {active && <div style={{ width: 16, height: 3, borderRadius: 2, background: COLORS.accent, marginTop: 3, animation: "scaleIn 0.2s ease" }} />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Segoe UI',-apple-system,sans-serif" }}>
      <style>{`:root{${themeToCss(palette)}}${GLOBAL_STYLES}`}</style>
      <OfflineBanner />
      {isDesktop && showNav ? (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {sidebarNav}
          <div style={{ flex: 1, maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
            <header role="banner" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border-light)", background: "var(--bg-header)",  }}>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Unbounded',sans-serif" }}>
                <span style={{ color: COLORS.accent }}>ENT</span>
                <span style={{ color: COLORS.teal }}>prep</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 6 }}>{Math.floor(totalQ / 1000)}K+</span>
              </div>
            </header>
            {mainContent}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: LAYOUT.maxWidth, margin: "0 auto", position: "relative" }}>
          <header role="banner" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border-light)", background: "var(--bg-header)",  }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Unbounded',sans-serif" }}>
              <span style={{ color: COLORS.accent }}>ENT</span>
              <span style={{ color: COLORS.teal }}>prep</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 6 }}>{Math.floor(totalQ / 1000)}K+</span>
            </div>
          </header>
          {mainContent}
          {showNav && bottomNav}
        </div>
      )}
      <InstallPrompt />
      <UpdatePrompt />
      <PushPrompt />
      <PaywallModal open={paywallReason !== null} reason={paywallReason} onClose={closePaywall} />
      {/* WhatsApp floating button — mobile only */}
      {bp === 'mobile' && (
        <a
          href="https://wa.me/77473564629?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82!%20%D0%A5%D0%BE%D1%87%D1%83%20%D1%83%D0%B7%D0%BD%D0%B0%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%20ENTprep"
          target="_blank"
          rel="noopener"
          aria-label="WhatsApp"
          style={{
            position: 'fixed', bottom: showNav ? 82 : 20, right: 16, zIndex: 90,
            width: 48, height: 48, borderRadius: 14,
            background: '#25D366', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,211,102,0.3)',
            textDecoration: 'none',
          }}
        >
          <MessageCircle size={22} color="#fff" fill="#fff" />
        </a>
      )}
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
