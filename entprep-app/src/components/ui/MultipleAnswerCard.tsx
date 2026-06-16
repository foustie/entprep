import { useState } from 'react';
import { COLORS, FF, FS, R } from '../../constants/styles';
import { Check, X } from 'lucide-react';
import type { Question } from '../../types';
import { scoreQuestion } from '../../utils/scoringEngine';
import { useT } from '../../locales';

interface MultipleAnswerCardProps {
  question: Question;
  onConfirm: (selected: number[]) => void;
  showResult: boolean;      // true after confirm
  userAnswer?: number[];    // the confirmed answer
}

export default function MultipleAnswerCard({
  question,
  onConfirm,
  showResult,
  userAnswer,
}: MultipleAnswerCardProps) {
  const t = useT();
  const [selected, setSelected] = useState<Set<number>>(() => userAnswer ? new Set(userAnswer) : new Set());
  const correctArr = Array.isArray(question.c) ? question.c : [question.c];

  const toggle = (idx: number) => {
    if (showResult) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleConfirm = () => {
    if (showResult || selected.size === 0) return;
    onConfirm(Array.from(selected).sort());
  };

  // Scoring result if confirmed
  const result = showResult && userAnswer
    ? scoreQuestion(question, userAnswer)
    : null;

  const answeredSet = showResult && userAnswer ? new Set(userAnswer) : null;
  const correctSet = new Set(correctArr);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10,
      }}>
        <span style={{
          padding: '4px 10px', borderRadius: R.pill,
          background: COLORS.streakSoft,
          border: `1.5px solid ${COLORS.streak}`,
          fontFamily: FF.mono, fontSize: FS.xs, fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: COLORS.streak,
        }}>
          {t.test.multipleAnswers}
        </span>
        {!showResult && (
          <span style={{
            fontFamily: FF.body, fontSize: 11, fontWeight: 700,
            color: 'var(--text-muted)',
          }}>{t.test.selected}: {selected.size}</span>
        )}
        {result && (
          <span style={{
            fontFamily: FF.display, fontSize: 11, fontWeight: 900,
            letterSpacing: '-0.02em',
            color: result.correct ? COLORS.win : result.partial ? COLORS.xp : COLORS.streak,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {result.pts}/{result.maxPts} {t.test.pointsShort}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {question.o.map((opt, idx) => {
          const isSelected = showResult ? answeredSet?.has(idx) : selected.has(idx);
          const isCorrect = correctSet.has(idx);

          let bg = 'var(--bg-card)';
          let bd = '2px solid var(--ink)';
          let tc = 'var(--text)';
          let boxShadow = '0 2px 0 0 var(--ink)';

          if (showResult) {
            if (isCorrect && isSelected) {
              bg = COLORS.winSoft; tc = COLORS.win; boxShadow = '0 2px 0 0 ' + COLORS.win;
            } else if (isCorrect && !isSelected) {
              bg = COLORS.winSoft; tc = COLORS.win; boxShadow = '0 2px 0 0 rgba(30,184,84,0.3)';
            } else if (!isCorrect && isSelected) {
              bg = COLORS.streakSoft; tc = COLORS.streak; boxShadow = '0 2px 0 0 ' + COLORS.streak;
            }
          } else if (isSelected) {
            bg = COLORS.streakSoft; tc = COLORS.streak; boxShadow = '0 2px 0 0 ' + COLORS.streak;
          }

          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              style={{
                display: 'flex', alignItems: 'center',
                background: bg,
                border: bd, borderRadius: 12,
                boxShadow,
                padding: '12px 14px',
                cursor: showResult ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                border: `2px solid ${tc}`,
                background: isSelected ? `${tc}15` : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: tc,
                flexShrink: 0, marginRight: 11,
              }}>
                {showResult && isCorrect && isSelected ? <Check size={14} /> :
                 showResult && !isCorrect && isSelected ? <X size={14} /> :
                 showResult && isCorrect ? <Check size={12} style={{ opacity: 0.5 }} /> :
                 isSelected ? <Check size={14} /> :
                 String.fromCharCode(65 + idx)}
              </div>
              <span style={{ fontSize: 14, color: tc, fontWeight: isSelected ? 600 : 400 }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>

      {!showResult && (
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          style={{
            width: '100%', padding: '13px', marginTop: 12,
            background: selected.size > 0
              ? `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`
              : 'var(--bg-subtle)',
            color: selected.size > 0 ? '#fff' : 'var(--text-muted)',
            border: `2px solid ${selected.size > 0 ? 'var(--ink)' : 'rgba(15,15,16,0.12)'}`,
            borderRadius: 12,
            boxShadow: selected.size > 0 ? '0 3px 0 0 var(--ink)' : 'none',
            fontFamily: FF.display, fontSize: 13, fontWeight: 900,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            cursor: selected.size > 0 ? 'pointer' : 'default',
          }}
        >
          {t.test.confirmBtn} ({selected.size})
        </button>
      )}
    </div>
  );
}
