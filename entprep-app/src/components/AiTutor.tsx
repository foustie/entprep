import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CARD_COMPACT, COLORS } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { TOPIC_MAP } from '../config/topics';
import {
  sendTutorMessage, buildStudentProfile, startVoiceInput, getTopicName,
} from '../utils/tutorHelpers';
import type { TutorMessage, StudentProfile } from '../utils/tutorHelpers';
import { trackEvent } from '../utils/analytics';
import { API_BASE } from '../config/app';
import BackButton from './ui/BackButton';
import SubjectIcon from './ui/SubjectIcon';
import {
  Send, Mic, MicOff, BookOpen, ClipboardList, Brain,
  Heart, AlertCircle, Sparkles, ChevronRight, Camera,
} from 'lucide-react';

interface Props {
  initialSubject?: string;
  initialTopicId?: string;
  initialMode?: string;
  initialMessage?: string;
}

const ACCENT = '#8b5cf6';

export default function AiTutor({ initialSubject, initialTopicId, initialMode, initialMessage }: Props) {
  const { goHome, nav } = useNav();
  const { user } = useAuth();
  const { hist, st } = useApp();
  const toast = useToast();
  const t = useT();
  const bp = useBreakpoint();
  const isKk = st.lang === 'kk';

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState(initialSubject || '');
  const [topicId, setTopicId] = useState(initialTopicId || '');
  const [mode, setMode] = useState(initialMode || '');
  const [recording, setRecording] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const profileRef = useRef<StudentProfile>(buildStudentProfile(hist, st.goal));
  const sendingRef = useRef(false);

  // Pre-warm the serverless function on mount (HEAD request, no auth needed)
  useEffect(() => {
    fetch(`${API_BASE}/api/ai-tutor`, { method: 'OPTIONS' }).catch(() => {});
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial message
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSend(initialMessage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    // Reset stuck state — if loading was stuck from a previous failed attempt, force reset
    if (loading || sendingRef.current) {
      setLoading(false);
      sendingRef.current = false;
      // Allow this send to proceed on next tick
      await new Promise(r => setTimeout(r, 0));
    }
    sendingRef.current = true;
    if (!user) { toast.error(isKk ? 'Кіру қажет' : 'Войдите в аккаунт'); sendingRef.current = false; return; }

    const userMsg: TutorMessage = { role: 'user', content: msg, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Add placeholder
      const placeholderIdx = newMessages.length;
      setMessages(prev => [...prev, { role: 'assistant', content: '⏳', timestamp: Date.now() }]);

      const res = await sendTutorMessage(newMessages, profileRef.current, {
        subject, topicId, lang: st.lang, mode: mode || 'chat',
      }, (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[placeholderIdx] = { ...updated[placeholderIdx], content: chunk };
          return updated;
        });
      });

      setMessages(prev => {
        const updated = [...prev];
        updated[placeholderIdx] = { role: 'assistant', content: res.text, timestamp: Date.now() };
        return updated;
      });
      trackEvent('tutor_message', { subject, mode });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Ошибка';
      // Replace placeholder with error message
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1]?.content === '⏳') {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: errMsg.includes('Лимит')
              ? (isKk ? 'Бүгінгі сұхбаттар лимиті аяқталды. Ертең тағы 20 хабарлама болады 💜' : 'Сообщения на сегодня закончились. Завтра будет ещё 20 💜')
              : (isKk ? 'Қате орын алды. Қайтадан жіберіп көріңіз.' : `Ошибка: ${errMsg}. Попробуй ещё раз.`),
            timestamp: Date.now(),
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  const handleVoice = () => {
    if (recording && stopRecordingRef.current) {
      stopRecordingRef.current();
      setRecording(false);
      return;
    }
    setRecording(true);
    stopRecordingRef.current = startVoiceInput(
      st.lang,
      (text) => { setInput(text); setRecording(false); },
      (err) => { toast.error(err); setRecording(false); },
    );
  };

  const handleQuickAction = (actionMode: string, actionSubject?: string, actionTopicId?: string, autoMessage?: string) => {
    setMode(actionMode);
    if (actionSubject) setSubject(actionSubject);
    if (actionTopicId) setTopicId(actionTopicId);
    if (autoMessage) {
      handleSend(autoMessage);
    }
  };

  const handleTopicSelect = (sid: string, tid: string) => {
    setSubject(sid);
    setTopicId(tid);
    setShowSubjectPicker(false);
    const name = getTopicName(sid, tid);
    handleSend(isKk ? `Тақырыпты түсіндір: ${name}` : `Объясни мне тему: ${name}`);
  };

  const padBottom = bp === 'desktop' ? 40 : 100;

  // ── Quick Actions (shown when no messages) ──
  if (messages.length === 0 && !showSubjectPicker) {
    const actions = [
      {
        icon: <BookOpen size={20} color={ACCENT} />,
        title: isKk ? 'Тақырыпты түсіндір' : 'Объясни тему',
        desc: isKk ? 'Конспект + Сократ әдісі' : 'Конспект + Сократовский метод',
        onClick: () => setShowSubjectPicker(true),
      },
      {
        icon: <ClipboardList size={20} color={COLORS.teal} />,
        title: isKk ? 'Жоспар құр' : 'Составь план',
        desc: isKk ? 'Жеке дайындық жоспары' : 'Персональный план подготовки',
        onClick: () => handleQuickAction('plan', '', '', isKk ? 'Маған ҰБТ-ға дайындық жоспарын құр' : 'Составь мне план подготовки к ЕНТ'),
      },
      {
        icon: <Brain size={20} color={COLORS.amber} />,
        title: isKk ? 'Мені тексер' : 'Проверь меня',
        desc: isKk ? 'Әлсіз тақырыптар бойынша 5 сұрақ' : '5 вопросов по слабым темам',
        onClick: () => handleQuickAction('quiz', '', '', isKk ? 'Менің әлсіз тақырыптарым бойынша тексер' : 'Проверь меня по моим слабым темам'),
      },
      {
        icon: <AlertCircle size={20} color={COLORS.red} />,
        title: isKk ? 'Қателерді талда' : 'Разбери ошибки',
        desc: isKk ? 'Қателер заңдылығын анықта' : 'Найди паттерн в моих ошибках',
        onClick: () => handleQuickAction('errors', '', '', isKk ? 'Менің қателерімді талда' : 'Проанализируй мои ошибки и найди паттерн'),
      },
      {
        icon: <Heart size={20} color="#ec4899" />,
        title: isKk ? 'Мен қорқамын' : 'Мне страшно',
        desc: isKk ? 'Қолдау + кеңестер' : 'Поддержка + практические советы',
        onClick: () => handleQuickAction('support', '', '', isKk ? 'Мен ҰБТ-дан қорқамын' : 'Я боюсь ЕНТ. Мне нужна поддержка'),
      },
    ];

    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px` }}>
        <BackButton onClick={goHome} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16,
            background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              AI {isKk ? 'Репетитор' : 'Репетитор'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {isKk ? 'Жеке тьютор. Сократ әдісімен.' : 'Персональный тьютор. Сократовский метод.'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a, i) => (
            <button key={i} onClick={a.onClick} style={{
              ...CARD_COMPACT, display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              width: '100%', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${[ACCENT, COLORS.teal, COLORS.amber, COLORS.red, '#ec4899'][i]}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {a.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{a.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.desc}</div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
          ))}
        </div>

        {/* Support heart */}
        <div style={{ textAlign: 'center', marginTop: 24, padding: '12px', opacity: 0.6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            💜 {isKk ? 'AI репетитор Дияр есебінен жұмыс істейді' : 'AI репетитор работает за счёт Дияра'}
          </div>
        </div>

        {/* Input for free-form */}
        <div style={{
          position: 'fixed', bottom: bp === 'desktop' ? 20 : 80, left: 0, right: 0,
          padding: '8px var(--content-padding)',
          background: 'var(--bg)', borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 8, maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isKk ? 'Кез келген сұрақ қой...' : 'Задай любой вопрос...'}
              rows={1}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.4,
              }}
            />
            <button onClick={() => handleSend()} disabled={!input.trim()} style={{
              width: 44, height: 44, borderRadius: 14,
              background: input.trim() ? `linear-gradient(135deg, ${ACCENT}, #a855f7)` : 'var(--bg-card)',
              border: 'none', color: '#fff', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Subject/Topic Picker ──
  if (showSubjectPicker) {
    const allSubs = [
      ...Object.values(SUBS).map(s => ({ id: s.id, name: s.name, icon: s.icon, color: s.color })),
      ...ALL_PROFILES.map(p => ({ id: p.id, name: p.name, icon: p.icon, color: p.color })),
    ];

    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px` }}>
        <BackButton onClick={() => setShowSubjectPicker(false)} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          {isKk ? 'Пәнді таңда' : 'Выбери предмет и тему'}
        </div>
        {allSubs.map(s => {
          const topics = TOPIC_MAP[s.id];
          if (!topics) return null;
          return (
            <details key={s.id} style={{ marginBottom: 6 }}>
              <summary style={{
                ...CARD_COMPACT, padding: '12px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                listStyle: 'none',
              }}>
                <SubjectIcon sid={s.id} size={18} color={s.color} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                  {(t.subjects as Record<string, string>)[s.id] || s.name}
                </span>
                <ChevronRight size={14} color={s.color} />
              </summary>
              <div style={{ marginLeft: 20, paddingLeft: 10, marginTop: 4 }}>
                {topics.map(tp => (
                  <React.Fragment key={tp.id}>
                    {(tp.subtopics || []).map(st => (
                      <button key={st.id} onClick={() => handleTopicSelect(s.id, st.id)} style={{
                        display: 'block', width: '100%', padding: '8px 10px',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                        textAlign: 'left', cursor: 'pointer', fontSize: 12,
                        color: 'var(--text)', fontWeight: 500,
                      }}>
                        {isKk && st.name_kk ? st.name_kk : st.name}
                      </button>
                    ))}
                    {(!tp.subtopics || tp.subtopics.length === 0) && (
                      <button onClick={() => handleTopicSelect(s.id, tp.id)} style={{
                        display: 'block', width: '100%', padding: '8px 10px',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                        textAlign: 'left', cursor: 'pointer', fontSize: 12,
                        color: 'var(--text)', fontWeight: 500,
                      }}>
                        {isKk && tp.name_kk ? tp.name_kk : tp.name}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  }

  // ── Chat View ──
  return (
    <div style={{ padding: `0 var(--content-padding) ${padBottom + 70}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <BackButton onClick={() => setMessages([])} />
        <button onClick={() => setShowSupport(s => !s)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px', display: 'flex', alignItems: 'center', gap: 4,
          color: showSupport ? '#ec4899' : 'var(--text-muted)',
          fontSize: 11, fontWeight: 600,
        }}>
          <Heart size={16} fill={showSupport ? '#ec4899' : 'none'} />
        </button>
      </div>

      {/* Support banner */}
      {showSupport && (
        <div style={{
          ...CARD_COMPACT, padding: '12px 14px', marginBottom: 12,
          background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)',
          animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6, fontWeight: 600 }}>
            💜 {isKk ? 'Бұл AI менің қалтамнан жұмыс істейді' : 'Этот AI работает из моего кармана'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
            {isKk
              ? 'Мен, Дияр, 17 жастамын. Әр AI хабарлама маған ақша тұрады. Бірақ мен мұны жалғастырғым келеді — тегін. Егер көмек бергің келсе:'
              : 'Я Дияр, мне 17. Каждое AI сообщение стоит мне денег. Но я хочу чтобы это оставалось бесплатным. Если хочешь поддержать:'}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.2)',
            fontSize: 13, fontWeight: 700, color: '#ec4899', textAlign: 'center',
          }}>
            Kaspi: 8 747 356 4629
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            {isKk ? 'Кез келген сома көмектеседі 🙏' : 'Любая сумма помогает 🙏'}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          marginBottom: 8,
        }}>
          <div style={{
            maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
            background: msg.role === 'user'
              ? `linear-gradient(135deg, ${ACCENT}, #a855f7)`
              : 'var(--bg-card)',
            border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
            color: msg.role === 'user' ? '#fff' : 'var(--text)',
            fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
            borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
          }}>
            {msg.role === 'assistant' && msg.content === '⏳' ? (
              <div style={{ display: 'flex', gap: 4, padding: '2px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: ACCENT,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    opacity: 0.6,
                  }} />
                ))}
              </div>
            ) : msg.role === 'assistant' ? renderBold(msg.content) : msg.content}
          </div>
        </div>
      ))}

      {/* Loading indicator (hide if placeholder already showing) */}
      {loading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
          <div style={{
            padding: '12px 18px', borderRadius: 16, borderBottomLeftRadius: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: ACCENT,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.6,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* Input bar */}
      <div style={{
        position: 'fixed', bottom: bp === 'desktop' ? 20 : 70, left: 0, right: 0,
        padding: '8px var(--content-padding)',
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 6, maxWidth: 'var(--content-max-width)', margin: '0 auto', alignItems: 'flex-end' }}>
          {/* Voice button */}
          {'webkitSpeechRecognition' in window && (
            <button onClick={handleVoice} style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: recording ? 'rgba(239,68,68,0.12)' : 'var(--bg-card)',
              border: recording ? `1.5px solid ${COLORS.red}` : '1px solid var(--border)',
              color: recording ? COLORS.red : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: recording ? 'pulse 1s ease-in-out infinite' : 'none',
            }}>
              {recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isKk ? 'Сұрақ қой...' : 'Спроси что-нибудь...'}
            rows={1}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 14,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 14, resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.4,
              maxHeight: 100,
            }}
          />

          <button onClick={() => handleSend()} disabled={!input.trim() || loading} style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: input.trim() && !loading ? `linear-gradient(135deg, ${ACCENT}, #a855f7)` : 'var(--bg-card)',
            border: input.trim() && !loading ? 'none' : '1px solid var(--border)',
            color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple bold text renderer for **text**
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}
