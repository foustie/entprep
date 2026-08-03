import { COLORS, FF } from '../../constants/styles';
import { isSchoolTenant, TENANT } from '../../config/tenant';

interface Props {
  /** Chip size in px (the wordmark scales with it) */
  size?: number;
  /** Render the wordmark next to the chip */
  withWordmark?: boolean;
}

/**
 * Stamped brand mark: tenant logo in an ink-bordered chip, optionally
 * with the tenant wordmark (ENTprep retail or school name).
 * School crest already has its own shield border — render flat, no ink stamp.
 */
export default function BrandMark({ size = 30, withWordmark = true }: Props) {
  const accent = TENANT.accent || COLORS.streak;
  const school = isSchoolTenant();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img
        src={TENANT.logoUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{
          display: 'block',
          borderRadius: school ? Math.round(size * 0.15) : Math.round(size * 0.3),
          border: school ? 'none' : '2px solid var(--ink)',
          boxShadow: school ? 'none' : '0 2px 0 0 var(--ink)',
          flexShrink: 0,
          objectFit: school ? 'contain' : 'cover',
          background: school ? 'transparent' : undefined,
        }}
      />
      {withWordmark && (
        <span style={{ fontSize: Math.round(size * 0.55), fontWeight: 900, fontFamily: FF.brand, letterSpacing: '-0.03em', lineHeight: 1 }}>
          <span style={{ color: 'var(--text)' }}>{TENANT.wordmarkPrimary}</span>
          {TENANT.wordmarkAccent ? (
            <span style={{ color: accent }}>{TENANT.wordmarkAccent}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}
