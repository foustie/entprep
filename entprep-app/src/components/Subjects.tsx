import { useState, useEffect } from 'react';
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { getPersonalBests } from '../utils/competitionHelpers';
import { prefetchCounts, getPoolSize } from '../utils/questionStore';
import { useApp } from '../contexts/AppContext';
import { useT } from '../locales';
import { useBreakpoint } from '../hooks/useBreakpoint';
import HomeSubjectGrid from './HomeSubjectGrid';
import HomeNavCards from './HomeNavCards';
import { FF } from '../constants/styles';
import type { SubjectConfig } from '../types';

export default function Subjects() {
  const { hist, prof } = useApp();
  const t = useT();
  const bp = useBreakpoint();

  const [poolSizes, setPoolSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    prefetchCounts().then((updated) => {
      if (updated) {
        const allSids = [...Object.keys(SUBS), ...ALL_PROFILES.map(p => p.id)];
        const unique = [...new Set(allSids)];
        const sizes: Record<string, number> = {};
        for (const sid of unique) sizes[sid] = getPoolSize(sid);
        setPoolSizes(sizes);
      }
    });
  }, []);

  const profSubs = prof.map(id => ALL_PROFILES.find(p => p.id === id)).filter(Boolean) as SubjectConfig[];
  const mandatorySubs = Object.values(SUBS);
  const bests = getPersonalBests(hist);

  return (
    <div style={{ padding: `0 var(--content-padding) ${bp === 'desktop' ? 40 : 100}px` }}>
      <div style={{ padding: '8px 0 16px', fontSize: 18, fontWeight: 700, fontFamily: FF.display, color: 'var(--text)' }}>
        {t.tabs.subjects}
      </div>

      <HomeSubjectGrid
        mandatory={mandatorySubs}
        profile={profSubs}
        hist={hist}
        poolSizes={poolSizes}
        bests={bests}
      />

      <HomeNavCards />
    </div>
  );
}
