import {
  Calculator, BookOpen, Landmark, Globe, Languages, Pi, Atom,
  Dna, FlaskConical, ScrollText, Monitor, Scale, BookMarked,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  math: Calculator,
  reading: BookOpen,
  history: Landmark,
  geography: Globe,
  english: Languages,
  math_profile: Pi,
  physics: Atom,
  biology: Dna,
  chemistry: FlaskConical,
  world_history: ScrollText,
  informatics: Monitor,
  law: Scale,
  literature: BookMarked,
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

export { ICON_MAP };
