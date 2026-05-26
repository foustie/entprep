import { useState } from 'react';
import type { CSSProperties } from 'react';
import { COLORS, FF, FW, TINT } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { calcTotalXP, getLevel } from '../utils/xpHelpers';
import { calcStreak } from '../utils/adaptiveHelpers';
import { reconcileMyOrder } from '../utils/reconcileHelpers';
import {
  User, Flame, Zap, BarChart3, Trophy, Calculator,
  Settings as SettingsIcon, ChevronRight, Snowflake, Sparkles,
  ArrowRight,
} from 'lucide-react';
import PaywallScreen from './ui/PaywallScreen';

const INK = 'var(--ink)';

export default function ProfileTab() {
  const { hist, st } = useApp();
  const { user, profile, isPremium, needsNickname, refreshUser } = useAuth();
  const { nav } = useNav();
  const bp = useBreakpoint();
  const t = useT();
  const toast = useToast();

  const [showPaywall, setShowPaywall] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverOrderId, setRecoverOrderId] = useState('');
  const [recoverBusy, setRecoverBusy] = useState(false);

  const submitRecover = async () => {
    const id = recoverOrderId.trim();
    if (!/^\d+$/.test(id)) {
      toast.error('Введите номер заказа (только цифры)');
      return;
    }
    setRecoverBusy(true);
    try {
      const result = await reconcileMyOrder(id);
      await refreshUser();
      toast.success(`Премиум активирован до ${new Date(result.premiumUntil).toLocaleDateString('ru-RU')}`);
      setRecoverOpen(false);
      setRecoverOrderId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setRecoverBusy(false);
    }
  };
  const totalXP = calcTotalXP(hist);
  const lvl = getLevel(totalXP);
  const levelName = (t.levels as Record<number, string>)?.[lvl.level] || lvl.name;
  const streak = calcStreak(hist, isPremium, st.streakFreezeUsedAt);
  const regular = hist.filter(h => h.type !== 'fullent');
  const avg = regular.length
    ? Math.round(regular.reduce((s, h) => s + (h.sc || 0), 0) / regular.length)
    : 0;

  // Display name priority: profiles.display_name (Google full_name at signup)
  // → user_metadata.full_name (live OAuth data) → custom nickname (if user set one)
  // → fallback. NEVER show auto-generated "user_abcd1234" as primary name.
  const customNickname = profile?.nickname && !profile.nickname.startsWith('user_')
    ? profile.nickname : null;
  const displayName = profile?.display_name
    || (user?.user_metadata?.full_name as string | undefined)
    || customNickname
    || 'ENTprep User';
  const avatarUrl = profile?.avatar_url
    || (user?.user_metadata?.avatar_url as string | undefined)
    || null;

  const StreakIcon = streak.frozenToday ? Snowflake : Flame;
  const streakColor = streak.frozenToday ? '#38BDF8' : COLORS.streak;

  return (
    <div style={{ padding: `20px var(--content-padding) ${bp === 'desktop' ? 40 : 80}px` }}>
      {/* User card — 3D ink shadow */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 18px',
        background: 'var(--bg-card)',
        border: `2px solid ${INK}`,
        borderRadius: 18,
        boxShadow: `0 4px 0 0 ${INK}`,
        marginBottom: 18,
      }}>
        {/* Avatar */}
        <div style={{
          position: 'relative',
          flexShrink: 0,
          width: 60, height: 60, borderRadius: '50%',
          background: avatarUrl ? 'transparent' : INK,
          color: COLORS.xp,
          border: `3px solid ${COLORS.xp}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              fontFamily: FF.display, fontSize: 26, fontWeight: 900,
              letterSpacing: '-0.04em',
            }}>
              {displayName[0]?.toUpperCase() || <User size={24} />}
            </span>
          )}
        </div>

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{
              fontFamily: FF.display,
              fontSize: 17, fontWeight: 900,
              letterSpacing: '-0.025em',
              color: COLORS.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {displayName}
            </span>
            {isPremium && (
              <span style={{
                flexShrink: 0,
                fontFamily: FF.display, fontSize: 9, fontWeight: 900,
                letterSpacing: '0.12em',
                background: COLORS.streak,
                color: '#fff',
                padding: '3px 7px', borderRadius: 6,
                border: `1.5px solid ${INK}`,
              }}>
                PRO
              </span>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 999,
              background: TINT.xp.bg,
              border: `1px solid ${TINT.xp.border}`,
            }}>
              <Zap size={11} color="#C77D00" strokeWidth={2.8} fill="#FFC233" />
              <span style={{
                fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
                color: '#8A5B00', letterSpacing: '0.05em',
              }}>
                ур. {lvl.level} · {totalXP} XP
              </span>
            </div>
          </div>
          <div style={{
            fontFamily: FF.body, fontSize: 12, fontWeight: FW.semibold,
            color: COLORS.textSecondary, marginTop: 4,
          }}>
            {levelName}
          </div>
          {/* Nickname handle OR "choose nickname" CTA */}
          {user && profile && (
            needsNickname ? (
              <button
                onClick={() => nav('settings')}
                style={{
                  marginTop: 6,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 999,
                  background: COLORS.streakSoft || 'rgba(255,90,54,0.12)',
                  border: `1px solid ${COLORS.streak}`,
                  color: COLORS.streak,
                  fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                ✎ выбери ник
              </button>
            ) : (
              <div style={{
                marginTop: 6,
                fontFamily: FF.mono, fontSize: 11, fontWeight: 700,
                color: COLORS.textMuted,
                letterSpacing: '0.02em',
              }}>
                @{profile.nickname}
              </div>
            )
          )}
        </div>
      </div>

      {/* Stats grid 3-col */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        marginBottom: 18,
      }}>
        <StatCard
          value={regular.length}
          label={(t.progress as unknown as Record<string, string>).testsCount?.replace(/\s*$/, '') || 'Тестов'}
          color={COLORS.text}
        />
        <StatCard
          value={`${avg}`}
          suffix="%"
          label={(t.home as Record<string, string>).avgLabel || 'Средний'}
          color={avg >= 70 ? COLORS.win : avg >= 50 ? COLORS.xp : COLORS.text}
        />
        <StatCard
          value={streak.current}
          label={streak.frozenToday
            ? (t.home as Record<string, string>).frozen || 'Заморожено'
            : (t.home as Record<string, string>).streak || 'Серия'}
          color={streakColor}
          Icon={StreakIcon}
        />
      </div>

      {/* PRO upsell — non-premium authed users */}
      {user && !isPremium && (
        <>
          <ProBanner
            featureText={`${(t.paywall as Record<string, string>)?.feat1 || 'AI без лимита'} · ${(t.paywall as Record<string, string>)?.ctaSeason || '4 990₸ за сезон'}`}
            onClick={() => setShowPaywall(true)}
          />
          {/* Self-service recovery — for users who paid with a different email
              than they registered with (common KZ pattern: parent's card → parent's email). */}
          <div style={{ marginTop: 6, marginBottom: 14, textAlign: 'center' }}>
            {!recoverOpen ? (
              <button
                onClick={() => setRecoverOpen(true)}
                style={{
                  background: 'transparent', border: 'none',
                  fontFamily: FF.body, fontSize: 11.5, fontWeight: FW.semibold,
                  color: COLORS.textMuted,
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                  cursor: 'pointer', padding: '4px 8px',
                }}
              >
                Оплатил, но PRO не активирован? Восстановить
              </button>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: 12,
                background: 'var(--bg-subtle)',
                border: `2px solid ${INK}`,
                borderRadius: 12,
                textAlign: 'left',
              }}>
                <div style={{
                  fontFamily: FF.body, fontSize: 12, fontWeight: FW.semibold,
                  color: COLORS.textSecondary, lineHeight: 1.4,
                }}>
                  Номер заказа из письма Lemon Squeezy («Order #12345»):
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={recoverOrderId}
                  onChange={(e) => setRecoverOrderId(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345"
                  disabled={recoverBusy}
                  style={{
                    fontFamily: FF.mono, fontSize: 14, fontWeight: 700,
                    padding: '10px 12px',
                    border: `2px solid ${INK}`,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    color: COLORS.text,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={submitRecover}
                    disabled={recoverBusy || !recoverOrderId}
                    style={{
                      flex: 1,
                      background: COLORS.streak, color: '#fff',
                      border: `2px solid ${INK}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontFamily: FF.display, fontSize: 12, fontWeight: 900,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      cursor: recoverBusy ? 'wait' : 'pointer',
                      opacity: !recoverOrderId || recoverBusy ? 0.6 : 1,
                    }}
                  >
                    {recoverBusy ? 'Проверка…' : 'Восстановить'}
                  </button>
                  <button
                    onClick={() => { setRecoverOpen(false); setRecoverOrderId(''); }}
                    disabled={recoverBusy}
                    style={{
                      background: 'transparent', color: COLORS.textMuted,
                      border: `2px solid ${COLORS.cardBorder}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontFamily: FF.body, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Nav section */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        marginBottom: 24,
      }}>
        {[
          { icon: BarChart3,    label: (t.tabs as Record<string, string>).progress || 'Прогресс',          target: 'prog',        color: COLORS.win,    bg: TINT.win.bgLight },
          { icon: Trophy,       label: (t.home as Record<string, string>).leaderboard || 'Рейтинг',        target: 'leaderboard', color: COLORS.xp,     bg: TINT.xp.bgLight },
          { icon: Calculator,   label: (t.home as Record<string, string>).grantCalc || 'Калькулятор',      target: 'calc',        color: COLORS.streak, bg: TINT.streak.bgLight },
          { icon: SettingsIcon, label: (t.tabs as Record<string, string>).settings || 'Настройки',         target: 'settings',    color: COLORS.text,   bg: 'var(--bg-subtle)' },
        ].map(item => (
          <NavRow key={item.target} {...item} onClick={() => nav(item.target)} />
        ))}
      </div>

      {showPaywall && (
        <PaywallScreen
          trigger="fullent_result"
          score={avg ? Math.round(avg * 1.4) : undefined}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────────────────
function StatCard({
  value, suffix, label, color, Icon,
}: {
  value: number | string;
  suffix?: string;
  label: string;
  color: string;
  Icon?: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string; fill?: string }>;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 6px',
      background: 'var(--bg-card)',
      border: `2px solid ${INK}`,
      borderRadius: 14,
      boxShadow: `0 3px 0 0 ${INK}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        {Icon && <Icon size={16} color={color} strokeWidth={2.4} fill={color === COLORS.streak ? color : undefined} />}
        <span style={{
          fontFamily: FF.display,
          fontSize: 22, fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        {suffix && (
          <span style={{
            fontFamily: FF.display, fontSize: 12, fontWeight: 800,
            color, opacity: 0.7,
          }}>
            {suffix}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: FF.mono, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: COLORS.textMuted, marginTop: 5,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── PRO banner (streak CTA + press depth) ───────────────────────────────
function ProBanner({ featureText, onClick }: { featureText: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const style: CSSProperties = {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
    color: '#fff',
    border: `2px solid ${INK}`,
    borderRadius: 16,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 90ms, box-shadow 90ms',
    boxShadow: pressed
      ? `0 1px 0 0 ${INK}, 0 0 20px rgba(255,90,54,0.25)`
      : `0 5px 0 0 ${INK}, 0 0 40px rgba(255,90,54,0.3)`,
    transform: pressed ? 'translateY(4px)' : 'none',
    marginBottom: 18,
  };
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      <span style={{
        flexShrink: 0,
        width: 40, height: 40, borderRadius: 12,
        background: '#fff', color: COLORS.streak,
        border: `2px solid ${INK}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={20} strokeWidth={2.5} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block',
          fontFamily: FF.display, fontSize: 14, fontWeight: 900,
          letterSpacing: '0.03em', textTransform: 'uppercase',
          lineHeight: 1.1,
        }}>
          ENTprep PRO
        </span>
        <span style={{
          display: 'block',
          fontFamily: FF.body, fontSize: 11, fontWeight: FW.bold,
          opacity: 0.9, marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {featureText}
        </span>
      </span>
      <ArrowRight size={18} strokeWidth={3} />
    </button>
  );
}

// ── NavRow with press depth ─────────────────────────────────────────────
function NavRow({
  icon: Icon, label, color, bg, onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  target: string;
  color: string;
  bg: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%',
    padding: '12px 14px',
    background: 'var(--bg-card)',
    border: `2px solid ${INK}`,
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 80ms, box-shadow 80ms',
    boxShadow: pressed ? `0 1px 0 0 ${INK}` : `0 3px 0 0 ${INK}`,
    transform: pressed ? 'translateY(2px)' : 'none',
  };
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      <span style={{
        flexShrink: 0,
        width: 36, height: 36, borderRadius: 10,
        background: bg,
        border: `1.5px solid ${color}`,
        color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} strokeWidth={2.3} color={color} />
      </span>
      <span style={{
        flex: 1,
        fontFamily: FF.body, fontSize: 14, fontWeight: 800,
        color: COLORS.text,
      }}>
        {label}
      </span>
      <ChevronRight size={16} color={COLORS.textMuted} strokeWidth={2.4} />
    </button>
  );
}
