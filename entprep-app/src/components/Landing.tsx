import React from 'react';
import { COLORS, TINT, R } from '../constants/styles';
import { BookOpen, Brain, Zap, Users, ArrowRight, GraduationCap, CheckCircle2, ChevronDown } from 'lucide-react';

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
