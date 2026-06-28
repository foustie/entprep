import { useState, useEffect } from 'react';
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { TOPIC_MAP } from '../config/topics';
import { CARD_COMPACT, TYPE, COLORS, FS, R } from '../constants/styles';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { useT } from '../locales';
import { pluralizeForms } from '../utils/formatters';
import BackButton from './ui/BackButton';
import SubjectIcon from './ui/SubjectIcon';
import { Play, MessageCircle, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  sid: string;
  topicId: string;
  topicName?: string;
  /** Top-level back handler. When set, the back button at the subject root calls this
   *  (e.g. the Theory screen returns to its subject picker) instead of nav('topics'). */
  onBack?: () => void;
}

type SummaryData = Record<string, { ru: string; kk?: string }>;

export default function TheorySummary({ sid, topicId, onBack }: Props) {
  const { nav } = useNav();
  const { st } = useApp();
  const t = useT();
  const isKk = st.lang === 'kk';
  const sub = SUBS[sid] || ALL_PROFILES.find(p => p.id === sid);
  const topics = TOPIC_MAP[sid];

  const [allSummaries, setAllSummaries] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(topicId === '_all' ? null : topicId);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/summaries/${sid}.json`)
      .then(res => res.ok && res.headers.get('content-type')?.includes('json') ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        setAllSummaries(data);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sid]);

  const handleBack = () => {
    if (selectedTopic) {
      setSelectedTopic(null);
    } else if (onBack) {
      onBack();
    } else {
      nav('topics', sid);
    }
  };

  const getTopicName = (id: string): string => {
    if (!topics) return id;
    for (const tp of topics) {
      if (tp.id === id) return isKk && tp.name_kk ? tp.name_kk : tp.name;
      for (const st of tp.subtopics || []) {
        if (st.id === id) return isKk && st.name_kk ? st.name_kk : st.name;
      }
    }
    return id;
  };

  // Markdown rendering
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 10 }} />;
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: sub?.color || COLORS.teal, margin: '18px 0 8px', padding: 0 }}>{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 4 }}>
            <span style={{ color: sub?.color || COLORS.teal, fontWeight: 700, flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.7 }}>{renderBold(trimmed.slice(2))}</span>
          </div>
        );
      }
      return <p key={i} style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.75, margin: '0 0 6px' }}>{renderBold(trimmed)}</p>;
    });
  };

  const renderBold = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>{part}</strong>
        : <span key={i}>{part}</span>
    );
  };

  // === SINGLE TOPIC VIEW ===
  if (selectedTopic && allSummaries) {
    const entry = allSummaries[selectedTopic];
    const summary = (isKk && entry?.kk) ? entry.kk : entry?.ru;
    const name = getTopicName(selectedTopic);

    return (
      <div style={{ padding: '0 var(--content-padding) 100px' }}>
        <BackButton onClick={handleBack} style={{ marginBottom: 14 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: R.md, background: (sub?.color || COLORS.teal) + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={22} color={sub?.color || COLORS.teal} />
          </div>
          <div>
            <h1 style={{ ...TYPE.h2, fontSize: FS.xl, margin: 0 }}>{name}</h1>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.theory.topicSummary}</div>
          </div>
        </div>

        {summary ? (
          <>
            <div style={{ ...CARD_COMPACT, padding: '20px 18px', borderLeft: `3px solid ${sub?.color || COLORS.teal}` }}>
              {renderContent(summary)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => nav('test', sid, selectedTopic)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: sub?.color || COLORS.streak,
                  color: '#fff', border: '2px solid var(--ink)', borderBottom: '4px solid var(--ink)',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Play size={16} />
                {t.theory.checkYourself}
              </button>
              <a
                href={`https://wa.me/77052340280?text=${encodeURIComponent(t.theory.fixMessage.replace('{topic}', name))}`}
                target="_blank" rel="noopener noreferrer"
                aria-label={t.theory.fix}
                style={{
                  padding: '14px 18px', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-md)',
                  color: 'var(--text)', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                }}
              >
                <MessageCircle size={14} aria-hidden="true" />
                {t.theory.fix}
              </a>
            </div>
          </>
        ) : (
          <div style={{ ...CARD_COMPACT, padding: '40px 20px', textAlign: 'center' }}>
            <BookOpen size={32} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.theory.summarySoon}</div>
          </div>
        )}
      </div>
    );
  }

  // === TOPIC LIST VIEW ===
  return (
    <div style={{ padding: '0 var(--content-padding) 100px' }}>
      <BackButton onClick={handleBack} style={{ marginBottom: 14 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 50, height: 50, borderRadius: R.lg, background: (sub?.color || COLORS.teal) + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SubjectIcon sid={sid} size={24} color={sub?.color || COLORS.teal} />
        </div>
        <div>
          <h1 style={{ ...TYPE.h2, fontSize: 18, margin: 0 }}>{t.theory.title}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {(t.subjects as Record<string, string>)[sid] || sub?.name}
            {allSummaries && ` • ${Object.keys(allSummaries).length} ${pluralizeForms(Object.keys(allSummaries).length, t.theory.topicsWord)}`}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ ...CARD_COMPACT, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.loading}</div>
        </div>
      ) : !allSummaries || !topics ? (
        <div style={{ ...CARD_COMPACT, padding: '40px 20px', textAlign: 'center' }}>
          <BookOpen size={32} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.theory.subjectSummariesSoon}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {topics.map(section => {
            const subs = section.subtopics || [];
            const hasSubs = subs.length > 1;
            const isExpanded = expandedSection === section.id;
            const sectionName = isKk && section.name_kk ? section.name_kk : section.name;
            const sectionHasSummary = !!allSummaries[section.id];
            const subsWithSummaries = subs.filter(s => allSummaries[s.id]);

            // Skip sections with no summaries at all
            if (!sectionHasSummary && subsWithSummaries.length === 0) return null;

            return (
              <div key={section.id}>
                {/* Section header */}
                <button
                  onClick={() => {
                    if (hasSubs) setExpandedSection(isExpanded ? null : section.id);
                    else if (sectionHasSummary) setSelectedTopic(section.id);
                  }}
                  style={{
                    ...CARD_COMPACT, display: 'flex', alignItems: 'center', width: '100%',
                    borderLeft: `3px solid ${sub?.color || COLORS.teal}`,
                    padding: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: R.md, background: (sub?.color || COLORS.teal) + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={17} color={sub?.color || COLORS.teal} strokeWidth={2.2} />
                  </div>
                  <div style={{ marginLeft: 11, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sectionName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {hasSubs ? `${subsWithSummaries.length} ${pluralizeForms(subsWithSummaries.length, t.theory.summariesWord)}` : t.theory.summary}
                    </div>
                  </div>
                  {hasSubs
                    ? <ChevronDown size={16} color={sub?.color || COLORS.teal} style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }} />
                    : <ChevronRight size={16} color={sub?.color || COLORS.teal} />
                  }
                </button>

                {/* Subtopics */}
                {hasSubs && isExpanded && (
                  <div style={{ marginLeft: 22, borderLeft: `2px solid ${(sub?.color || COLORS.teal)}22`, marginTop: 2 }}>
                    {subs.map((st, idx) => {
                      const hasSummary = !!allSummaries[st.id];
                      const stName = isKk && st.name_kk ? st.name_kk : st.name;
                      const isLast = idx === subs.length - 1;
                      return (
                        <button
                          key={st.id}
                          onClick={() => hasSummary && setSelectedTopic(st.id)}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%', padding: '10px 12px',
                            background: 'var(--card-bg)', border: 'none',
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                            cursor: hasSummary ? 'pointer' : 'default', textAlign: 'left',
                            opacity: hasSummary ? 1 : 0.4,
                            borderRadius: isLast ? '0 0 10px 10px' : 0,
                          }}
                        >
                          <BookOpen size={12} color={sub?.color || COLORS.teal} style={{ flexShrink: 0, marginRight: 10, opacity: hasSummary ? 1 : 0.3 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{stName}</div>
                          </div>
                          {hasSummary && <ChevronRight size={14} color={(sub?.color || COLORS.teal) + '88'} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
