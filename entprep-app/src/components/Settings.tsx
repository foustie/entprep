import React, { useState, useEffect } from 'react';
import { getPoolSize, getTotalQ } from '../utils/questionStore';
import { UNIS } from '../data/universities';
import { supabase } from '../config/supabase';
import Auth from './Auth';
import { COLORS, FF, BUTTON, R } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { API_BASE } from '../config/app';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { getGoalProgress } from '../utils/competitionHelpers';
import { setNickname } from '../utils/socialHelpers';
import { getSubscriptionStatus, cancelSubscription, resumeSubscription, type SubscriptionStatus } from '../utils/subscriptionHelpers';
import Toggle from './ui/Toggle';
import ProgressBar from './ui/ProgressBar';
import InviteFriend from './InviteFriend';
import { Settings as SettingsIcon, BarChart2, Trash2, Target, Wrench, Trophy, AtSign, Check, Globe, User, BookOpen, Palette, Database, Bell, Shield, Users, GraduationCap, Heart, ExternalLink, Instagram, MessageCircle, Send, Mail, Sun, Moon, CreditCard, Gift } from 'lucide-react';
import { isPushSupported, getPushPermission, subscribeToPush, unsubscribeFromPush, syncPushPrefs } from '../utils/pushHelpers';

/* ─── Section wrapper — v2 ink-bordered card ─── */
function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {icon}{label}
      </div>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: R.lg,
        border: '2px solid var(--ink)',
        boxShadow: '0 3px 0 0 var(--ink)',
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
  borderBottom: '1.5px solid rgba(15,15,16,0.08)',
};
const ROW_LAST: React.CSSProperties = {
  padding: '14px 16px',
};

export default function Settings() {
  const { st, updSt, hist, clearHist, resetProfile } = useApp();
  const { user, isAdmin, profile, needsNickname, refreshProfile, isPremium } = useAuth();
  const { nav, setScreen, setTab } = useNav();
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
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subErr, setSubErr] = useState(false);
  const [cfCancelSub, setCfCancelSub] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [classJoining, setClassJoining] = useState(false);
  const [classMsg, setClassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [goalTarget, setGoalTarget] = useState(() => st.goal?.target || 100);
  const [goalDate, setGoalDate] = useState(() => st.goal?.date || '');
  const goalProg = getGoalProgress(hist, st.goal);
  const handleSignOut = async () => { if (supabase) await supabase.auth.signOut(); setCfSignOut(false); };

  const handleDeleteAccount = async () => {
    if (!supabase || !user) return;
    setDeletingAccount(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      // Server-side: delete auth.users, profile, avatar, push subscriptions
      const res = await fetch(`${API_BASE}/api/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Server deletion failed');
      // Clear local data
      clearHist();
      await supabase.auth.signOut();
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
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU') : '';

  // Load the user's Lemon (web) subscription status so premium users can self-cancel.
  // found:false for season-pass / native-store purchases — UI shows a pointer instead.
  useEffect(() => {
    if (!supabase || !user || !isPremium) { setSubStatus(null); return; }
    let active = true;
    setSubLoading(true);
    setSubErr(false);
    getSubscriptionStatus()
      .then(s => { if (active) { setSubStatus(s); setCfCancelSub(false); } })
      .catch(() => { if (active) setSubErr(true); })
      .finally(() => { if (active) setSubLoading(false); });
    return () => { active = false; };
  }, [user, isPremium]);

  const handleCancelSub = async () => {
    setSubBusy(true);
    try {
      const r = await cancelSubscription();
      toast.success(t.settings.subCancelled.replace('{date}', fmtDate(r.endsAt)));
      setSubStatus(await getSubscriptionStatus());
    } catch {
      toast.error(t.error);
    } finally {
      setSubBusy(false);
      setCfCancelSub(false);
    }
  };

  const handleResumeSub = async () => {
    setSubBusy(true);
    try {
      await resumeSubscription();
      toast.success(t.settings.subResumed);
      setSubStatus(await getSubscriptionStatus());
    } catch {
      toast.error(t.error);
    } finally {
      setSubBusy(false);
    }
  };

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 22px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: R.md,
          background: 'var(--ink)', border: '2px solid var(--ink)',
          boxShadow: '0 3px 0 0 ' + COLORS.streak,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <SettingsIcon size={18} strokeWidth={2.4} />
        </div>
        <h2 style={{
          fontSize: 26, fontWeight: 900, fontFamily: FF.display,
          color: 'var(--text)', margin: 0, letterSpacing: '-0.035em', lineHeight: 1,
        }}>{t.settings.title}</h2>
      </div>

      {/* ════════ ACCOUNT ════════ */}
      {/* Auth renders null without a configured Supabase client — hide the whole
          section then, otherwise it shows as an empty bordered box */}
      {supabase && <Section icon={<User size={11} />} label={t.settings.sectionAccount || 'Account'}>
        {/* Auth row */}
        <div style={ROW}>
          <Auth user={user} onSignOut={() => setCfSignOut(true)} />
        </div>
        {cfSignOut && (
          <div style={ROW}>
            <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginBottom: 8 }}>{t.settings.signOutConfirm}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSignOut} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.yes}</button>
              <button onClick={() => setCfSignOut(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
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
                    <div style={{ fontSize: 12, color: needsNickname ? COLORS.yellow : 'var(--text-secondary)', fontFamily: FF.mono, marginTop: 2 }}>
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
                    style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-subtle-2)', border: nickError ? `1.5px solid ${COLORS.red}` : '1px solid var(--border-stronger)', borderRadius: R.md, color: 'var(--text)', fontSize: 13, fontFamily: FF.mono }}
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
                    style={{ minHeight: 44, padding: '10px 16px', background: nickInput.trim().length >= 3 ? COLORS.streak : 'var(--bg-subtle-2)', border: nickInput.trim().length >= 3 ? '2px solid var(--ink)' : 'none', borderBottom: nickInput.trim().length >= 3 ? '3px solid var(--ink)' : 'none', borderRadius: R.md, color: '#fff', fontSize: 12, fontWeight: 700, cursor: nickInput.trim().length >= 3 ? 'pointer' : 'default', opacity: nickSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Check size={14} />{nickSaving ? '...' : 'OK'}
                  </button>
                </div>
                {nickError && <div style={{ fontSize: 11, color: COLORS.red }}>{nickError}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.settings.nickHint}</div>
                  <div style={{ fontSize: 10, fontFamily: FF.mono, color: nickInput.length >= 18 ? COLORS.yellow : 'var(--text-muted)' }}>{nickInput.length}/20</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>}

      {/* ════════ SUBSCRIPTION ════════ */}
      {/* Web (Lemon) self-cancel. Only for premium users; native/season-pass purchases
          report found:false and get a pointer to where they're actually managed. */}
      {supabase && user && isPremium && (
        <Section icon={<CreditCard size={11} />} label={t.settings.sectionSubscription}>
          <div style={ROW_LAST}>
            {subLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</div>
            ) : subErr ? (
              <div style={{ fontSize: 12, color: COLORS.red }}>{t.settings.subLoadError}</div>
            ) : subStatus?.found ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CreditCard size={15} color={COLORS.teal} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.settings.subPro}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {subStatus.cancelled
                        ? `${t.settings.subEndsAt.replace('{date}', fmtDate(subStatus.endsAt))} · ${t.settings.subWontRenew}`
                        : subStatus.status === 'past_due' || subStatus.status === 'unpaid'
                          ? t.settings.subPaymentIssue
                          : subStatus.status === 'paused'
                            ? t.settings.subPaused
                            : t.settings.subRenews.replace('{date}', fmtDate(subStatus.renewsAt))}
                    </div>
                  </div>
                </div>
                {subStatus.cancelled ? (
                  <button
                    onClick={handleResumeSub}
                    disabled={subBusy}
                    style={{ width: '100%', padding: '10px', background: COLORS.teal, border: '2px solid var(--ink)', borderBottom: '3px solid var(--ink)', borderRadius: R.md, color: '#fff', fontSize: 12, fontWeight: 700, cursor: subBusy ? 'wait' : 'pointer', opacity: subBusy ? 0.7 : 1 }}
                  >
                    {subBusy ? '…' : t.settings.subResume}
                  </button>
                ) : !cfCancelSub ? (
                  <button
                    onClick={() => setCfCancelSub(true)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.red, fontSize: 13, fontWeight: 600, padding: 0 }}
                  >
                    <Trash2 size={15} />{t.settings.subCancel}
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginBottom: 8 }}>
                      {fmtDate(subStatus.renewsAt || subStatus.endsAt)
                        ? t.settings.subCancelConfirm.replace('{date}', fmtDate(subStatus.renewsAt || subStatus.endsAt))
                        : t.settings.subCancelConfirmNoDate}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleCancelSub} disabled={subBusy} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: subBusy ? 'wait' : 'pointer', opacity: subBusy ? 0.7 : 1 }}>
                        {subBusy ? '…' : t.settings.subCancelYes}
                      </button>
                      <button onClick={() => setCfCancelSub(false)} disabled={subBusy} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.settings.subNone}</div>
            )}
          </div>
        </Section>
      )}

      {/* ════════ INVITE A FRIEND ════════ */}
      {/* Referrer's invite surface — requires a signed-in user (the code fetch is
          authenticated). Rendered as a standard Section like every other block here. */}
      {supabase && user && (
        <Section icon={<Gift size={11} />} label={t.settings.inviteFriend}>
          <InviteFriend />
        </Section>
      )}

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
        {/* Theme — restored Apr 22 (eye-strain user request) */}
        <div style={{ ...ROW_LAST, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {st.theme === 'dark' ? <Moon size={15} color={COLORS.teal} /> : <Sun size={15} color={COLORS.teal} />}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.settings.theme || 'Тема'}</div>
          </div>
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
            {(['light', 'dark'] as const).map(mode => {
              const active = (st.theme || 'light') === mode;
              return (
                <button key={mode} onClick={() => updSt({ ...st, theme: mode })} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: active ? COLORS.teal : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s' }}>
                  {mode === 'light' ? <Sun size={11} /> : <Moon size={11} />}
                  {mode === 'light' ? (t.settings.lightTheme || 'Светлая') : (t.settings.darkTheme || 'Тёмная')}
                </button>
              );
            })}
          </div>
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
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: FF.mono }}>{goalTarget}/140</span>
                </div>
                <input type="range" min={50} max={140} value={goalTarget} onChange={e => setGoalTarget(+e.target.value)} aria-label={t.settings.targetScore} style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 6, background: 'var(--border)', borderRadius: 3, outline: 'none', WebkitAppearance: 'none', appearance: 'none', margin: 0, padding: 0 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.settings.entDate}</div>
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg-subtle-2)', border: '1px solid var(--border-stronger)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', colorScheme: 'var(--color-scheme)', margin: 0, WebkitAppearance: 'none', appearance: 'none' }} />
              </div>
              <button onClick={() => { updSt({ ...st, goal: { target: goalTarget, date: goalDate } }); setEditGoal(false); }} disabled={!goalDate} style={{ width: '100%', padding: '10px', background: goalDate ? COLORS.xp : 'var(--bg-subtle-2)', border: goalDate ? '2px solid var(--ink)' : 'none', borderBottom: goalDate ? '3px solid var(--ink)' : 'none', borderRadius: R.md, color: goalDate ? 'var(--ink)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: goalDate ? 'pointer' : 'default' }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FF.mono, color: COLORS.teal }}>{st.dailyGoal || 3} {t.settings.dailyGoalUnit}</span>
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
              <button onClick={handleResetProfile} style={{ flex: 1, padding: '10px', background: COLORS.yellow, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.yes}</button>
              <button onClick={() => setCfResetProfile(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}
      </Section>

      {/* ════════ CLASS ════════ */}
      {user && (
        <Section icon={<GraduationCap size={11} />} label={t.settings.sectionClass}>
          {/* Teacher dashboard hidden — 7 classes, 1 member. Access via direct nav('teacher') */}
          {/* Join class with code */}
          <div style={ROW_LAST}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={15} /> {t.teacher.classCode}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={classCode}
                onChange={e => { setClassCode(e.target.value.toUpperCase()); setClassMsg(null); }}
                placeholder="ENT-XXXX"
                aria-label={t.teacher.classCode}
                maxLength={8}
                style={{ flex: 1, padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 13, fontFamily: FF.mono, letterSpacing: 1 }}
              />
              <button
                disabled={classJoining || classCode.length < 6}
                onClick={async () => {
                  if (!supabase || !classCode.trim()) return;
                  setClassJoining(true);
                  setClassMsg(null);
                  try {
                    const session = await supabase.auth.getSession();
                    const token = session?.data.session?.access_token;
                    const res = await fetch(`${API_BASE}/api/teacher?action=join_class`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ code: classCode.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setClassMsg({ ok: false, text: data.error || t.error });
                    } else if (data.already) {
                      setClassMsg({ ok: true, text: t.settings.classAlreadyJoined.replace('{class}', data.class.name) });
                    } else {
                      setClassMsg({ ok: true, text: t.settings.classJoined.replace('{class}', data.class.name).replace('{school}', data.class.school) });
                      setClassCode('');
                    }
                  } catch {
                    setClassMsg({ ok: false, text: t.settings.classJoinNetworkError });
                  } finally {
                    setClassJoining(false);
                  }
                }}
                style={{ padding: '10px 16px', borderRadius: R.md, background: COLORS.teal, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: classCode.length >= 6 ? 'pointer' : 'default', opacity: classCode.length >= 6 ? 1 : 0.5 }}
              >
                {classJoining ? '...' : t.settings.classJoinButton}
              </button>
            </div>
            {classMsg && (
              <div style={{ fontSize: 12, color: classMsg.ok ? COLORS.green : COLORS.red, marginTop: 6 }}>{classMsg.text}</div>
            )}
          </div>
        </Section>
      )}

      {/* ════════ AUTHOR / CONTACT ════════ */}
      <Section icon={<Heart size={11} />} label={t.settings.sectionAbout}>
        <div style={{ ...ROW, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/favicon.svg" alt="" aria-hidden="true" width={42} height={42} style={{
            display: 'block', borderRadius: 12,
            border: '2px solid var(--ink)',
            boxShadow: '0 2px 0 0 var(--ink)',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {t.settings.authorName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {t.settings.authorTagline}
            </div>
          </div>
        </div>
        {[
          { icon: MessageCircle, color: '#25D366', label: 'WhatsApp', sub: '+7 705 234 0280', href: 'https://wa.me/77052340280?text=' + encodeURIComponent('Привет! Пишу с ENTprep') },
          { icon: Send, color: '#0088CC', label: 'Telegram', sub: '@adletseitenov', href: 'https://t.me/adletseitenov' },
          { icon: Instagram, color: '#E1306C', label: 'Instagram', sub: '@upalstudy', href: 'https://instagram.com/upalstudy' },
          { icon: AtSign, color: 'var(--ink)', label: 'TikTok', sub: '@upalstudy', href: 'https://tiktok.com/@upalstudy' },
          { icon: Mail, color: 'var(--ink)', label: t.settings.contactEmail, sub: 'entprep.app@gmail.com', href: 'mailto:entprep.app@gmail.com', last: true },
        ].map((item, i, arr) => (
          <a
            key={item.label}
            href={item.href}
            target={item.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noopener noreferrer"
            style={{
              ...(i === arr.length - 1 ? ROW_LAST : ROW),
              display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: R.md,
              background: `${item.color}12`,
              border: `2px solid ${item.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <item.icon size={16} color={item.color} strokeWidth={2.25} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: FF.mono, marginTop: 2 }}>{item.sub}</div>
            </div>
            <ExternalLink size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </a>
        ))}
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
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, fontFamily: FF.mono }}>{v}</span>
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
              <button onClick={() => { clearHist(); setCf(false); }} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.settings.deleteConfirm}</button>
              <button onClick={() => setCf(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
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
              <button onClick={handleDeleteAccount} disabled={deletingAccount} style={{ flex: 1, padding: '10px', background: COLORS.red, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: deletingAccount ? 0.6 : 1 }}>{deletingAccount ? '...' : (t.settings.deleteConfirm)}</button>
              <button onClick={() => setCfDeleteAccount(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>{t.cancel}</button>
            </div>
          </div>
        )}
      </Section>

      {/* ════════ ABOUT ════════ */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FF.display }}>
          <span style={{ color: 'var(--text)' }}>ENT</span><span style={{ color: COLORS.streak }}>prep.</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{t.settings.version} • {getTotalQ()} {t.settings.questionsCount} • {Math.floor(getPoolSize('reading') / 5)} {t.settings.textsCount}</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{UNIS.length} {t.settings.unisFormat}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}>
            <Shield size={10} /> {t.settings.privacy}
          </a>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}>
            <Shield size={10} /> {t.settings.terms}
          </a>
          <a href="/offer.html" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}>
            <Shield size={10} /> {t.settings.offer}
          </a>
        </div>
      </div>
    </div>
  );
}
