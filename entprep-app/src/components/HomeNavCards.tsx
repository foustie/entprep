import { UNIS } from '../data/universities';
import { CARD_COMPACT, COLORS, SECTION_LABEL, TINT, hoverGlow } from '../constants/styles';
import { useT } from '../locales';
import { useNav } from '../contexts/NavigationContext';
import { GraduationCap, ChevronRight, Calculator, Trophy, Users, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function HomeNavCards() {
  const { nav, openPaywall } = useNav();
  const t = useT();

  const socialItems: { id: string; label: string; screen: string; Icon: LucideIcon; color: string; tint: string }[] = [
    { id: 'lb',  label: t.home.leaderboard, screen: 'leaderboard', Icon: Trophy, color: COLORS.green, tint: TINT.green.bg },
    { id: 'fr',  label: t.home.friends,     screen: 'friends',     Icon: Users,  color: COLORS.teal,  tint: TINT.teal.bg },
  ];

  return (
    <>
      {/* Full ENT - prominent card */}
      <button
        onClick={() => nav("fullent")}
        aria-label={`${t.home.fullEnt} — ${t.home.fullEntDesc}`}
        style={{
          ...CARD_COMPACT,
          display: 'flex', alignItems: 'center', width: '100%',
          borderLeft: `3px solid ${COLORS.teal}`,
          padding: '16px 14px', marginBottom: 20,
          cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.2s',
        }}
        {...hoverGlow(COLORS.teal)}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: TINT.teal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap size={22} color={COLORS.teal} />
        </div>
        <div style={{ marginLeft: 12, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {t.home.fullEnt}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.home.fullEntDesc}</div>
        </div>
        <ChevronRight size={18} color={COLORS.teal} />
      </button>

      {/* Social row */}
      <div style={SECTION_LABEL}>{t.home.social}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {socialItems.map(({ id, label, screen, Icon, color, tint }) => (
          <button key={id} onClick={() => nav(screen)} aria-label={label} style={{
            ...CARD_COMPACT,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '14px 8px', cursor: 'pointer', textAlign: 'center',
            transition: 'box-shadow 0.2s', gap: 6,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={color} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Tools section */}
      <div style={SECTION_LABEL}>{t.home.tools}</div>
      <button onClick={() => nav("calc")} aria-label={t.home.grantCalc} style={{
        ...CARD_COMPACT,
        display: 'flex', alignItems: 'center', width: '100%',
        background: COLORS.streak,
        border: '2px solid var(--ink)',
        borderBottom: '4px solid var(--ink)',
        padding: '14px 14px',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Calculator size={20} color="#fff" strokeWidth={2.25} />
        </div>
        <div style={{ marginLeft: 12, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.home.grantCalc}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{UNIS.length} {t.home.grantCalcDesc}</div>
        </div>
        <ChevronRight size={18} color="#fff" />
      </button>
    </>
  );
}
