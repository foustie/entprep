import React from 'react';
import { CARD_COMPACT, COLORS } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { useT } from '../locales';
import { calcTotalXP, getLevel } from '../utils/xpHelpers';
import { calcStreak } from '../utils/adaptiveHelpers';
import { User, Flame, Zap, BarChart3, Trophy, Calculator, Settings as SettingsIcon, ChevronRight, Users, Snowflake } from 'lucide-react';
import StatBadge from './ui/StatBadge';

export default function ProfileTab() {
  const { hist, st } = useApp();
  const { user, profile, isPremium } = useAuth();
  const { nav } = useNav();
  const bp = useBreakpoint();
  const t = useT();

  const totalXP = calcTotalXP(hist);
  const lvl = getLevel(totalXP);
  const levelName = (t.levels as Record<number, string>)?.[lvl.level] || lvl.name;
  const streak = calcStreak(hist, isPremium, st.streakFreezeUsedAt);
  const regular = hist.filter(h => h.type !== 'fullent');
  const avg = regular.length ? Math.round(regular.reduce((s, h) => s + (h.sc || 0), 0) / regular.length) : 0;

  const nickname = profile?.nickname || (user?.user_metadata?.full_name as string | undefined) || 'ENTprep User';
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string | undefined) || null;

  return (
    <div style={{ padding: `0 var(--content-padding) ${bp === 'desktop' ? 40 : 100}px` }}>
      {/* === User Card === */}
      <div style={{
        padding: '24px 20px',
        borderRadius: 20,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 56, height: 56, borderRadius: 28,
          background: avatarUrl ? 'transparent' : `linear-gradient(135deg, ${COLORS.accent}22, ${COLORS.teal}22)`,
          border: `2px solid ${lvl.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <User size={28} color="var(--text-muted)" />
          )}
        </div>
        {/* Name + level */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {nickname}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: lvl.color, fontWeight: 600, marginTop: 4,
          }}>
            <Zap size={14} color={lvl.color} />
            Ур. {lvl.level}: {levelName}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {totalXP} XP
            </span>
          </div>
        </div>
      </div>

      {/* === Quick Stats === */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 24,
      }}>
        <StatBadge value={regular.length} label={t.progress?.testsCount?.replace(/\s*$/, '') || 'Тестов'} color={COLORS.accent} />
        <StatBadge value={avg + '%'} label={(t.home as Record<string, string>).avgLabel || 'Средний'} color={COLORS.teal} />
        <StatBadge
          value={streak.current}
          label={streak.frozenToday ? (t.home as Record<string, string>).frozen || 'Заморожено' : (t.home as Record<string, string>).streak || 'Серия'}
          color={streak.frozenToday ? COLORS.blue : COLORS.amber}
          Icon={streak.frozenToday ? Snowflake : Flame}
        />
        <StatBadge value={lvl.level} label={levelName} color={lvl.color} Icon={Zap} />
      </div>

      {/* === Navigation cards to sub-sections === */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        {[
          { icon: <BarChart3 size={18} color={COLORS.teal} />, label: (t.tabs as Record<string, string>).progress || 'Прогресс', target: 'prog' },
          { icon: <Users size={18} color={COLORS.green} />, label: (t.home as Record<string, string>).friends || 'Друзья', target: 'friends' },
          { icon: <Trophy size={18} color={COLORS.amber} />, label: (t.home as Record<string, string>).leaderboard || 'Рейтинг', target: 'leaderboard' },
          { icon: <Calculator size={18} color={COLORS.purple} />, label: (t.home as Record<string, string>).grantCalc || 'Калькулятор грантов', target: 'calc' },
          { icon: <SettingsIcon size={18} color="var(--text-muted)" />, label: (t.tabs as Record<string, string>).settings || 'Настройки', target: 'settings' },
        ].map(item => (
          <button
            key={item.target}
            onClick={() => nav(item.target)}
            style={{
              ...CARD_COMPACT,
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '14px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              gap: 12,
              transition: 'background 0.15s',
            }}
          >
            {item.icon}
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              {item.label}
            </span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        ))}
      </div>
    </div>
  );
}
