import React from 'react';
import { ANDY_GLOW } from '../../constants/styles';

export type MascotEmotion =
  | 'confident'
  | 'thinking'
  | 'celebrating'
  | 'calm'
  | 'rushing'
  | 'sad'
  | 'shocked'
  | 'sleepy'
  | 'idea'
  | 'love';

const ASSET_MAP: Record<MascotEmotion, string> = {
  confident: '/mascot/andy-confident.webp',
  thinking: '/mascot/andy-thinking.webp',
  celebrating: '/mascot/andy-celebrating.webp',
  calm: '/mascot/andy-calm.webp',
  rushing: '/mascot/andy-rushing.webp',
  sad: '/mascot/andy-sad.webp',
  shocked: '/mascot/andy-shocked.webp',
  sleepy: '/mascot/andy-sleepy.webp',
  idea: '/mascot/andy-idea.webp',
  love: '/mascot/andy-love.webp',
};

interface Props {
  emotion: MascotEmotion;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

/** Map emotions to glow style — gives Andy his "signature color" */
const GLOW_MAP: Record<MascotEmotion, string> = {
  confident: ANDY_GLOW.default,
  thinking: ANDY_GLOW.default,
  celebrating: ANDY_GLOW.excited,
  calm: ANDY_GLOW.calm,
  rushing: ANDY_GLOW.excited,
  sad: ANDY_GLOW.default,
  shocked: ANDY_GLOW.excited,
  sleepy: ANDY_GLOW.calm,
  idea: ANDY_GLOW.default,
  love: ANDY_GLOW.streak,
};

export default function Mascot({ emotion, size = 120, style, className }: Props) {
  return (
    <img
      src={ASSET_MAP[emotion]}
      alt={`Энди — ${emotion}`}
      width={size}
      height={size}
      loading={size >= 140 ? 'eager' : 'lazy'}
      fetchPriority={size >= 140 ? 'high' : 'auto'}
      draggable={false}
      className={className}
      style={{
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        filter: GLOW_MAP[emotion],
        ...style,
      }}
    />
  );
}

/** Pick Andy's emotion based on app state */
export function getAndyEmotion(opts: {
  recType?: string;
  score?: number;
  streak?: number;
  hour?: number;
  isFirstTest?: boolean;
}): MascotEmotion {
  const { recType, score, streak, hour = new Date().getHours() } = opts;

  // Night time
  if (hour >= 23 || hour < 5) return 'sleepy';

  // Based on recommendation type
  switch (recType) {
    case 'first_test': return 'confident';
    case 'error_review': return 'idea';
    case 'full_ent': return 'calm';
    case 'not_practiced': return 'rushing';
    case 'weak_topic':
    case 'weak_subject':
      if (score != null && score >= 70) return 'confident';
      if (score != null && score < 30) return 'thinking';
      return 'idea';
    default: break;
  }

  // Streak milestones
  if (streak && streak >= 7) return 'love';
  if (streak && streak > 0) return 'confident';

  return 'confident';
}
