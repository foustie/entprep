import { CARD, CARD_HERO, BUTTON, COLORS, TYPE, FF, SP } from '../constants/styles';
import { BookOpen, Brain, Zap, Users, ArrowRight, GraduationCap, CheckCircle2, ChevronDown, Flame, Instagram, Send, AtSign, Clock, Star } from 'lucide-react';
import { useT } from '../locales';
import { useApp } from '../contexts/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  onStart: () => void;
  totalQ: number;
}

const INK = 'var(--ink)';
const LANGS = ['ru', 'kk'] as const;

export default function Landing({ onStart, totalQ }: Props) {
  const t = useT();
  const tl = t.landing;
  const { st, updSt } = useApp();
  const lang = st.lang || 'ru';
  const isDesktop = useBreakpoint() === 'desktop';
  const qLabel = `${Math.floor(totalQ / 1000)} 000+`;

  const primaryBtn: React.CSSProperties = {
    ...BUTTON.primary,
    width: '100%',
    maxWidth: 340,
    padding: '18px 28px',
    fontSize: 15,
    borderRadius: 14,
    justifyContent: 'center',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FF.body, paddingBottom: 96 }}>

      {/* Hero — yellow splash block with ink logo + ink-shadow CTA */}
      <section style={{
        background: COLORS.xpSoft,
        borderBottom: `2px solid ${INK}`,
        padding: '20px 20px 36px',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
          {/* Header row: logo left, lang toggle right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {/* Logo */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <img src="/favicon.svg" alt="" aria-hidden="true" width={30} height={30}
                style={{ display: 'block', borderRadius: 9, border: `2px solid ${INK}`, boxShadow: `0 2px 0 0 ${INK}` }} />
              <span style={{ fontSize: 17, fontWeight: 900, fontFamily: FF.display, letterSpacing: '-0.03em' }}>
                <span style={{ color: INK }}>ENT</span><span style={{ color: COLORS.streak }}>prep.</span>
              </span>
            </span>

            {/* Lang toggle */}
            <div
              role="group"
              aria-label="Language"
              style={{
                display: 'inline-flex',
                borderRadius: 10,
                border: `2px solid ${INK}`,
                boxShadow: `0 2px 0 0 ${INK}`,
                overflow: 'hidden',
                background: '#FFF',
              }}
            >
              {LANGS.map((l, i) => {
                const active = lang === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => updSt({ ...st, lang: l })}
                    aria-pressed={active}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderLeft: i === 0 ? 'none' : `2px solid ${INK}`,
                      background: active ? COLORS.streak : 'transparent',
                      color: active ? '#FFF' : INK,
                      fontFamily: FF.mono,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                    }}
                  >
                    {l === 'ru' ? 'РУС' : 'ҚАЗ'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Eyebrow */}
          <div style={{ ...TYPE.eyebrow, marginBottom: 12, color: INK }}>
            {tl.heroEyebrow}
          </div>

          <h1 style={{
            ...TYPE.h1,
            fontSize: 34,
            marginBottom: 14,
            color: INK,
            textWrap: 'balance' as const,
          }}>
            {tl.title}
          </h1>

          <p style={{
            ...TYPE.body,
            fontSize: 15,
            color: INK,
            opacity: 0.75,
            marginBottom: 24,
            maxWidth: 320,
            margin: '0 auto 24px',
          }}>
            {qLabel} {tl.subtitle}
          </p>

          <button onClick={onStart} style={primaryBtn}>
            {tl.startFree} <ArrowRight size={18} />
          </button>

          <p style={{ ...TYPE.caption, marginTop: 10, color: INK, opacity: 0.65 }}>
            {tl.noReg}
          </p>

          {/* Stat row — ink-bordered mini cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8, marginTop: 24,
          }}>
            {[
              { v: qLabel, label: tl.questionsLabel, color: COLORS.streak },
              { v: '13', label: tl.subjectsLabel, color: COLORS.win },
              { v: 'AI', label: tl.aiLabel, color: INK },
            ].map((s, i) => (
              <div key={i} style={{
                background: '#FFF',
                border: `2px solid ${INK}`,
                borderRadius: 12,
                boxShadow: `0 2px 0 0 ${INK}`,
                padding: '10px 4px',
                textAlign: 'center',
              }}>
                <div style={{
                  ...TYPE.statSmall,
                  fontSize: 16,
                  color: s.color,
                }}>{s.v}</div>
                <div style={{ ...TYPE.statLabel, marginTop: 3, color: INK, opacity: 0.6 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
            <ChevronDown size={22} color={INK} style={{ opacity: 0.4, animation: 'bounce 2s infinite' }} />
          </div>
          <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}`}</style>
        </div>
      </section>

      {/* Features — ink cards with coloured icon chips */}
      <section style={{ padding: '28px 20px 12px', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ ...TYPE.eyebrow, marginBottom: SP.md }}>
          {tl.featuresEyebrow}
        </div>
        {[
          { icon: BookOpen, color: COLORS.streak, soft: COLORS.streakSoft, title: `${qLabel} ${tl.questionsTitle}`, desc: tl.questionsDesc },
          { icon: Brain, color: INK, soft: COLORS.xpSofter, title: tl.aiTitle, desc: tl.aiDesc },
          { icon: Zap, color: COLORS.win, soft: COLORS.winSoft, title: tl.simTitle, desc: tl.simDesc },
        ].map((f, i) => (
          <div key={i} style={{
            ...CARD,
            display: 'flex',
            gap: 14,
            marginBottom: 12,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: f.soft,
              border: `2px solid ${INK}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <f.icon size={20} color={f.color} strokeWidth={2.25} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPE.h3, fontSize: 15, marginBottom: 4 }}>{f.title}</div>
              <div style={{ ...TYPE.bodySmall, lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Three steps to your dream score — ink mockup cards (3-col on desktop) */}
      <section style={{ padding: isDesktop ? '36px 24px 16px' : '20px 20px 12px', maxWidth: isDesktop ? 1080 : 440, margin: '0 auto' }}>
        <h2 style={{ ...TYPE.h1, fontSize: isDesktop ? 32 : 24, textAlign: 'center', marginBottom: isDesktop ? 36 : 24, textWrap: 'balance' as const }}>
          {tl.threeSteps}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: isDesktop ? 24 : 0, alignItems: 'stretch' }}>

        {/* 01 — Diagnostic / predicted score */}
        <div style={{ marginBottom: isDesktop ? 0 : 28, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: COLORS.xpSofter, border: `2px solid ${INK}`, borderRadius: 16, boxShadow: `0 3px 0 0 ${INK}`, padding: 12, flex: isDesktop ? 1 : 'none' }}>
            <div style={{ background: '#FFF', border: `2px solid ${INK}`, borderRadius: 12, padding: '14px 14px 16px' }}>
              <div style={{ ...TYPE.statLabel, marginTop: 0, marginBottom: 4, color: 'var(--ink-soft)' }}>{tl.mockPrediction}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: FF.display, fontSize: 38, fontWeight: 800, color: INK, letterSpacing: '-0.03em' }}>118</span>
                <span style={{ fontFamily: FF.display, fontSize: 14, color: 'var(--ink-soft)', fontWeight: 700 }}>/ 140</span>
              </div>
              <div style={{ display: 'flex', gap: 22, margin: '10px 0 14px' }}>
                {[
                  { n: tl.mockMath, v: 34 },
                  { n: t.subjects.history, v: 17 },
                  { n: t.subjects.physics, v: 31 },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ ...TYPE.caption, fontSize: 10, color: 'var(--ink-soft)' }}>{s.n}</div>
                    <div style={{ fontFamily: FF.mono, fontSize: 16, fontWeight: 800, color: INK }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...TYPE.statLabel, marginTop: 0, marginBottom: 8, color: 'var(--ink-soft)' }}>{tl.mockWeakTopics}</div>
              {[
                { name: 'Производная и интеграл', pct: 58, color: COLORS.red },
                { name: 'Стереометрия', pct: 72, color: COLORS.xp },
                { name: 'Тригонометрия', pct: 81, color: COLORS.win },
              ].map((b, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FF.body, marginBottom: 3 }}>
                    <span style={{ color: INK, fontWeight: 600 }}>{b.name}</span>
                    <span style={{ color: 'var(--ink-soft)', fontFamily: FF.mono, fontWeight: 700 }}>{b.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, border: `1.5px solid ${INK}`, background: '#FFF', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...TYPE.eyebrow, marginTop: 14 }}>01</div>
          <div style={{ ...TYPE.h3, fontSize: 17, margin: '4px 0 4px' }}>{tl.step1Title}</div>
          <div style={{ ...TYPE.bodySmall, fontSize: 13.5, lineHeight: 1.55 }}>{tl.step1Desc}</div>
        </div>

        {/* 02 — Tailored plan */}
        <div style={{ marginBottom: isDesktop ? 0 : 28, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: COLORS.streakSoft, border: `2px solid ${INK}`, borderRadius: 16, boxShadow: `0 3px 0 0 ${INK}`, padding: 12, flex: isDesktop ? 1 : 'none', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#FFF', border: `2px solid ${INK}`, borderRadius: 12, padding: 6, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {[
                { name: 'Квадратные уравнения', chip: tl.mockMath, color: COLORS.streak, time: 25 },
                { name: 'Тюркский каганат', chip: t.subjects.history, color: COLORS.win, time: 20 },
                { name: 'Законы Ньютона', chip: t.subjects.physics, color: '#EC4899', time: 30 },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', flex: 1, borderBottom: i < 2 ? `1.5px solid rgba(15,15,16,0.1)` : 'none' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${INK}`, flexShrink: 0, opacity: 0.35 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FF.body, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, fontFamily: FF.mono, color: INK, background: `${r.color}33`, border: `1.5px solid ${r.color}`, padding: '1px 6px', borderRadius: 6, letterSpacing: '0.04em' }}>{r.chip}</span>
                      <span style={{ ...TYPE.caption, fontSize: 10, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {r.time} {tl.mockMin}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, fontFamily: FF.body, color: '#fff', background: r.color, border: `1.5px solid ${INK}`, padding: '6px 12px', borderRadius: 9, flexShrink: 0 }}>{tl.mockStart}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...TYPE.eyebrow, marginTop: 14 }}>02</div>
          <div style={{ ...TYPE.h3, fontSize: 17, margin: '4px 0 4px' }}>{tl.step2Title}</div>
          <div style={{ ...TYPE.bodySmall, fontSize: 13.5, lineHeight: 1.55 }}>{tl.step2Desc}</div>
        </div>

        {/* 03 — Hit your target: question bank + Question Rush */}
        <div style={{ marginBottom: isDesktop ? 0 : 8, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: COLORS.winSoft, border: `2px solid ${INK}`, borderRadius: 16, boxShadow: `0 3px 0 0 ${INK}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: isDesktop ? 1 : 'none' }}>
            <div style={{ background: '#FFF', border: `2px solid ${INK}`, borderRadius: 12, padding: '13px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <BookOpen size={15} color={COLORS.win} strokeWidth={2.5} />
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FF.body, color: INK }}>{tl.mockBank}</span>
              </div>
              <div style={{ ...TYPE.bodySmall, fontSize: 12, color: 'rgba(15,15,16,0.65)', lineHeight: 1.5 }}>{tl.mockBankDesc}</div>
            </div>
            <div style={{ background: '#FFF', border: `2px solid ${INK}`, borderRadius: 12, padding: '13px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={15} color={COLORS.streak} fill={COLORS.streak} />
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FF.body, color: INK }}>Question Rush</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {[0, 1, 2].map(i => <Star key={i} size={13} fill={COLORS.xp} color={INK} strokeWidth={1.5} />)}
                </span>
              </div>
              <div style={{ ...TYPE.bodySmall, fontSize: 12, color: 'rgba(15,15,16,0.65)', lineHeight: 1.5 }}>{tl.mockRushDesc}</div>
            </div>
          </div>
          <div style={{ ...TYPE.eyebrow, marginTop: 14 }}>03</div>
          <div style={{ ...TYPE.h3, fontSize: 17, margin: '4px 0 4px' }}>{tl.step3Title}</div>
          <div style={{ ...TYPE.bodySmall, fontSize: 13.5, lineHeight: 1.55 }}>{tl.step3Desc}</div>
        </div>

        </div>
      </section>

      {/* What's included — ink card with streak checks */}
      <section style={{ padding: '12px 20px', maxWidth: 440, margin: '0 auto' }}>
        <div style={{
          ...CARD_HERO,
          background: COLORS.winSoft,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Flame size={18} color={COLORS.streak} strokeWidth={2.5} fill={COLORS.streak} />
            <h2 style={{ ...TYPE.h2, color: INK }}>
              {tl.allFree}
            </h2>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              tl.feat1,
              `${qLabel} ${tl.feat2}`,
              tl.feat3,
              tl.feat4,
              tl.feat5,
              tl.feat6,
              tl.feat7,
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} color={INK} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <span style={{ ...TYPE.body, fontSize: 14, color: INK }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Schools — ink card */}
      <section style={{ padding: '20px 20px 12px', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ ...CARD, textAlign: 'center', padding: '24px 18px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: COLORS.streakSoft,
            border: `2px solid ${INK}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={24} color={INK} strokeWidth={2.25} />
          </div>
          <h2 style={{ ...TYPE.h2, marginBottom: 8 }}>
            {tl.forSchools}
          </h2>
          <p style={{ ...TYPE.bodySmall, marginBottom: 16, maxWidth: 320, margin: '0 auto 16px' }}>
            {tl.schoolsDesc}
          </p>
          <a
            href={`https://wa.me/77473564629?text=${encodeURIComponent('Здравствуйте, Дияр! Хочу создать класс в ENTprep для учителя — подскажите как.')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...BUTTON.secondary,
              borderColor: INK,
              borderBottomColor: INK,
              padding: '12px 20px',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            <Users size={16} /> {tl.createClassFree}
          </a>
          <div style={{ ...TYPE.caption, marginTop: 12 }}>
            {tl.needHelp}{' '}
            <a
              href={`https://wa.me/77473564629?text=${encodeURIComponent('Здравствуйте! Хочу подключить школу к ENTprep')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: COLORS.streak, textDecoration: 'underline', fontWeight: 700 }}
            >
              {tl.whatsapp}
            </a>
          </div>
        </div>
      </section>

      {/* Footer — author + socials */}
      <section style={{ padding: '24px 20px 16px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ ...TYPE.caption, marginBottom: 14 }}>
          <span style={{ fontFamily: FF.display, fontWeight: 800 }}>
            <span style={{ color: INK }}>ENT</span><span style={{ color: COLORS.streak }}>prep.</span>
          </span>
          {' '}· {tl.format}
        </div>
        <div style={{ ...TYPE.caption, marginBottom: 10, fontWeight: 600, color: INK, opacity: 0.75 }}>
          {tl.madeBy}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          {[
            { icon: Send, href: 'https://t.me/foustie', label: 'Telegram' },
            { icon: Instagram, href: 'https://instagram.com/diyarbuilds', label: 'Instagram' },
            { icon: AtSign, href: 'https://tiktok.com/@diyarbuilds', label: 'TikTok' },
          ].map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#FFF',
                border: `2px solid ${INK}`,
                boxShadow: `0 2px 0 0 ${INK}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: INK,
                textDecoration: 'none',
              }}
            >
              <s.icon size={16} strokeWidth={2.25} />
            </a>
          ))}
        </div>
      </section>

      {/* Sticky CTA — ink-shadow, no gradient */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        background: 'rgba(255,255,255,0.92)',
        borderTop: `2px solid ${INK}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <button
          onClick={onStart}
          style={{
            ...BUTTON.primary,
            width: '100%',
            maxWidth: 440,
            padding: '15px 24px',
            fontSize: 15,
            borderRadius: 14,
            justifyContent: 'center',
            margin: '0 auto',
            display: 'flex',
          }}
        >
          {tl.startFree} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
