import { COLORS } from '../../constants/styles';
import { useT } from '../../locales';

interface PointsBadgeProps {
  pts: number;
}

export default function PointsBadge({ pts }: PointsBadgeProps) {
  const t = useT();
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 6,
      background: pts >= 2 ? 'rgba(255,107,53,0.1)' : 'rgba(255,90,54,0.1)',
      color: pts >= 2 ? COLORS.accent : COLORS.teal,
      fontSize: 9, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {pts} {t.home.pointsShort}
    </span>
  );
}
