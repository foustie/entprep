import { COLORS, R } from '../../constants/styles';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

export default function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        minHeight: 44,
        padding: '9px 0',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 44,
          height: 26,
          borderRadius: R.md,
          position: 'relative',
          transition: 'all 0.2s',
          background: value ? COLORS.accent : 'var(--toggle-off)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: R.md,
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: value ? 21 : 3,
            transition: 'left 0.2s',
          }}
        />
      </span>
    </button>
  );
}
