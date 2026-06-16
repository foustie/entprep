import { useState, useMemo, useEffect } from 'react';
import { UNIS } from '../data/universities';
import { COLORS, FF, R } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { getGoalProgress } from '../utils/competitionHelpers';
import { pluralizeForms } from '../utils/formatters';
import BackButton from './ui/BackButton';
import { Calculator, Search, Star, ArrowRight, Sparkles, X, Landmark, Stethoscope, GraduationCap, Wrench, Monitor, Sprout, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// University category -> Lucide icon (replaces per-uni emoji)
const UNI_ICON: Record<string, LucideIcon> = {
  national: Landmark, medical: Stethoscope, pedagogical: GraduationCap,
  technical: Wrench, it: Monitor, agro: Sprout, other: Building2,
};
function UniIcon({ tp, size = 20, color }: { tp: string; size?: number; color?: string }) {
  const I = UNI_ICON[tp] || Building2;
  return <I size={size} color={color} strokeWidth={2.2} />;
}
import { useT } from '../locales';
import type { University } from '../types';

type Chance = 'high' | 'mid' | 'low';
type UniType = University['tp'] | 'all';

const FAV_KEY = 'entprep_calc_favs';

function loadFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavs(arr: string[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch {}
}

export default function Calc() {
  const { goHome } = useNav();
  const { hist, st } = useApp();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const t = useT();

  const goalProg = useMemo(() => getGoalProgress(hist, st.goal), [hist, st.goal]);
  const autoPrognosis = goalProg && goalProg.approxScore > 0 ? Math.round(goalProg.approxScore) : null;
  const hasPrognosis = autoPrognosis != null;

  const [sc, setSc] = useState<number>(() => autoPrognosis ?? 80);
  const [manualMode, setManualMode] = useState(!hasPrognosis);
  const [query, setQuery] = useState('');
  const [tp, setTp] = useState<UniType>('all');
  const [favs, setFavs] = useState<string[]>(loadFavs);

  useEffect(() => {
    if (autoPrognosis != null && !manualMode) setSc(autoPrognosis);
  }, [autoPrognosis, manualMode]);

  const toggleFav = (name: string) => {
    setFavs(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      saveFavs(next);
      return next;
    });
  };

  const typeLabels: Record<UniType, string> = {
    all: t.calc.filterAll, national: t.calc.filterNational, medical: t.calc.filterMedical,
    pedagogical: t.calc.filterPedagogical, technical: t.calc.filterTechnical, it: t.calc.filterIT,
    agro: t.calc.filterAgro, other: t.calc.filterOther,
  };

  const allScored = useMemo(() =>
    UNIS.map(u => {
      const gap = sc - u.min;
      const chance: Chance = gap >= 10 ? 'high' : gap >= 0 ? 'mid' : 'low';
      return { ...u, gap, chance };
    }),
    [sc]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allScored
      .filter(u => tp === 'all' || u.tp === tp)
      .filter(u => !q || u.n.toLowerCase().includes(q) || u.sp.toLowerCase().includes(q) || u.c.toLowerCase().includes(q))
      .sort((a, b) => {
        const ord = { high: 0, mid: 1, low: 2 };
        if (ord[a.chance] !== ord[b.chance]) return ord[a.chance] - ord[b.chance];
        return a.min - b.min;
      });
  }, [allScored, query, tp]);

  // Top 3 matches — Safe / Realistic / Dream
  const topMatches = useMemo(() => {
    const safe = [...allScored].filter(u => u.gap >= 15).sort((a, b) => b.min - a.min)[0];
    const realistic = [...allScored].filter(u => u.gap >= 0 && u.gap < 15).sort((a, b) => b.min - a.min)[0];
    const dream = [...allScored].filter(u => u.gap < 0 && u.gap >= -20).sort((a, b) => a.min - b.min)[0];
    return { safe, realistic, dream };
  }, [allScored]);

  const pct = Math.round((sc - 50) / 90 * 100);
  const sliderColor = sc >= 100 ? COLORS.win : sc >= 75 ? COLORS.xp : COLORS.streak;
  const chanceTxt: Record<Chance, string> = { high: t.calc.highChance, mid: t.calc.midChance, low: t.calc.lowChance };

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <BackButton onClick={goHome} style={{ marginBottom: 14 }} />

      {/* Compact header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 14px' }}>
        <Calculator size={18} color="var(--text-muted)" strokeWidth={2.4} />
        <div style={{
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>{t.calc.title} · {UNIS.length} {pluralizeForms(UNIS.length, t.calc.uniWord)}</div>
      </div>

      {/* HERO — dark ink score card */}
      <div style={{
        position: 'relative',
        background: 'var(--ink)',
        border: '2px solid var(--ink)',
        borderRadius: 18,
        boxShadow: '0 5px 0 0 ' + COLORS.streak,
        padding: '22px 20px 18px',
        marginBottom: 14,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '22px 22px', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, marginBottom: 12,
          }}>
            <div>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)', marginBottom: 4,
              }}>{hasPrognosis && !manualMode ? t.calc.yourPrognosis : t.calc.entScore}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontFamily: FF.display, fontSize: 80, fontWeight: 900,
                  color: COLORS.xp, letterSpacing: '-0.055em', lineHeight: 0.85,
                  fontVariantNumeric: 'tabular-nums',
                }}>{sc}</span>
                <span style={{
                  fontFamily: FF.display, fontSize: 22, fontWeight: 800,
                  color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.02em',
                }}>/140</span>
              </div>
            </div>
            <div style={{
              padding: '5px 11px', borderRadius: R.pill,
              background: sliderColor,
              fontFamily: FF.display, fontSize: 10, fontWeight: 900,
              color: sliderColor === COLORS.xp ? 'var(--ink)' : '#fff',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}>
              {sc >= 100 ? (pct < 66 ? t.calc.almostGrant : `✓ ${t.calc.grant}`) : sc >= 75 ? t.calc.medium : t.calc.tooLow}
            </div>
          </div>

          {/* Slider — visible only in manual mode OR when user clicks edit */}
          {manualMode ? (
            <>
              <div style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center' }}>
                <div style={{
                  position: 'absolute', inset: '50% 0', transform: 'translateY(-50%)',
                  height: 12, borderRadius: R.pill,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: sliderColor,
                    transition: 'width 0.15s',
                  }} />
                </div>
                <input
                  type="range" min={50} max={140} value={sc}
                  onChange={e => setSc(+e.target.value)}
                  className="calc-range"
                  style={{
                    position: 'relative', width: '100%', height: 40,
                    appearance: 'none', background: 'transparent',
                    outline: 'none', cursor: 'pointer',
                    WebkitAppearance: 'none' as never,
                  }}
                />
                <style>{`
                  input.calc-range::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none;
                    width: 34px; height: 34px; border-radius: 50%;
                    background: #fff; border: 3px solid ${sliderColor};
                    box-shadow: 0 3px 0 0 #000; cursor: grab;
                  }
                  input.calc-range:active::-webkit-slider-thumb { cursor: grabbing; transform: translateY(1px); }
                  input.calc-range::-moz-range-thumb {
                    width: 34px; height: 34px; border-radius: 50%;
                    background: #fff; border: 3px solid ${sliderColor};
                    box-shadow: 0 3px 0 0 #000; cursor: grab;
                  }
                `}</style>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.4)', marginTop: 6, padding: '0 2px',
              }}><span>50</span><span>100</span><span>140</span></div>
              {hasPrognosis && (
                <button
                  onClick={() => { setManualMode(false); setSc(autoPrognosis!); }}
                  style={{
                    marginTop: 10, width: '100%', padding: '8px 12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                    borderRadius: R.md,
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: FF.body, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <Sparkles size={12} strokeWidth={2.4} /> {t.calc.restorePrognosis} {autoPrognosis}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setManualMode(true)}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.14)',
                borderRadius: R.md,
                color: '#fff',
                fontFamily: FF.body, fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {t.calc.editScoreManually}
            </button>
          )}
        </div>
      </div>

      {/* CTA when no prognosis */}
      {!hasPrognosis && !manualMode && (
        <div style={{
          padding: '14px 16px', marginBottom: 16,
          background: COLORS.xpSoft,
          border: '2px solid var(--ink)',
          borderRadius: R.lg,
          boxShadow: '0 3px 0 0 var(--ink)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FF.display, fontSize: 13, fontWeight: 900,
              color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2,
            }}>{t.calc.takeTestCta}</div>
            <div style={{
              fontFamily: FF.body, fontSize: 11, fontWeight: 700,
              color: 'var(--ink)', opacity: 0.6,
            }}>{t.calc.takeTestCtaSub}</div>
          </div>
          <button onClick={goHome} style={{
            flexShrink: 0,
            padding: '8px 14px', borderRadius: R.md,
            background: 'var(--ink)', color: '#fff',
            border: '2px solid var(--ink)',
            fontFamily: FF.display, fontSize: 10, fontWeight: 900,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {t.calc.testButton} <ArrowRight size={12} strokeWidth={2.6} />
          </button>
        </div>
      )}

      {/* TOP 3 MATCHES */}
      {(topMatches.safe || topMatches.realistic || topMatches.dream) && (
        <>
          <div style={{
            fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px',
          }}>{t.calc.topChances}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 18 }}>
            {topMatches.safe && <MatchRow label={t.calc.matchSafe} minLabel={t.calc.minShort} color={COLORS.win} u={topMatches.safe} isFav={favs.includes(topMatches.safe.n)} onFav={() => toggleFav(topMatches.safe!.n)} />}
            {topMatches.realistic && <MatchRow label={t.calc.matchRealistic} minLabel={t.calc.minShort} color={COLORS.xp} u={topMatches.realistic} isFav={favs.includes(topMatches.realistic.n)} onFav={() => toggleFav(topMatches.realistic!.n)} />}
            {topMatches.dream && <MatchRow label={t.calc.matchDream} minLabel={t.calc.minShort} color={COLORS.streak} u={topMatches.dream} isFav={favs.includes(topMatches.dream.n)} onFav={() => toggleFav(topMatches.dream!.n)} />}
          </div>
        </>
      )}

      {/* Search + type filter */}
      <div style={{
        position: 'relative', marginBottom: 10,
      }}>
        <Search size={16} color="var(--text-muted)" strokeWidth={2.4} aria-hidden="true" style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        }} />
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t.calc.searchPlaceholder}
          aria-label={t.calc.searchPlaceholder}
          style={{
            width: '100%', padding: '12px 38px 12px 38px',
            background: 'var(--bg-card)',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            fontFamily: FF.body, fontSize: 13, fontWeight: 600,
            color: 'var(--text)', outline: 'none',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label={t.close} style={{
            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: 44, height: 44, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
          }}>
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {(Object.keys(typeLabels) as UniType[]).map(k => {
          const active = tp === k;
          return (
            <button key={k} onClick={() => setTp(k)} style={{
              padding: '7px 14px', borderRadius: R.pill,
              fontFamily: FF.body, fontSize: 12, fontWeight: 800,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: '1.5px solid var(--ink)',
              background: active ? 'var(--ink)' : 'var(--bg-card)',
              color: active ? '#fff' : 'var(--text)',
              boxShadow: active ? `0 2px 0 0 ${COLORS.streak}` : '0 2px 0 0 rgba(15,15,16,0.18)',
            }}>
              {typeLabels[k]}
            </button>
          );
        })}
      </div>

      {/* Results count + favs toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, padding: '0 4px',
      }}>
        <div style={{
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          {t.calc.foundCount.replace('{n}', String(filtered.length))}
        </div>
        {favs.length > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: COLORS.xp,
          }}>
            <Star size={11} fill={COLORS.xp} strokeWidth={0} /> {t.calc.savedCount.replace('{n}', String(favs.length))}
          </div>
        )}
      </div>

      {/* Full uni list */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: bp === 'mobile' ? '1fr' : bp === 'tablet' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {filtered.map((u, i) => (
          <UniCard key={u.n + i} u={u} sc={sc} chanceTxt={chanceTxt} minLabel={t.calc.minShort} yourLabel={t.calc.yourShort} isFav={favs.includes(u.n)} onFav={() => toggleFav(u.n)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          background: 'var(--bg-card)',
          border: '2px dashed rgba(15,15,16,0.15)',
          borderRadius: R.lg,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{
            fontFamily: FF.display, fontSize: 14, fontWeight: 900,
            color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4,
          }}>{t.calc.nothingFound}</div>
          <div style={{
            fontFamily: FF.body, fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)',
          }}>{t.calc.nothingFoundHint}</div>
        </div>
      )}
    </div>
  );
}

// ───────────── Top match row — highlighted card ─────────────
function MatchRow({
  label, minLabel, color, u, isFav, onFav,
}: {
  label: string;
  minLabel: string;
  color: string;
  u: University & { gap: number; chance: Chance };
  isFav: boolean;
  onFav: () => void;
}) {
  return (
    <div style={{
      position: 'relative',
      padding: '14px 14px 14px 18px',
      background: 'var(--bg-card)',
      border: '2px solid var(--ink)',
      borderRadius: R.lg,
      boxShadow: `0 3px 0 0 ${color}`,
      display: 'flex', alignItems: 'center', gap: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 5, background: color,
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: R.md,
        background: `${color}18`,
        border: `1.5px solid ${color}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}><UniIcon tp={u.tp} size={20} color={color} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color, marginBottom: 2,
        }}>{label} · {minLabel} {u.min}</div>
        <div style={{
          fontFamily: FF.body, fontSize: 14, fontWeight: 800,
          color: 'var(--text)', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{u.n}</div>
        <div style={{
          fontFamily: FF.body, fontSize: 11, fontWeight: 600,
          color: 'var(--text-muted)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{u.c} · {u.sp}</div>
      </div>
      <button onClick={onFav} style={{
        flexShrink: 0,
        width: 36, height: 36, borderRadius: R.md,
        background: isFav ? COLORS.xpSoft : 'var(--bg-subtle)',
        border: `1.5px solid ${isFav ? COLORS.xp : 'rgba(15,15,16,0.14)'}`,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: isFav ? COLORS.xp : 'var(--text-muted)',
      }}>
        <Star size={16} fill={isFav ? COLORS.xp : 'none'} strokeWidth={2} />
      </button>
    </div>
  );
}

// ───────────── Universal uni card (compact) ─────────────
function UniCard({
  u, sc, chanceTxt, minLabel, yourLabel, isFav, onFav,
}: {
  u: University & { gap: number; chance: Chance };
  sc: number;
  chanceTxt: Record<Chance, string>;
  minLabel: string;
  yourLabel: string;
  isFav: boolean;
  onFav: () => void;
}) {
  const clr = u.chance === 'high' ? COLORS.win : u.chance === 'mid' ? COLORS.xp : COLORS.streak;
  const chipBg = u.chance === 'high' ? COLORS.winSoft : u.chance === 'mid' ? COLORS.xpSoft : COLORS.streakSoft;
  const prog = Math.min(100, Math.round(sc / u.min * 100));
  const isLow = u.chance === 'low';
  return (
    <div style={{
      position: 'relative',
      padding: '12px 12px 12px 16px',
      background: 'var(--bg-card)',
      border: '2px solid var(--ink)',
      borderRadius: 12,
      boxShadow: '0 2px 0 0 var(--ink)',
      opacity: isLow ? 0.78 : 1,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: clr }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={{ flexShrink: 0, lineHeight: 1, display: 'inline-flex', marginTop: 1 }}><UniIcon tp={u.tp} size={18} color={clr} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FF.body, fontSize: 13, fontWeight: 800,
            color: 'var(--text)', lineHeight: 1.2,
          }}>{u.n}</div>
          <div style={{
            fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', marginTop: 2,
          }}>{u.c} · {minLabel} {u.min} · {yourLabel} {sc}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{
            background: chipBg,
            border: `1.5px solid ${clr}`,
            borderRadius: 8, padding: '3px 8px',
            fontFamily: FF.display, fontSize: 10, fontWeight: 900,
            letterSpacing: '-0.02em', color: clr, whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}>{isLow ? `\u2212${Math.abs(u.gap)}` : chanceTxt[u.chance]}</div>
          <button onClick={onFav} style={{
            width: 26, height: 26, borderRadius: R.sm,
            background: isFav ? COLORS.xpSoft : 'transparent',
            border: `1.5px solid ${isFav ? COLORS.xp : 'rgba(15,15,16,0.14)'}`,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: isFav ? COLORS.xp : 'var(--text-muted)',
          }}>
            <Star size={12} fill={isFav ? COLORS.xp : 'none'} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div style={{
        background: 'rgba(15,15,16,0.06)',
        border: '1.5px solid rgba(15,15,16,0.14)',
        borderRadius: 4, height: 6, marginBottom: 6, overflow: 'hidden',
      }}>
        <div style={{ height: '100%', width: `${prog}%`, background: clr, transition: 'width 0.3s' }} />
      </div>
      <div style={{
        fontFamily: FF.body, fontSize: 11, fontWeight: 600,
        color: 'var(--text-secondary)', lineHeight: 1.35,
      }}>{u.sp}</div>
    </div>
  );
}
