import { NotebookText, ChevronRight } from 'lucide-react';
import { useNav } from '../contexts/NavigationContext';
import { useT } from '../locales';
import { COLORS, FF, FS, SP, R, TYPE } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import SubjectPicker from './SubjectPicker';

/**
 * «Банк вопросов» screen — a prominent, dedicated home for browsing every subject's
 * разделы and practising questions. Reuses SubjectPicker → SubjectDetail (questions per
 * section). Also surfaces a «Теория» entry so конспекты are reachable here (esp. mobile,
 * where Theory is not a bottom-nav tab).
 */
export default function QuestionBank() {
  const { changeTab } = useNav();
  const t = useT();
  const isDesktop = useBreakpoint() === 'desktop';

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <div style={{ marginBottom: SP.lg }}>
        <div style={TYPE.label}>{t.bank.eyebrow}</div>
        <h1 style={{ ...TYPE.h1, fontSize: 22, margin: '6px 0 4px' }}>{t.bank.title}</h1>
        <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, lineHeight: 1.5 }}>{t.bank.subtitle}</div>
      </div>

      {/* Theory entry — quiet ink-bordered card (one bright splash is reserved elsewhere) */}
      <button
        onClick={() => changeTab('theory')}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '12px 14px', marginBottom: SP.lg,
          background: 'var(--bg-card)', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)',
          borderRadius: R.lg, cursor: 'pointer', fontFamily: FF.body,
        }}
      >
        <span style={{
          flexShrink: 0, width: 42, height: 42, borderRadius: R.md,
          background: `${COLORS.purple}1F`, border: `1.5px solid ${COLORS.purple}`, color: COLORS.purple,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NotebookText size={20} strokeWidth={2.3} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{t.theory.title}</span>
          <span style={{ display: 'block', fontSize: FS.base, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>{t.theory.subtitle}</span>
        </span>
        <ChevronRight size={18} color="var(--text-muted)" strokeWidth={2.4} style={{ flexShrink: 0 }} />
      </button>

      <SubjectPicker />
    </div>
  );
}
