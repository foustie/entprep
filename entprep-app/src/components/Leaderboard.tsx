import React, { useState, useEffect, useMemo, memo } from 'react';
import { COLORS, FF } from '../constants/styles';
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { getFriendIds } from '../utils/socialHelpers';
import { useT } from '../locales';
import BackButton from './ui/BackButton';
import EmptyState from './ui/EmptyState';
import SkeletonCard from './ui/SkeletonCard';
import Chip from './ui/Chip';
import Button from './ui/Button';
import { Trophy, Medal, Users, Activity, UserPlus } from 'lucide-react';

interface LeaderboardRow {
  id: string;
  user_id: string;
  user_name: string;
  nickname?: string;
  avatar_url?: string;
  subject: string;
  score: number;
  created_at: string;
}

interface AggregatedUser {
  user_id: string;
  user_name: string;
  nickname?: string;
  avatar_url?: string;
  testCount: number;
  avgScore: number;
}

type Period = 'week' | 'month' | 'all';
type Scope = 'all' | 'friends';

function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === 'week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.toISOString();
}

function pluralTests(n: number, t1: string, t2: string, t5: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${t1}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${t2}`;
  return `${n} ${t5}`;
}

export default function Leaderboard() {
  const { goHome, nav } = useNav();
  const { user } = useAuth();
  const bp = useBreakpoint();
  const t = useT();
  const [scope, setScope] = useState<Scope>('all');
  const [period, setPeriod] = useState<Period>('week');
  const [filter, setFilter] = useState<string>('all');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[] | null>(null);

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'week', label: t.leaderboard.week },
    { id: 'month', label: t.leaderboard.month },
    { id: 'all', label: t.leaderboard.allTime },
  ];

  const SCOPES: { id: Scope; label: string }[] = [
    { id: 'all', label: t.leaderboard.allTab },
    { id: 'friends', label: t.leaderboard.friendsTab },
  ];

  const ALL_SUBJECTS = [
    ...Object.values(SUBS).map(s => ({ id: s.id, name: (t.subjects as Record<string, string>)[s.id] || s.name, color: s.color })),
    ...ALL_PROFILES.map(p => ({ id: p.id, name: (t.subjects as Record<string, string>)[p.id] || p.name, color: p.color })),
  ];

  // Load friend IDs when switching to friends scope
  useEffect(() => {
    if (scope !== 'friends' || !user) { setFriendIds(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const ids = await getFriendIds();
        // Include self
        if (!cancelled) setFriendIds([user.id, ...ids]);
      } catch {
        if (!cancelled) setFriendIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, user]);

  useEffect(() => {
    let cancelled = false;
    // Skip if friends scope but IDs not loaded yet
    if (scope === 'friends' && friendIds === null) return;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ period, subject: filter });
        if (scope === 'friends' && friendIds && friendIds.length > 0) {
          params.set('user_ids', friendIds.join(','));
        }
        const res = await fetch(`/api/leaderboard?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [period, filter, scope, friendIds]);

  const ranked = useMemo<AggregatedUser[]>(() => {
    // Server now returns pre-aggregated data with avgScore + testCount
    // But handle both formats for backwards compatibility
    if (rows.length > 0 && 'avgScore' in rows[0]) {
      return (rows as unknown as AggregatedUser[]).slice(0, 50);
    }
    // Legacy: aggregate on client
    const map = new Map<string, { user_name: string; nickname?: string; avatar_url?: string; total: number; sum: number }>();
    for (const r of rows) {
      const entry = map.get(r.user_id);
      if (entry) { entry.total++; entry.sum += r.score; }
      else map.set(r.user_id, { user_name: r.user_name, nickname: r.nickname, avatar_url: r.avatar_url, total: 1, sum: r.score });
    }
    return Array.from(map.entries())
      .map(([uid, v]) => ({
        user_id: uid,
        user_name: v.user_name,
        nickname: v.nickname,
        avatar_url: v.avatar_url,
        testCount: v.total,
        avgScore: Math.round(v.sum / v.total),
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.testCount - a.testCount)
      .slice(0, 50);
  }, [rows]);

  const periodChipExtra: React.CSSProperties = { padding: '8px 16px', fontSize: 12, flex: 1, textAlign: 'center' };

  const medalColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return null;
  };

  const LeaderboardRow = useMemo(() => memo(function LeaderboardRow({ entry, rank, isMe }: { entry: AggregatedUser; rank: number; isMe: boolean }) {
    const medal = medalColor(rank);
    const scoreColor = entry.avgScore >= 80 ? COLORS.win : entry.avgScore >= 60 ? COLORS.xp : COLORS.streak;
    const scoreBg = entry.avgScore >= 80 ? COLORS.winSoft : entry.avgScore >= 60 ? COLORS.xpSoft : COLORS.streakSoft;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: isMe ? COLORS.streakSoft : 'var(--bg-card)',
          border: '2px solid var(--ink)',
          borderRadius: 12,
          boxShadow: isMe ? `0 3px 0 0 ${COLORS.streak}` : '0 2px 0 0 var(--ink)',
          animation: `fadeIn 0.3s ease ${Math.min((rank - 1) * 0.03, 0.5)}s both`,
        }}
      >
        {/* Rank badge — ink chip */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: medal ? medal : 'var(--ink)',
          border: '2px solid var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
        }}>
          {rank <= 3 ? (
            <Medal size={17} color={medal === '#FFD700' ? 'var(--ink)' : '#fff'} strokeWidth={2.4} />
          ) : (
            <span style={{
              fontFamily: FF.display, fontSize: 13, fontWeight: 900,
              letterSpacing: '-0.02em', color: '#fff',
            }}>{rank}</span>
          )}
        </div>

        {/* Avatar */}
        {entry.avatar_url && (
          <img
            src={entry.avatar_url}
            alt=""
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1.5px solid var(--ink)',
              flexShrink: 0, objectFit: 'cover',
            }}
          />
        )}

        {/* Name + "You" badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Nunito',sans-serif", fontSize: 13.5, fontWeight: 800,
            color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {entry.nickname && !entry.nickname.startsWith('user_') ? (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800 }}>@{entry.nickname}</span>
            ) : entry.user_name}
            {isMe && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 8.5, fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#fff', background: COLORS.streak,
                padding: '2px 6px', borderRadius: 5,
              }}>{t.you}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Activity size={10} color="var(--text-muted)" strokeWidth={2.4} />
            <span style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)',
            }}>{pluralTests(entry.testCount, t.leaderboard.test1, t.leaderboard.test2, t.leaderboard.test5)}</span>
          </div>
        </div>

        {/* Avg score — tabular nums pill */}
        <div style={{
          fontFamily: FF.display,
          fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em',
          color: scoreColor, fontVariantNumeric: 'tabular-nums',
          background: scoreBg,
          border: `1.5px solid ${scoreColor}`,
          padding: '5px 9px', borderRadius: 9,
          flexShrink: 0,
        }}>
          {entry.avgScore}%
        </div>
      </div>
    );
  }), [t]);

  return (
    <div style={{ padding: `0 var(--content-padding) ${bp === 'desktop' ? 40 : 100}px` }}>
      <BackButton onClick={goHome} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 18px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: COLORS.xp,
          border: '2px solid var(--ink)',
          boxShadow: '0 3px 0 0 var(--ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Trophy size={20} color='var(--ink)' strokeWidth={2.4} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 2,
          }}>{t.leaderboard.subtitle}</div>
          <h1 style={{
            fontFamily: FF.display, fontSize: 20, fontWeight: 900,
            letterSpacing: '-0.035em', color: 'var(--text)', margin: 0, lineHeight: 1,
          }}>{t.leaderboard.title}</h1>
        </div>
      </div>

      {/* Scope: All / Friends */}
      {user && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {SCOPES.map(s => (
            <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)} style={{ flex: 1, padding: '9px 16px', fontSize: 12, textAlign: 'center' }}>
              {s.label}
            </Chip>
          ))}
        </div>
      )}

      {/* Period toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {PERIODS.map(p => (
          <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)} activeColor="accent" style={periodChipExtra}>{p.label}</Chip>
        ))}
      </div>

      {/* Subject filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14, WebkitOverflowScrolling: 'touch' as never }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>{t.leaderboard.allSubjects}</Chip>
        {ALL_SUBJECTS.map(s => (
          <Chip key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)}>{s.name}</Chip>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}
        </div>
      ) : ranked.length === 0 ? (
        scope === 'friends' ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <EmptyState icon={Users} title={t.leaderboard.noFriendsResults} description={t.leaderboard.addFriendsHint} />
            <Button size="md" Icon={UserPlus} onClick={() => nav('friends')} style={{ marginTop: 12, display: 'inline-flex' }}>
              {t.leaderboard.addFriends}
            </Button>
          </div>
        ) : (
          <EmptyState icon={Users} title={t.leaderboard.noResultsYet} description={t.leaderboard.takeTestHint} />
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranked.map((entry, i) => (
            <LeaderboardRow key={entry.user_id} entry={entry} rank={i + 1} isMe={!!user && entry.user_id === user.id} />
          ))}
        </div>
      )}
    </div>
  );
}
