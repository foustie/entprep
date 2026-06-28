import { useState } from 'react';
import { useT } from '../locales';
import { FF, FS, SP, TYPE } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import SubjectPicker from './SubjectPicker';
import TheorySummary from './TheorySummary';

/**
 * «Теория» screen — pick a subject, then read конспекты per раздел. Reuses SubjectPicker
 * (with onPick to intercept) and the existing TheorySummary (topicId '_all' → section list
 * → конспект). Back from a subject returns to the picker, not to SubjectDetail.
 */
export default function Theory() {
  const t = useT();
  const isDesktop = useBreakpoint() === 'desktop';
  const [sid, setSid] = useState<string | null>(null);
  const pad = `0 var(--content-padding) ${isDesktop ? 40 : 100}px`;

  if (sid) {
    return (
      <div style={{ padding: pad }}>
        <TheorySummary sid={sid} topicId="_all" onBack={() => setSid(null)} />
      </div>
    );
  }

  return (
    <div style={{ padding: pad }}>
      <div style={{ marginBottom: SP.lg }}>
        <div style={TYPE.label}>{t.theory.eyebrow}</div>
        <h1 style={{ ...TYPE.h1, fontSize: 22, margin: '6px 0 4px' }}>{t.theory.title}</h1>
        <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, lineHeight: 1.5 }}>{t.theory.pickSubject}</div>
      </div>
      <SubjectPicker onPick={setSid} />
    </div>
  );
}
