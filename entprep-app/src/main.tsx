import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initSentry } from './config/sentry'
import { Capacitor } from '@capacitor/core'

initSentry();

// Web OAuth: implicit flow — Supabase detects #access_token automatically

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
