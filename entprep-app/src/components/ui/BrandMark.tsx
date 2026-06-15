import { COLORS, FF } from '../../constants/styles';

interface Props {
  /** Chip size in px (the wordmark scales with it) */
  size?: number;
  /** Render the "ENTprep." wordmark next to the chip */
  withWordmark?: boolean;
}

/**
 * Stamped brand mark: the ENTprep check logo (favicon.svg) in an
 * ink-bordered chip, optionally with the "ENTprep." wordmark.
 * Design-system AppHeader pattern — real logo instead of a letter chip.
 */
export default function BrandMark({ size = 30, withWordmark = true }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{
          display: 'block',
          borderRadius: Math.round(size * 0.3),
          border: '2px solid var(--ink)',
          boxShadow: '0 2px 0 0 var(--ink)',
          flexShrink: 0,
        }}
      />
      {withWordmark && (
        <span style={{ fontSize: Math.round(size * 0.55), fontWeight: 900, fontFamily: FF.brand, letterSpacing: '-0.03em', lineHeight: 1 }}>
          <span style={{ color: 'var(--text)' }}>ENT</span>
          <span style={{ color: COLORS.streak }}>prep.</span>
        </span>
      )}
    </span>
  );
}
