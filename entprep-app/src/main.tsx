import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initSentry } from './config/sentry'
import { Capacitor } from '@capacitor/core'
import { captureRefFromUrl, getPendingReferral, flushPendingReferral } from './utils/referralHelpers'

initSentry();

// Clean up old PKCE-era storage key (v1 → v2 migration, Apr 15)
try { localStorage.removeItem('entprep-auth'); } catch { /* ignore */ }

// Web OAuth: implicit flow — Supabase detects #access_token automatically.
// Log when the redirect lands so we can debug silent failures.
if (!Capacitor.isNativePlatform() && window.location.hash) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const errorDesc = hashParams.get('error_description') || hashParams.get('error');
  if (errorDesc) {
    console.error('OAuth redirect error:', errorDesc);
  } else if (hashParams.get('access_token')) {
    console.log('OAuth redirect: access_token detected, Supabase will pick it up');
  }
}

// Handle OAuth deep links in native app
if (Capacitor.isNativePlatform()) {
  Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser'),
    import('./config/supabase'),
  ]).then(([{ App: CapApp }, { Browser }, { supabase: sb }]) => {
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!sb) return;
      try {
        await Browser.close();
      } catch { /* browser may already be closed */ }

      try {
        const urlObj = new URL(url);

        // OAuth error (user denied, provider error, etc.)
        const oauthError = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');
        if (oauthError) {
          console.error('OAuth error:', oauthError);
          // Brief delay so the app UI is visible before showing alert
          setTimeout(() => alert(oauthError), 300);
          return;
        }

        // PKCE flow: kz.entprep.app://auth?code=...
        const code = urlObj.searchParams.get('code');
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('OAuth exchange failed:', error.message);
            setTimeout(() => alert(error.message), 300);
            return;
          }
          window.location.reload();
          return;
        }

        // Legacy implicit flow fallback: ...#access_token=...
        const hash = url.split('#')[1];
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            await sb.auth.setSession({ access_token, refresh_token });
            window.location.reload();
          }
        }
      } catch (err) {
        console.error('OAuth deep link error:', err);
      }
    });
  });
}

// Referral deep link: capture an incoming ?ref=<code> (web link or native
// appUrlOpen-scrubbed query) into pending storage, then flush it to the backend once
// the user is signed in. Independent of AuthContext — Supabase allows multiple
// onAuthStateChange listeners, so this touches neither App.tsx routing nor the auth
// provider. The backend decides qualification; an unqualified referee just keeps the
// pending code and retries on a later session (deferred reward).
captureRefFromUrl();
if (getPendingReferral()) {
  import('./config/supabase').then(({ supabase: sb }) => {
    if (!sb) return;
    let flushed = false;
    sb.auth.onAuthStateChange((event, session) => {
      if (flushed) return;
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        flushed = true; // once per page load; a non-terminal result retries next load
        flushPendingReferral().catch(() => { /* transient — retried next session */ });
      }
    });
  }).catch(() => { /* supabase unavailable — referral flush simply waits */ });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
