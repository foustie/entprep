import { useState, useMemo } from 'react';
import { Cloud, Swords, Trophy, Flame, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../config/supabase';
import { COLORS, FF, R } from '../constants/styles';
import { useT } from '../locales';
import { useToast } from '../contexts/ToastContext';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { LucideIcon } from 'lucide-react';

/**
 * Detect in-app browsers (WhatsApp, Instagram, TikTok, Facebook, etc).
 * Google OAuth policy since 2021 blocks embedded WebViews — button silently fails.
 * UA signatures below cover the top KZ social entry points for ENTprep.
 */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const lua = ua.toLowerCase();
  // Native app = capacitor runs OAuth via Browser plugin, not WebView — skip warning
  if (Capacitor.isNativePlatform()) return false;
  return (
    /\bwv\b/i.test(ua) ||                           // Android WebView
    /whatsapp/i.test(lua) ||
    /instagram/i.test(lua) ||
    /\bfban\b|\bfbav\b|\bfb_iab\b/i.test(lua) ||     // Facebook, Messenger
    /musical_ly|bytedance|tiktok/i.test(lua) ||
    /line\//i.test(ua) ||
    /twitter/i.test(lua) ||
    /micromessenger/i.test(lua) ||                    // WeChat
    (/telegram/i.test(lua) && /android/i.test(lua))  // Telegram iOS uses SFSafariViewController (OK)
  );
}

function detectMobileOs(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

interface AppleSignInPlugin {
  authorize(options: { nonce: string }): Promise<{
    identityToken: string;
    authorizationCode: string;
    user: string;
    email?: string;
    givenName?: string;
    familyName?: string;
  }>;
}

const AppleSignIn = registerPlugin<AppleSignInPlugin>('AppleSignIn');

/** Generate a random nonce string for Apple Sign In. */
function generateRawNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => charset[v % charset.length]).join('');
}

/** SHA-256 hash a string and return the hex digest. */
async function sha256(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

interface BenefitConfig {
  Icon: LucideIcon;
  color: string;
}

const BENEFIT_CONFIGS: BenefitConfig[] = [
  { Icon: Cloud, color: COLORS.teal },
  { Icon: Swords, color: COLORS.red },
  { Icon: Trophy, color: COLORS.green },
  { Icon: Flame, color: COLORS.amber },
];

interface AuthPromptProps {
  onFinish: () => void;
}

export default function AuthPrompt({ onFinish }: AuthPromptProps) {
  const t = useT();
  const toast = useToast();
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const inApp = useMemo(() => isInAppBrowser(), []);
  const os = useMemo(() => detectMobileOs(), []);

  const benefitTexts = [
    t.authPrompt.benefit1,
    t.authPrompt.benefit2,
    t.authPrompt.benefit3,
    t.authPrompt.benefit4,
  ];

  const copyShareLink = async () => {
    const url = window.location.href || 'https://entprep.org';
    try {
      await navigator.clipboard.writeText(url);
      toast.info(t.authPrompt.linkCopied);
      return;
    } catch {}
    // Fallback for browsers without clipboard API (in-app WebViews often lack it)
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    if (ok) toast.info(t.authPrompt.linkCopied);
    else toast.error(url);
  };

  const openInChrome = () => {
    const hrefWithoutScheme = (window.location.href || 'https://entprep.org').replace(/^https?:\/\//, '');
    // Android Chrome intent — preserves path/query (ref codes, deep links) when opening in Chrome
    window.location.href = `intent://${hrefWithoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const signInWith = async (provider: 'google' | 'apple') => {
    if (!supabase) return;
    setLoading(provider);
    try {
      // Native iOS Apple Sign In — use AuthenticationServices via Capacitor plugin
      if (provider === 'apple' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const rawNonce = generateRawNonce();
        const hashedNonce = await sha256(rawNonce);
        const result = await AppleSignIn.authorize({ nonce: hashedNonce });
        if (!result.identityToken) {
          setLoading(null);
          return;
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.identityToken,
          nonce: rawNonce,
        });
        if (error) {
          console.error('Apple sign-in error:', error.message);
          alert(`Apple Sign In: ${error.message}`);
        }
        setLoading(null);
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: 'kz.entprep.app://auth',
            skipBrowserRedirect: true,
          },
        });
        if (error) {
          console.error('OAuth error (native):', error);
          toast.error(error.message);
          setLoading(null);
          return;
        }
        if (!data.url) { setLoading(null); return; }
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        });
        if (error) {
          console.error('OAuth error:', error);
          toast.error(error.message);
          setLoading(null);
        }
      }
    } catch (err) {
      console.error('OAuth exception:', err);
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(null);
    }
  };

  return (
    <div style={{
      padding: '0 20px', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          fontSize: 22, fontWeight: 900, fontFamily: FF.display,
          letterSpacing: '-0.04em',
        }}>
          <span style={{ color: 'var(--ink)' }}>ENT</span><span style={{ color: COLORS.streak }}>prep.</span>
        </div>
      </div>

      {/* Main card — ink-bordered with 3D shadow */}
      <div style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--ink)',
        borderRadius: 18,
        boxShadow: '0 5px 0 0 var(--ink)',
        padding: '28px 22px 26px',
        marginBottom: 22,
        animation: 'heroEnter 0.45s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Eyebrow */}
        <div style={{
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: COLORS.streak, textAlign: 'center', marginBottom: 8,
        }}>{t.authPrompt.eyebrow}</div>

        <h2 style={{
          fontFamily: FF.display,
          fontSize: 26, fontWeight: 900, letterSpacing: '-0.035em',
          color: 'var(--text)', margin: '0 0 6px', textAlign: 'center', lineHeight: 1.1,
        }}>{t.authPrompt.createAccount}</h2>
        <p style={{
          fontFamily: FF.body, fontSize: 13, fontWeight: 700,
          color: 'var(--text-secondary)', margin: '0 0 22px', textAlign: 'center',
        }}>
          {t.authPrompt.freeAndFast}
        </p>

        {/* Benefits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 22 }}>
          {BENEFIT_CONFIGS.map((cfg, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px',
              background: 'var(--bg-subtle)',
              border: '1.5px solid rgba(15,15,16,0.1)',
              borderRadius: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: R.sm,
                background: `${cfg.color}18`,
                border: `1.5px solid ${cfg.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <cfg.Icon size={17} color={cfg.color} strokeWidth={2.2} />
              </div>
              <span style={{
                fontFamily: FF.body, fontSize: 13, fontWeight: 700,
                color: 'var(--text)', lineHeight: 1.35,
              }}>{benefitTexts[i]}</span>
            </div>
          ))}
        </div>

        {/* In-app browser warning — Google OAuth blocked by policy in WhatsApp/Instagram/TikTok/etc */}
        {inApp && (
          <div style={{
            background: `${COLORS.streak}14`,
            border: `2px solid ${COLORS.streak}`,
            borderRadius: 12,
            padding: '12px 13px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: R.sm, flexShrink: 0,
                background: COLORS.streak,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={15} color="#fff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: FF.display, fontSize: 13, fontWeight: 900,
                  color: 'var(--ink)', marginBottom: 3, lineHeight: 1.2,
                }}>{t.authPrompt.inAppWarningTitle}</div>
                <div style={{
                  fontFamily: FF.body, fontSize: 12, fontWeight: 600,
                  color: 'var(--ink-soft)', lineHeight: 1.35,
                }}>{t.authPrompt.inAppWarningText}</div>
              </div>
            </div>
            <div style={{
              fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
              color: 'var(--ink-soft)', lineHeight: 1.35, paddingLeft: 36,
            }}>
              {os === 'ios' ? t.authPrompt.inAppTipIos : t.authPrompt.inAppTipAndroid}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingLeft: 36 }}>
              <button
                onClick={copyShareLink}
                style={{
                  flex: 1, padding: '9px 10px',
                  background: '#fff', border: '1.5px solid var(--ink)',
                  borderRadius: R.sm, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: FF.body, fontSize: 11, fontWeight: 800,
                  color: 'var(--ink)',
                }}
              >
                <Copy size={12} strokeWidth={2.4} />
                {t.authPrompt.copyLink}
              </button>
              {os === 'android' && (
                <button
                  onClick={openInChrome}
                  style={{
                    flex: 1, padding: '9px 10px',
                    background: 'var(--ink)', border: '1.5px solid var(--ink)',
                    borderRadius: R.sm, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: FF.body, fontSize: 11, fontWeight: 800,
                    color: '#fff',
                  }}
                >
                  <ExternalLink size={12} strokeWidth={2.4} />
                  {t.authPrompt.openInChrome}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Google button — ink border + shadow */}
        <button
          onClick={() => signInWith('google')}
          disabled={!!loading}
          style={{
            width: '100%', padding: '13px 18px',
            background: '#fff',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            boxShadow: '0 3px 0 0 var(--ink)',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: FF.body, fontSize: 14, fontWeight: 800,
            color: 'var(--ink)',
            opacity: loading ? 0.6 : 1,
            marginBottom: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.001 24.001 0 000 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading === 'google' ? t.authPrompt.connecting : t.auth.signInGoogle}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
          <div style={{ flex: 1, height: 1.5, background: 'rgba(15,15,16,0.12)' }} />
          <span style={{
            fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>{t.or}</span>
          <div style={{ flex: 1, height: 1.5, background: 'rgba(15,15,16,0.12)' }} />
        </div>

        {/* Apple button — ink background */}
        <button
          onClick={() => signInWith('apple')}
          disabled={!!loading}
          style={{
            width: '100%', padding: '13px 18px',
            background: 'var(--ink)',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            boxShadow: '0 3px 0 0 ' + COLORS.streak,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: FF.body, fontSize: 14, fontWeight: 800,
            color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <svg width="16" height="18" viewBox="0 0 17 20" fill="#fff">
            <path d="M13.19 10.47c-.03-2.67 2.18-3.95 2.28-4.01-1.24-1.82-3.17-2.07-3.86-2.1-1.64-.17-3.2.97-4.03.97-.84 0-2.13-.94-3.5-.92-1.8.03-3.46 1.05-4.39 2.66-1.87 3.25-.48 8.06 1.34 10.7.89 1.29 1.95 2.74 3.35 2.69 1.34-.05 1.85-.87 3.47-.87 1.62 0 2.08.87 3.5.84 1.45-.02 2.36-1.31 3.24-2.61 1.02-1.5 1.44-2.95 1.47-3.02-.03-.01-2.82-1.08-2.87-4.33zM10.52 2.74c.74-.9 1.24-2.14 1.1-3.39-1.07.04-2.36.71-3.12 1.61-.69.79-1.29 2.07-1.13 3.29 1.19.09 2.4-.61 3.15-1.51z"/>
          </svg>
          {loading === 'apple' ? t.authPrompt.connecting : t.auth.signInApple}
        </button>
      </div>

      {/* Later button */}
      <button
        onClick={onFinish}
        style={{
          background: 'none', border: 'none',
          color: 'var(--text-muted)',
          fontFamily: FF.body, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', padding: 10,
          alignSelf: 'center',
          letterSpacing: '0.02em',
        }}
      >
        {t.authPrompt.later}
      </button>
    </div>
  );
}
