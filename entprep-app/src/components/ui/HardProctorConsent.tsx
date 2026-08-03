import { COLORS, FF, R } from '../../constants/styles';
import { useT } from '../../locales';
import { Camera } from 'lucide-react';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

/** Consent sheet before school Full ENT hard-proctor stub. Warn+log only. */
export default function HardProctorConsent({ onAccept, onDecline }: Props) {
  const t = useT();
  const hp = t.hardProctor;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hard-proctor-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg-card)',
          border: '2px solid var(--ink)',
          boxShadow: '0 4px 0 0 var(--ink)',
          borderRadius: R.lg,
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Camera size={22} color={COLORS.streak} />
          <h2 id="hard-proctor-title" style={{ margin: 0, fontFamily: FF.brand, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            {hp.title}
          </h2>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-body)', margin: '0 0 10px' }}>{hp.body}</p>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', margin: '0 0 18px' }}>{hp.policy}</p>
        <button
          type="button"
          onClick={onAccept}
          style={{
            width: '100%',
            padding: '14px 16px',
            marginBottom: 10,
            background: COLORS.streak,
            color: '#fff',
            border: '2px solid var(--ink)',
            borderBottom: '4px solid var(--ink)',
            borderRadius: R.md,
            fontFamily: FF.display,
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {hp.accept}
        </button>
        <button
          type="button"
          onClick={onDecline}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-md)',
            borderRadius: R.md,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {hp.decline}
        </button>
      </div>
    </div>
  );
}
