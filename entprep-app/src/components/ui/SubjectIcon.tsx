import {
  Calculator, BookOpen, Landmark, Globe, BookA, Pi, Atom,
  Leaf, FlaskConical, ScrollText, Monitor, Scale, BookMarked, Languages,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SUBJECT_META } from '../../config/subjects';

// Glyphs follow the design-kit mapping (Calculator/Atom/Landmark/Globe/Leaf);
// the rest stay close to the same visual language.
const ICON_MAP: Record<string, LucideIcon> = {
  math: Calculator,
  reading: BookOpen,
  history: Landmark,
  geography: Globe,
  english: BookA,
  math_profile: Pi,
  physics: Atom,
  biology: Leaf,
  chemistry: FlaskConical,
  world_history: ScrollText,
  informatics: Monitor,
  law: Scale,
  literature: BookMarked,
  native_lang: Languages,
};

interface Props {
  sid: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function SubjectIcon({ sid, size = 20, color, strokeWidth = 1.8 }: Props) {
  const Icon = ICON_MAP[sid];
  if (!Icon) return <span style={{ fontSize: size }}>{sid}</span>;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

/**
 * Design-kit subject icon chip ("stamped" look): ink-colored icon on the
 * subject's soft tint, 2px ink border, hard mini-shadow. Use this instead
 * of a bare colored icon — bare thin icons read as generic/AI.
 */
export function SubjectChip({ sid, size = 44, iconSize, radius }: { sid: string; size?: number; iconSize?: number; radius?: number }) {
  const color = SUBJECT_META[sid as keyof typeof SUBJECT_META]?.color || '#FF5A36';
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}2E`,
        border: '2px solid var(--ink)',
        borderRadius: radius ?? Math.round(size * 0.27),
        boxShadow: '0 2px 0 0 var(--ink)',
        color: 'var(--ink)',
      }}
    >
      <SubjectIcon sid={sid} size={iconSize ?? Math.round(size * 0.5)} color="var(--ink)" strokeWidth={2.2} />
    </span>
  );
}

export { ICON_MAP };
