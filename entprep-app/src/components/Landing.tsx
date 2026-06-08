import React from 'react';
import { COLORS, TINT, R } from '../constants/styles';
import { BookOpen, Brain, Zap, Users, ArrowRight, GraduationCap, CheckCircle2, ChevronDown, Star, Clock } from 'lucide-react';

interface Props {
  onStart: () => void;
  totalQ: number;
}

export default function Landing({ onStart, totalQ }: Props) {
  const qLabel = `${Math.floor(totalQ / 1000)} 000+`;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Segoe UI',-apple-system,sans-serif", paddingBottom: 80 }}>

      {/* Hero */}
      <section style={{ padding: '16px 24px 20px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", marginBottom: 20 }}>
          <span style={{ color: COLORS.accent }}>ENT</span><span style={{ color: COLORS.teal }}>prep</span>
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 800, fontFamily: "'Unbounded',sans-serif",
          lineHeight: 1.2, marginBottom: 16, color: 'var(--text)',
        }}>
          Бесплатная подготовка к&nbsp;ЕНТ
        </h1>

        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>
          {qLabel} вопросов · 13 предметов · AI объясняет каждую ошибку
        </p>

        <button onClick={onStart} style={{
          width: '100%', maxWidth: 320, padding: '18px 24px',
          background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDark})`,
          border: 'none', borderRadius: 16, color: '#fff',
          fontSize: 17, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(255,107,53,0.3)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          Начать бесплатно <ArrowRight size={20} />
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          Без регистрации · без оплаты · сразу к вопросам
        </p>

        {/* Social proof bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24,
          flexWrap: 'wrap',
        }}>
          {[
            { value: qLabel, label: 'вопросов' },
            { value: '13', label: 'предметов' },
            { value: 'AI', label: 'объяснения' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", color: i === 2 ? COLORS.accent : COLORS.teal }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <ChevronDown size={24} color="var(--text-muted)" style={{ opacity: 0.5, animation: 'bounce 2s infinite' }} />
        </div>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}`}</style>
      </section>

      {/* Features */}
      <section style={{ padding: '40px 24px', maxWidth: 440, margin: '0 auto' }}>
        {[
          { icon: BookOpen, color: COLORS.teal, title: `${qLabel} вопросов`, desc: 'Все 13 предметов ЕНТ с объяснениями. Обычные, множественные и на соответствие.' },
          { icon: Brain, color: COLORS.accent, title: 'AI разбирает ошибки', desc: 'Claude Sonnet объясняет почему ты ошибся и как решить правильно.' },
          { icon: Zap, color: COLORS.amber, title: 'Полная симуляция ЕНТ', desc: '120 вопросов, 5 предметов, 4 часа — точный формат экзамена.' },
        ].map((f, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${f.color}15`, border: `1px solid ${f.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <f.icon size={22} color={f.color} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Three steps to your dream score */}
      <section style={{ padding: '24px 24px 8px', maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", lineHeight: 1.25, textAlign: 'center', marginBottom: 32, color: 'var(--text)' }}>
          Три шага к&nbsp;баллу мечты
        </h2>

        {/* 01 — Diagnostic / predicted score */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ background: TINT.teal.bg, borderRadius: 20, padding: 14 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 16px 18px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Прогноз балла</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", color: 'var(--text)' }}>118</span>
                <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 600 }}>/ 140</span>
              </div>
              <div style={{ display: 'flex', gap: 24, margin: '12px 0 16px' }}>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Математика</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>34</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>История</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>17</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Физика</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>31</div></div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Слабые темы</div>
              {[
                { name: 'Производная и интеграл', pct: 58, color: COLORS.red },
                { name: 'Стереометрия', pct: 72, color: COLORS.amber },
                { name: 'Тригонометрия', pct: 81, color: COLORS.green },
              ].map((b, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-body)' }}>{b.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{b.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle-2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'Unbounded',sans-serif", fontWeight: 700, marginTop: 16 }}>01</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '2px 0 4px' }}>Пройди диагностику</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Узнай свой прогнозируемый балл и темы, которые забирают больше всего очков.</div>
        </div>

        {/* 02 — Tailored plan */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ background: TINT.accent.bg, borderRadius: 20, padding: 14 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 8, border: '1px solid var(--border-light)' }}>
              {[
                { name: 'Квадратные уравнения', chip: 'Математика', color: COLORS.accent, time: '25 мин' },
                { name: 'Тюркский каганат', chip: 'История', color: COLORS.teal, time: '20 мин' },
                { name: 'Законы Ньютона', chip: 'Физика', color: '#EC4899', time: '30 мин' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid var(--border-strong)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: r.color, background: `${r.color}1a`, padding: '2px 7px', borderRadius: 6 }}>{r.chip}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {r.time}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: r.color, padding: '7px 14px', borderRadius: 10 }}>Начать</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'Unbounded',sans-serif", fontWeight: 700, marginTop: 16 }}>02</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '2px 0 4px' }}>Получи персональный план</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Укажи дату экзамена и цель. План сам перестраивается по мере роста твоей точности.</div>
        </div>

        {/* 03 — Hit your target */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ background: TINT.green.bg, borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <BookOpen size={16} color={COLORS.teal} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Банк вопросов</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Решай в своём темпе с полными объяснениями каждой ошибки.</div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={16} color={COLORS.accent} fill={COLORS.accent} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Question Rush</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 800, color: COLORS.amber }}>
                  <Star size={13} fill={COLORS.amber} color={COLORS.amber} /><Star size={13} fill={COLORS.amber} color={COLORS.amber} /><Star size={13} fill={COLORS.amber} color={COLORS.amber} />
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Гонка на время. Чем быстрее отвечаешь — тем больше звёзд.</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'Unbounded',sans-serif", fontWeight: 700, marginTop: 16 }}>03</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '2px 0 4px' }}>Достигни своей цели</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Целевые дриллы и тренировки на скорость, собранные вокруг твоих слабых тем.</div>
        </div>
      </section>

      {/* What's included */}
      <section style={{
        padding: '32px 24px', maxWidth: 440, margin: '0 auto',
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border-light)',
        marginLeft: 16, marginRight: 16,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Unbounded',sans-serif", marginBottom: 20, color: 'var(--text)' }}>
          Всё бесплатно
        </h2>
        {[
          '13 предметов ЕНТ',
          `${qLabel} вопросов с ответами`,
          'Объяснение каждой ошибки',
          'Статистика и прогресс',
          'Дуэли с друзьями',
          'Калькулятор грантов',
          'Работает офлайн',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CheckCircle2 size={16} color={COLORS.green} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{item}</span>
          </div>
        ))}
      </section>

      {/* For Schools */}
      <section style={{ padding: '48px 24px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: TINT.teal.bg, border: `1px solid ${TINT.teal.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GraduationCap size={28} color={COLORS.teal} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Unbounded',sans-serif", marginBottom: 8, color: 'var(--text)' }}>
          Для школ и учителей
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
          Панель учителя: следите за прогрессом класса, находите слабые предметы, мотивируйте учеников.
        </p>
        <a
          href="https://wa.me/77473564629?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BA%D0%BB%D1%8E%D1%87%D0%B8%D1%82%D1%8C%20%D1%88%D0%BA%D0%BE%D0%BB%D1%83%20%D0%BA%20ENTprep"
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 14,
            background: COLORS.teal, color: '#fff',
            fontSize: 15, fontWeight: 700, textDecoration: 'none',
          }}
        >
          <Users size={18} /> Подключить школу
        </a>
      </section>

      {/* Footer */}
      <section style={{ padding: '32px 24px 20px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          <span style={{ fontFamily: "'Unbounded',sans-serif", fontWeight: 800 }}>
            <span style={{ color: COLORS.accent }}>ENT</span><span style={{ color: COLORS.teal }}>prep</span>
          </span>
          {' '}· Формат ЕНТ 2026
        </div>
      </section>

      {/* Sticky CTA — mobile */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'var(--bg-footer)',
        borderTop: '1px solid var(--border-light)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <button onClick={onStart} style={{
          width: '100%', maxWidth: 440, padding: '16px 24px',
          background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDark})`,
          border: 'none', borderRadius: 14, color: '#fff',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255,107,53,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          margin: '0 auto',
        }}>
          Начать бесплатно <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
