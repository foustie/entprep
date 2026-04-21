import { COLORS, FF } from '../../constants/styles';
import { useT } from '../../locales';
import BottomSheet from './BottomSheet';
import { Flag } from 'lucide-react';

interface ReportSheetProps {
  visible: boolean;
  questionText?: string;
  options?: string[];
  comment: string;
  loading: boolean;
  onClose: () => void;
  onCommentChange: (v: string) => void;
  onReport: (reason: string) => void;
}

export default function ReportSheet({ visible, questionText, options, comment, loading, onClose, onCommentChange, onReport }: ReportSheetProps) {
  const t = useT();

  const REASONS = [
    { key: 'wrong_answer', label: t.test.reportWrongAnswer, emoji: '\u274C' },
    { key: 'bad_question', label: t.test.reportBadQuestion, emoji: '\uD83D\uDCDD' },
    { key: 'bad_explanation', label: t.test.reportBadExplanation, emoji: '\uD83D\uDCA1' },
    { key: 'other', label: t.test.reportOther, emoji: '\uD83D\uDD16' },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: COLORS.streakSoft,
          border: `1.5px solid ${COLORS.streak}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: COLORS.streak, flexShrink: 0,
        }}>
          <Flag size={16} strokeWidth={2.4} />
        </div>
        <div style={{
          fontFamily: FF.display, fontSize: 16, fontWeight: 900,
          color: 'var(--text)', letterSpacing: '-0.03em',
        }}>{t.test.reportQuestion}</div>
      </div>

      {questionText && (
        <div style={{
          padding: '10px 12px', marginBottom: 12,
          background: 'var(--bg-subtle)',
          border: '1.5px solid rgba(15,15,16,0.1)',
          borderRadius: 10,
          fontFamily: "'Nunito',sans-serif", fontSize: 12, fontWeight: 600,
          color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>{questionText}</div>
      )}

      {options && options.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            {(t.test as unknown as Record<string, string>).suggestCorrect || 'Какой ответ правильный?'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {options.map((opt, i) => {
              const active = comment.startsWith(`correct:${i}`);
              return (
                <button key={i} onClick={() => onCommentChange(`correct:${i} ${comment}`)} style={{
                  padding: '7px 11px',
                  background: active ? '#0F0F10' : 'var(--bg-card)',
                  border: '1.5px solid #0F0F10',
                  boxShadow: active ? `0 2px 0 0 ${COLORS.streak}` : '0 2px 0 0 rgba(15,15,16,0.18)',
                  borderRadius: 10,
                  fontFamily: "'Nunito',sans-serif", fontSize: 11.5, fontWeight: 800,
                  color: active ? '#fff' : 'var(--text)',
                  cursor: 'pointer', textAlign: 'left',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}>
                  {String.fromCharCode(65 + i)}) {opt.slice(0, 40)}{opt.length > 40 ? '...' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea
        value={comment.replace(/^correct:\d\s*/, '')}
        onChange={e => {
          const prefix = comment.match(/^correct:\d\s*/)?.[0] || '';
          onCommentChange(prefix + e.target.value);
        }}
        placeholder={(t.test as unknown as Record<string, string>).commentOptional || 'Комментарий (необязательно)'}
        rows={2}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--bg-card)',
          border: '2px solid #0F0F10',
          borderRadius: 10,
          color: 'var(--text)',
          fontFamily: "'Nunito',sans-serif", fontSize: 12.5, fontWeight: 600,
          resize: 'vertical', marginBottom: 12, outline: 'none',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {REASONS.map(r => (
          <button
            key={r.key}
            onClick={() => onReport(r.key)}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              background: 'var(--bg-card)',
              border: '2px solid #0F0F10',
              boxShadow: '0 2px 0 0 #0F0F10',
              borderRadius: 10,
              fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 700,
              color: 'var(--text)',
              cursor: loading ? 'wait' : 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16 }}>{r.emoji}</span>{r.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
