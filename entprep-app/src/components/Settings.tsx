import React, { useState } from 'react';
import { getPoolSize, getTotalQ } from '../utils/questionStore';
import { UNIS } from '../data/universities';
import { supabase } from '../config/supabase';
import Auth from './Auth';
import { CARD_COMPACT, COLORS, SECTION_LABEL, TINT } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { getGoalProgress } from '../utils/competitionHelpers';
import { setNickname, buildReferralUrl } from '../utils/socialHelpers';
import Toggle from './ui/Toggle';
import ProgressBar from './ui/ProgressBar';
import { Settings as SettingsIcon, BarChart2, Trash2, Target, Wrench, Trophy, Sun, Moon, Crown, Sparkles, AtSign, Check, Globe, User, BookOpen, Palette, Database, Info, Bell, Shield, Gift, Share2 } from 'lucide-react';
import { isPushSupported, getPushPermission, subscribeToPush, unsubscribeFromPush, isSubscribed, syncPushPrefs } from '../utils/pushHelpers';

/* ─── Section wrapper ─── */
function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ ...SECTION_LABEL, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{label}
      </div>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Row inside a section ─── */
const ROW: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-light)',
};
const ROW_LAST: React.CSSProperties = {
  padding: '14px 16px',
};

export default function Settings() {
  const { st, updSt, hist, clearHist, resetProfile } = useApp();
  const { user, isPremium, isAdmin, profile, needsNickname, refreshProfile } = useAuth();
  const { nav, setScreen, setTab, openPaywall } = useNav();
  const toast = useToast();
  const t = useT();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const [cf, setCf] = useState(false);
  const [cfSignOut, setCfSignOut] = useState(false);
  const [cfResetProfile, setCfResetProfile] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [editNick, setEditNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [cfDeleteAccount, setCfDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [goalTarget, setGoalTarget] = useState(() => st.goal?.target || 100);
  const [goalDate, setGoalDate] = useState(() => st.goal?.date || '');
  const goalProg = getGoalProgress(hist, st.goal);
  const handleSignOut = async () => { if (supabase) await supabase.auth.signOut(); setCfSignOut(false); };

  const handleDeleteAccount = async () => {
    if (!supabase || !user) return;
    setDeletingAccount(true);
    try {
      // Clear local data first
      clearHist();
      // Delete profile from Supabase (cascade will clean up friendships, etc.)
      await supabase.from('profiles').delete().eq('id', user.id);
      // Sign out (account data in auth.users requires admin/edge function to delete)
      await supabase.auth.signOut();
      // Clear all localStorage
      Object.keys(localStorage).forEach(k => { if (k.startsWith('entprep')) localStorage.removeItem(k); });
      toast.success(t.settings.accountDeleted || 'Account deleted');
    } catch {
      toast.error(t.error);
    } finally {
      setDeletingAccount(false);
      setCfDeleteAccount(false);
    }
  };
  const handleResetProfile = () => { resetProfile(); setScreen('profile'); setTab('home'); setCfResetProfile(false); };
  const lang = st.lang || 'ru';

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 24px' }}>
        <SettingsIcon size={22} color="var(--text-secondary)" />
        <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", color: 'var(--text)', margin: 0 }}>{t.settings.title}</h2>
      </div>

      {/* ════════ ACCOUNT ════════ */}
      <Section icon={<User size={11} />} label={t.settings.sectionAccount || 'Account'}>
        {/* Auth row */}
        <div style={ROW}>
          <Auth user={user} onSignOut={() => setCfSignOut(true)} />
        </div>
        {cfSignOut && (
          <div style={ROW}>
            <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginBottom: 8 }}>{t.settings.signOutConfirm}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSignOut} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.yes}</button>
              <button onClick={() => setCfSignOut(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}

        {/* Premium status */}
        {isPremium ? (
          <div style={{ ...ROW, background: 'linear-gradient(135deg, rgba(255,107,53,0.06), rgba(234,179,8,0.06))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Crown size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Premium <Sparkles size={13} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {user?.user_metadata?.premium_until
                    ? `${t.settings.premiumUntil} ${new Date(user.user_metadata.premium_until as string).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU')}`
                    : t.settings.premiumActive}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => openPaywall('upgrade')} style={{ ...ROW, width: '100%', background: 'linear-gradient(135deg, rgba(255,107,53,0.04), rgba(26,154,140,0.04))', cursor: 'pointer', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border-light)', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: TINT.accent.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Crown size={18} color={COLORS.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.settings.getPremium}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.settings.premiumDesc}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, whiteSpace: 'nowrap' }}>{t.settings.premiumPrice}</div>
            </div>
          </button>
        )}

        {/* Promo code */}
        {user && !isPremium && (
          <div style={ROW}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <Gift size={15} color={COLORS.teal} style={{ flexShrink: 0 }} />
              <input
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoMsg(null); }}
                placeholder={t.settings.promoPlaceholder || 'Промокод'}
                maxLength={30}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={async () => {
                  if (!promoInput.trim() || !supabase) return;
                  setPromoLoading(true);
                  setPromoMsg(null);
                  try {
                    const token = (await supabase.auth.getSession()).data.session?.access_token;
                    const res = await fetch('/api/promo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ code: promoInput.trim() }),
                    });
                    const data = await res.json();
                    if (res.ok && data.ok) {
                      setPromoMsg({ ok: true, text: `${t.settings.promoSuccess || 'Premium активирован!'} ${data.days} ${t.days}` });
                      setPromoInput('');
                    } else {
                      const msgs: Record<string, string> = {
                        'Code not found': t.settings.promoNotFound || 'Промокод не найден',
                        'Code expired': t.settings.promoExpired || 'Промокод истёк',
                        'Code fully redeemed': t.settings.promoExpired || 'Промокод исчерпан',
                        'Already redeemed': t.settings.promoUsed || 'Вы уже использовали этот промокод',
                      };
                      setPromoMsg({ ok: false, text: msgs[data.error] || data.error || t.error });
                    }
                  } catch { setPromoMsg({ ok: false, text: t.error }); }
                  finally { setPromoLoading(false); }
                }}
                disabled={promoLoading || !promoInput.trim()}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: COLORS.teal, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: promoLoading || !promoInput.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
              >
                {promoLoading ? '...' : (t.settings.promoApply || 'Применить')}
              </button>
            </div>
            {promoMsg && (
              <div style={{ fontSize: 11, color: promoMsg.ok ? COLORS.teal : '#ef4444', marginTop: 6, paddingLeft: 23 }}>
                {promoMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Invite friend (referral) */}
        {user && profile && !profile.nickname.startsWith('user_') && (
          <div style={ROW}>
            <button
              onClick={async () => {
                const url = buildReferralUrl(profile.nickname);
                const text = `${t.settings.inviteShareText}\n${url}`;
                if (navigator.share) {
                  try { await navigator.share({ text, url }); } catch { /* cancelled */ }
                } else {
                  try { await navigator.clipboard.writeText(text); toast.success(t.errors.copied); } catch { /* ignore */ }
                }
              }}
              style={{ width: '100%', background: 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(26,154,140,0.08))', border: '1px solid rgba(255,107,53,0.15)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(26,154,140,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Gift size={18} color={COLORS.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.settings.inviteFriend}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.settings.inviteFriendDesc}</div>
              </div>
              <Share2 size={16} color="var(--text-muted)" />
            </button>
          </div>
        )}

        {/* Nickname */}
        {user && profile && (
          <div style={ROW_LAST}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editNick ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AtSign size={15} color={COLORS.teal} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.settings.nickname}</div>
                  {!editNick && (
                    <div style={{ fontSize: 12, color: needsNickname ? COLORS.yellow : 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
                      @{profile.nickname}
                      {needsNickname && <span style={{ fontSize: 10, color: COLORS.yellow, marginLeft: 6 }}>{t.settings.chooseNickname}</span>}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setEditNick(!editNick); if (!editNick) { setNickInput(needsNickname ? '' : profile.nickname); setNickError(''); } }}
                style={{ background: 'none', border: 'none', color: COLORS.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 12px', margin: '-8px -12px' }}
              >
                {editNick ? t.cancel : t.settings.editNickname}
              </button>
            </div>
            {editNick && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input
                    type="text"
                    value={nickInput}
                    onChange={e => { setNickInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); setNickError(''); }}
                    placeholder="my_nickname"
                    maxLength={20}
                    style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-subtle-2)', border: nickError ? `1.5px solid ${COLORS.red}` : '1px solid var(--border-stronger)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}
                  />
                  <button
                    onClick={async () => {
                      const nick = nickInput.trim();
                      if (nick.length < 3 || nick.length > 20 || !/^[a-zA-Z0-9_]+$/.test(nick)) {
                        setNickError(t.settings.nickRule);
                        return;
                      }
                      setNickSaving(true);
                      setNickError('');
                      try {
                        await setNickname(nick);
                        await refreshProfile();
                        toast.success(t.settings.nickUpdated);
                        setEditNick(false);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : t.error;
                        setNickError(msg.includes('taken') || msg.includes('unique') || msg.includes('Taken') ? t.settings.nickTaken : msg);
                      }
                      setNickSaving(false);
                    }}
                    disabled={nickSaving || nickInput.trim().length < 3}
                    style={{ padding: '10px 16px', background: nickInput.trim().length >= 3 ? `linear-gradient(135deg,${COLORS.teal},${COLORS.tealDark})` : 'var(--bg-subtle-2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, cursor: nickInput.trim().length >= 3 ? 'pointer' : 'default', opacity: nickSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Check size={14} />{nickSaving ? '...' : 'OK'}
                  </button>
                </div>
                {nickError && <div style={{ fontSize: 11, color: COLORS.red }}>{nickError}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.settings.nickHint}</div>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: nickInput.length >= 18 ? COLORS.yellow : 'var(--text-muted)' }}>{nickInput.length}/20</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ════════ APPEARANCE ════════ */}
      <Section icon={<Palette size={11} />} label={t.settings.sectionAppearance || 'Appearance'}>
        {/* Language */}
        <div style={{ ...ROW, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={15} color={COLORS.teal} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.settings.language}</div>
          </div>
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
            {(['ru', 'kk'] as const).map(l => (
              <button key={l} onClick={() => updSt({ ...st, lang: l })} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: lang === l ? COLORS.teal : 'transparent', color: lang === l ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                {l === 'ru' ? 'РУС' : 'ҚАЗ'}
              </button>
            ))}
          </div>
        </div>
        {/* Theme */}
        <div style={{ ...ROW_LAST, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.settings.theme}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{st.theme === 'light' ? t.settings.lightTheme : t.settings.darkTheme}</div>
          </div>
          <button onClick={() => updSt({ ...st, theme: st.theme === 'light' ? 'dark' : 'light' })} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', background: st.theme === 'light' ? COLORS.teal : 'var(--toggle-off)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: st.theme === 'light' ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
            {st.theme === 'light' ? <Sun size={16} color="#fff" /> : <Moon size={16} color="var(--text-muted)" />}
          </button>
        </div>
      </Section>

      {/* ════════ NOTIFICATIONS ════════ */}
      {isPushSupported() && (
        <Section icon={<Bell size={11} />} label={t.push?.sectionTitle || 'Notifications'}>
          {/* Master toggle */}
          <div style={{ ...ROW, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.push?.masterToggle || 'Push-уведомления'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {getPushPermission() === 'denied'
                  ? (t.push?.blocked || 'Заблокированы в настройках браузера')
                  : (t.push?.masterDesc || 'Напоминания и отчёты')}
              </div>
            </div>
            <Toggle
              value={!!st.pushEnabled}
              label={t.push?.masterToggle || 'Push'}
              onChange={async (v) => {
                if (v) {
                  setPushLoading(true);
                  const ok = await subscribeToPush();
                  setPushLoading(false);
                  if (ok) {
                    updSt({ ...st, pushEnabled: true, pushStreak: true, pushErrors: true, pushWeekly: true });
                    toast.success(t.push?.enabled || 'Уведомления включены');
                  } else {
                    toast.error(t.errors.notificationEnableFailed);
                  }
                } else {
                  await unsubscribeFromPush();
                  updSt({ ...st, pushEnabled: false });
                }
              }}
            />
          </div>
          {st.pushEnabled && ([
            { l: t.push?.streakToggle || 'Напоминание о серии', d: t.push?.streakDesc || 'Вечером, если не занимался', k: 'pushStreak' as const },
            { l: t.push?.errorsToggle || 'Повтори ошибки', d: t.push?.errorsDesc || 'В 21:00, если были ошибки', k: 'pushErrors' as const },
            { l: t.push?.weeklyToggle || 'Еженедельный отчёт', d: t.push?.weeklyDesc || 'По воскресеньям утром', k: 'pushWeekly' as const },
          ]).map((item, i, arr) => (
            <div key={item.k} style={i < arr.length - 1 ? { ...ROW, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : { ...ROW_LAST, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.l}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.d}</div>
              </div>
              <Toggle value={st[item.k] !== false} onChange={async (v) => {
                updSt({ ...st, [item.k]: v });
                const prefKey = item.k.replace('push', '').toLowerCase();
                const ok = await syncPushPrefs({ [prefKey]: v });
                if (!ok) toast.warning(t.push?.syncFailed || 'Настройка не сохранилась на сервере');
              }} label={item.l} />
            </div>
          ))}
        </Section>
      )}

      {/* ════════ STUDY PREFERENCES ════════ */}
      <Section icon={<BookOpen size={11} />} label={t.settings.sectionStudy || 'Study'}>
        {/* Toggle rows */}
        {([
          { l: t.settings.explanations, d: t.settings.explanationsDesc, k: 'exp' as const },
          { l: t.settings.timer, d: t.settings.timerDesc, k: 'tmr' as const },
          { l: t.settings.shuffle, d: t.settings.shuffleDesc, k: 'shf' as const },
        ]).map(item => (
          <div key={item.k} style={{ ...ROW, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.l}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.d}</div>
            </div>
            <Toggle value={st[item.k]} onChange={(v) => updSt({ ...st, [item.k]: v })} label={item.l} />
          </div>
        ))}

        {/* ENT Goal */}
        <div style={ROW}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <Trophy size={15} color={COLORS.amber} />{t.settings.entGoal}
            </div>
            <button onClick={() => { setEditGoal(!editGoal); if (!editGoal) { setGoalTarget(st.goal?.target || 100); setGoalDate(st.goal?.date || ''); } }} style={{ background: 'none', border: 'none', color: COLORS.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 12px', margin: '-8px -12px' }}>
              {editGoal ? t.cancel : st.goal ? t.settings.editNickname : t.settings.setGoal}
            </button>
          </div>
          {editGoal ? (
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>{t.settings.targetScore}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{goalTarget}/140</span>
                </div>
                <input type="range" min={50} max={140} value={goalTarget} onChange={e => setGoalTarget(+e.target.value)} aria-label={t.settings.targetScore} style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 6, background: 'var(--border)', borderRadius: 3, outline: 'none', WebkitAppearance: 'none', appearance: 'none', margin: 0, padding: 0 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.settings.entDate}</div>
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg-subtle-2)', border: '1px solid var(--border-stronger)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', colorScheme: 'var(--color-scheme)', margin: 0, WebkitAppearance: 'none', appearance: 'none' }} />
              </div>
              <button onClick={() => { updSt({ ...st, goal: { target: goalTarget, date: goalDate } }); setEditGoal(false); }} disabled={!goalDate} style={{ width: '100%', padding: '10px', background: goalDate ? `linear-gradient(135deg,${COLORS.amber},#d97706)` : 'var(--bg-subtle-2)', border: 'none', borderRadius: 10, color: goalDate ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: goalDate ? 'pointer' : 'default' }}>
                {t.settings.saveGoal}
              </button>
            </div>
          ) : goalProg ? (
            <div>
              <ProgressBar value={goalProg.pct} max={100} gradient={goalProg.onTrack ? `linear-gradient(90deg,${COLORS.green},#10B981)` : `linear-gradient(90deg,${COLORS.yellow},${COLORS.amber})`} height={6} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>~{goalProg.approxScore}/{goalProg.target} {t.settings.goalScoreLabel}</span>
                <span style={{ fontSize: 10, color: goalProg.onTrack ? COLORS.green : COLORS.yellow, fontWeight: 600 }}>
                  {goalProg.daysLeft > 0 ? `${goalProg.daysLeft} ${t.settings.goalDaysLeft}` : t.settings.goalToday}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.settings.goalHint}</div>
          )}
        </div>

        {/* Daily Goal */}
        <div style={ROW}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <Target size={15} color={COLORS.teal} />{t.settings.dailyGoal}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: COLORS.teal }}>{st.dailyGoal || 3} {t.settings.dailyGoalUnit}</span>
          </div>
          <input type="range" min={1} max={10} value={st.dailyGoal || 3} onChange={e => updSt({ ...st, dailyGoal: +e.target.value })} aria-label={t.settings.dailyGoal} style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 6, background: 'var(--border)', borderRadius: 3, outline: 'none', WebkitAppearance: 'none', appearance: 'none', margin: 0, padding: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>1</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>10</span>
          </div>
        </div>

        {/* Change profile */}
        {!cfResetProfile ? (
          <button onClick={() => setCfResetProfile(true)} style={{ ...ROW_LAST, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
            <Target size={15} />{t.settings.changeProfile}
          </button>
        ) : (
          <div style={ROW_LAST}>
            <div style={{ fontSize: 12, color: COLORS.yellow, fontWeight: 600, marginBottom: 8 }}>{t.settings.resetProfileConfirm}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleResetProfile} style={{ flex: 1, padding: '10px', background: COLORS.yellow, border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.yes}</button>
              <button onClick={() => setCfResetProfile(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}
      </Section>

      {/* ════════ DATA ════════ */}
      <Section icon={<Database size={11} />} label={t.settings.sectionData || 'Data'}>
        {/* Stats */}
        <div style={ROW}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            <BarChart2 size={15} />{t.settings.stats}
          </div>
          {(() => {
            const regular = hist.filter(h => h.type !== 'fullent');
            const totalQ = regular.reduce((s, h) => s + (h.to || 0), 0);
            const totalC = regular.reduce((s, h) => s + (h.co || 0), 0);
            return [
              [t.settings.statTests, hist.length],
              [t.settings.statQuestions, totalQ],
              [t.settings.statCorrect, totalC],
              [t.settings.statPercent, totalQ > 0 ? Math.round(totalC / totalQ * 100) + '%' : '\u2014']
            ];
          })().map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Admin button */}
        {isAdmin && (
          <button onClick={() => nav('admin')} style={{ ...ROW, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
            <Wrench size={15} />{t.settings.adminPanel}
          </button>
        )}

        {/* Delete history */}
        {hist.length > 0 && !cf && (
          <button onClick={() => setCf(true)} style={{ ...ROW_LAST, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.red, fontSize: 13, fontWeight: 600 }}>
            <Trash2 size={15} />{t.settings.deleteHistory}
          </button>
        )}
        {cf && (
          <div style={ROW_LAST}>
            <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginBottom: 8 }}>{t.settings.deleteHistory}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { clearHist(); setCf(false); }} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.settings.deleteConfirm}</button>
              <button onClick={() => setCf(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}

        {/* Delete account (Apple requirement 5.1.1) */}
        {user && !cfDeleteAccount && (
          <button onClick={() => setCfDeleteAccount(true)} style={{ ...ROW_LAST, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.red, fontSize: 13, fontWeight: 600 }}>
            <Trash2 size={15} />{t.settings.deleteAccount || 'Удалить аккаунт'}
          </button>
        )}
        {cfDeleteAccount && (
          <div style={ROW_LAST}>
            <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginBottom: 4 }}>{t.settings.deleteAccount || 'Удалить аккаунт'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.settings.deleteAccountWarning || 'Все данные будут удалены. Это действие нельзя отменить.'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeleteAccount} disabled={deletingAccount} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: deletingAccount ? 0.6 : 1 }}>{deletingAccount ? '...' : (t.settings.deleteConfirm)}</button>
              <button onClick={() => setCfDeleteAccount(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}
      </Section>

      {/* ════════ ABOUT ════════ */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Unbounded',sans-serif" }}>
          <span style={{ color: COLORS.accent }}>ENT</span><span style={{ color: COLORS.teal }}>prep</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{t.settings.version} • {getTotalQ()} {t.settings.questionsCount} • {Math.floor(getPoolSize('reading') / 5)} {t.settings.textsCount}</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{UNIS.length} {t.settings.unisFormat}</div>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textDecoration: 'none' }}>
          <Shield size={10} /> {t.settings.privacy}
        </a>
      </div>
    </div>
  );
}
