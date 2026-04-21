import { useState, useMemo } from 'react';
import { CARD_COMPACT, COLORS, TYPE, scoreColor, SECTION_LABEL } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../contexts/AppContext';
import { useNav } from '../contexts/NavigationContext';
import { SUBJECT_META } from '../config/subjects';
import SubjectIcon from './ui/SubjectIcon';
import BackButton from './ui/BackButton';
import EmptyState from './ui/EmptyState';
import { formatTime } from '../utils/formatters';
import { History, ChevronDown, ChevronUp, Check, X, Clock, Target, Filter } from 'lucide-react';
import Chip from './ui/Chip';

export default function TestHistory() {
  const { hist, st } = useApp();
  const { goHome } = useNav();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  const [filterSub, setFilterSub] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const subName = (id: string) => SUBJECT_META[id as keyof typeof SUBJECT_META]?.name || id;

  const activeSubjects = useMemo(
    () => [...new Set(hist.map(h => h.su))],
    [hist],
  );

  const sorted = useMemo(() => {
    let items = [...hist];
    if (filterSub !== 'all') items = items.filter(h => h.su === filterSub);
    return items.reverse();
  }, [hist, filterSub]);

  // Stats
  const totalTests = hist.length;
  const avgScore = totalTests > 0 ? Math.round(hist.reduce((s, h) => s + h.sc, 0) / totalTests) : 0;
  const bestScore = totalTests > 0 ? Math.max(...hist.map(h => h.sc)) : 0;

  if (hist.length === 0) {
    return (
      <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
        <BackButton onClick={goHome} label="Назад" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 24px' }}>
          <History size={22} color={COLORS.teal} />
          <h2 style={{ ...TYPE.h2 }}>История тестов</h2>
        </div>
        <EmptyState
          icon={History}
          title="Пока пусто"
          description="Пройдите тест, чтобы увидеть историю. Каждый тест делает вас сильнее!"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <BackButton onClick={goHome} label="Назад" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px' }}>
        <History size={22} color={COLORS.teal} />
        <h2 style={{ ...TYPE.h2 }}>История тестов</h2>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Тестов', value: String(totalTests), color: COLORS.teal },
          { label: 'Средний', value: `${avgScore}%`, color: scoreColor(avgScore) },
          { label: 'Лучший', value: `${bestScore}%`, color: scoreColor(bestScore) },
        ].map(s => (
          <div key={s.label} style={{ ...CARD_COMPACT, flex: 1, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={filterSub === 'all'} onClick={() => { setFilterSub('all'); setExpandedIdx(null); }} mode="subtle">
          <Filter size={10} style={{ verticalAlign: '-1px', marginRight: 3 }} />Все
        </Chip>
        {activeSubjects.map(s => (
          <Chip key={s} active={filterSub === s} onClick={() => { setFilterSub(s); setExpandedIdx(null); }} mode="subtle">
            {subName(s)}
          </Chip>
        ))}
      </div>

      {/* Test list */}
      <div style={{ ...SECTION_LABEL }}>Результаты ({sorted.length})</div>
      {sorted.map((t, i) => {
        const expanded = expandedIdx === i;
        const meta = SUBJECT_META[t.su as keyof typeof SUBJECT_META];
        const color = meta?.color || COLORS.teal;

        return (
          <div key={i} style={{ ...CARD_COMPACT, padding: 0, marginBottom: 8, overflow: 'hidden' }}>
            {/* Card header */}
            <button
              onClick={() => setExpandedIdx(expanded ? null : i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <SubjectIcon sid={t.su} size={20} color={color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {subName(t.su)}
                  {t.type && t.type !== 'regular' && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: COLORS.purple }}>
                      {t.type === 'fullent' ? 'Full ENT' : t.type === 'duel' ? 'Дуэль' : t.type}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span>{t.dt}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Clock size={9} />{formatTime(t.tm ?? 0)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Target size={9} />{t.co}/{t.to}
                  </span>
                  {t.tp && <span style={{ color: 'var(--text-secondary)' }}>• {t.tp}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: scoreColor(t.sc) }}>{t.sc}%</span>
                {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
              </div>
            </button>

            {/* Expanded detail */}
            {expanded && t.qd && t.qd.length > 0 && (
              <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '8px 0 6px', fontWeight: 600 }}>Детализация по вопросам</div>
                {t.qd.map((q, qi) => (
                  <div key={qi} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                    borderBottom: qi < t.qd!.length - 1 ? '1px solid var(--bg-subtle)' : 'none',
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", width: 20, flexShrink: 0 }}>
                      #{q.oi + 1}
                    </span>
                    {q.ok
                      ? <Check size={13} color={COLORS.green} strokeWidth={2.5} />
                      : <X size={13} color={COLORS.red} strokeWidth={2.5} />
                    }
                    {q.tp && (
                      <span style={{ fontSize: 9, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.tp}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {expanded && (!t.qd || t.qd.length === 0) && (
              <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Детализация недоступна для этого теста
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
