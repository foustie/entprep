import { useState, useEffect } from 'react';
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { prefetchCounts, getPoolSize } from '../utils/questionStore';
import { getPersonalBests } from '../utils/competitionHelpers';
import { useApp } from '../contexts/AppContext';
import HomeSubjectGrid from './HomeSubjectGrid';
import type { SubjectConfig } from '../types';

/**
 * Shared subject list (mandatory + profile, with per-subject question counts) used by
 * the «Банк вопросов» and «Теория» screens. Without `onPick` each subject opens its
 * detail (SubjectDetail → разделы → practice); with `onPick` the host intercepts the
 * tap (Theory opens конспекты instead).
 */
export default function SubjectPicker({ onPick }: { onPick?: (sid: string) => void }) {
  const { hist, prof } = useApp();
  const [poolSizes, setPoolSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    prefetchCounts().then((updated) => {
      if (!updated) return;
      const allSids = [...Object.keys(SUBS), ...ALL_PROFILES.map(p => p.id)];
      const sizes: Record<string, number> = {};
      for (const sid of [...new Set(allSids)]) sizes[sid] = getPoolSize(sid);
      setPoolSizes(sizes);
    });
  }, []);

  const profSubs = prof.map(id => ALL_PROFILES.find(p => p.id === id)).filter(Boolean) as SubjectConfig[];
  const mandatorySubs = Object.values(SUBS);
  const bests = getPersonalBests(hist);

  return (
    <HomeSubjectGrid
      mandatory={mandatorySubs}
      profile={profSubs}
      hist={hist}
      poolSizes={poolSizes}
      bests={bests}
      onPick={onPick}
    />
  );
}
