import React, { useState, useEffect, useRef } from 'react';
import { CARD_COMPACT, COLORS, FF, FS, R } from '../constants/styles';
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
import { consumeTutor as consumeTutorLimit, getTutorRemaining } from '../utils/aiLimits';
import { API_BASE } from '../config/app';
import BackButton from './ui/BackButton';
import SubjectIcon from './ui/SubjectIcon';
import PaywallScreen from './ui/PaywallScreen';
import { Send, Mic, MicOff, Heart, ChevronRight, Camera } from 'lucide-react';

interface Props {
  initialSubject?: string;
  initialTopicId?: string;
  initialMode?: string;
  initialMessage?: string;
}

const ACCENT = '#8b5cf6';

export default function AiTutor({ initialSubject, initialTopicId, initialMode, initialMessage }: Props) {
  const { goHome, nav } = useNav();
  const { user, isPremium } = useAuth();
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
  const [pickerExpanded, setPickerExpanded] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const profileRef = useRef<StudentProfile>(buildStudentProfile(hist, st.goal));
  const sendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleSendRef = useRef<(text?: string, images?: string[]) => void>(() => {});

  const handleCameraClick = () => {
    if (!user) { toast.warning(t.test.loginRequired); return; }
    if (!isPremium) { trackEvent('AI Tutor Camera Paywall'); setShowPaywall(true); return; }
    fileInputRef.current?.click();
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const MAX_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.warning(t.tutor.photoTooLarge);
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type)) {
      toast.warning(t.tutor.photoBadFormat);
      return;
    }
    trackEvent('AI Tutor Photo Sent', { size: file.size });
    // Downscale before sending — cuts vision tokens/payload ~10x and normalizes to JPEG.
    const dataUrl = await downscaleImage(file);
    if (!dataUrl) return;
    // Route the photo through the real send pipeline (multimodal vision request)
    handleSendRef.current(t.tutor.photoCaption, [dataUrl]);
  };

  // Pre-warm the serverless function on mount (HEAD request, no auth needed)
  useEffect(() => {
    fetch(`${API_BASE}/api/ai-tutor`, { method: 'OPTIONS' }).catch(() => {});
    // Check if we have a question context from Test nudge
    try {
      const raw = sessionStorage.getItem('entprep_tutor_init');
      if (raw) {
        sessionStorage.removeItem('entprep_tutor_init');
        const ctx = JSON.parse(raw);
        if (ctx.subject) setSubject(ctx.subject);
        if (ctx.message) {
          // Auto-send — use ref to avoid stale closure over auth state
          setTimeout(() => {
            setInput(ctx.message);
            setTimeout(() => handleSendRef.current(ctx.message), 100);
          }, 300);
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep handleSend ref fresh for deferred timers
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial message — via ref to avoid stale auth closure
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSendRef.current(initialMessage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop any in-flight voice recognition when leaving the tutor (mic privacy/cleanup)
  useEffect(() => () => { stopRecordingRef.current?.(); }, []);

  const handleSend = async (text?: string, images?: string[]) => {
    const msg = text || input.trim();
    if (!msg && !(images && images.length)) return;
    // Reset stuck state — if loading was stuck from a previous failed attempt, force reset
    if (loading || sendingRef.current) {
      setLoading(false);
      sendingRef.current = false;
      // Allow this send to proceed on next tick
      await new Promise(r => setTimeout(r, 0));
    }
    sendingRef.current = true;
    if (!user) { toast.error(t.test.loginRequired); sendingRef.current = false; return; }
    // Gate only — do NOT consume here. The quota is consumed after a successful
    // response so failed/timed-out/429 sends don't burn a free user's daily message.
    if (!isPremium && getTutorRemaining() <= 0) {
      trackEvent('AI Tutor Limit Hit');
      setShowPaywall(true);
      sendingRef.current = false;
      return;
    }

    const userMsg: TutorMessage = { role: 'user', content: msg || t.tutor.photoCaption, timestamp: Date.now(), ...(images && images.length ? { images } : {}) };
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
      // Consume the daily quota only on a successful response (one per success).
      if (!isPremium) consumeTutorLimit();
      trackEvent('tutor_message', { subject, mode });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : t.tutor.errorWord;
      // Replace placeholder with error message
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1]?.content === '⏳') {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: errMsg.includes('Лимит')
              ? errMsg.replace(/^Error:\s*/, '')
              : t.tutor.sendError.replace('{err}', errMsg),
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
      st.lang ?? 'ru',
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
    handleSend(t.tutor.explainTopicPrompt.replace('{topic}', name));
  };

  const padBottom = bp === 'desktop' ? 40 : 100;

  // ── Quick Actions (shown when no messages) ──
  // PaywallScreen uses createPortal — render before early returns so it's always available
  const paywallEl = showPaywall ? <PaywallScreen trigger="tutor_limit" onClose={() => setShowPaywall(false)} /> : null;

  if (messages.length === 0 && !showSubjectPicker) {
    const suggestions: { label: string; onClick: () => void }[] = [
      {
        label: t.tutor.sgExplainTopic,
        onClick: () => setShowSubjectPicker(true),
      },
      {
        label: t.tutor.sgMakePlan,
        onClick: () => handleQuickAction('plan', '', '', t.tutor.sgMakePlanMsg),
      },
      {
        label: t.tutor.sgReviewErrors,
        onClick: () => handleQuickAction('errors', '', '', t.tutor.sgReviewErrorsMsg),
      },
      {
        label: t.tutor.sgScared,
        onClick: () => handleQuickAction('support', '', '', t.tutor.sgScaredMsg),
      },
    ];

    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom + 140}px`, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Compact chat header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 14, padding: '10px 0',
          borderBottom: '1.5px solid rgba(15,15,16,0.1)',
        }}>
          <BackButton onClick={goHome} />
          <div style={{
            position: 'relative',
            width: 38, height: 38, borderRadius: R.md,
            background: COLORS.streak, border: `2px solid ${COLORS.xp}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: FF.brand,
            fontWeight: 900, fontSize: FS.xl, letterSpacing: '-0.04em',
            flexShrink: 0,
          }}>
            Д
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: '50%',
              background: COLORS.win, border: '2px solid var(--bg)',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FF.display, fontSize: 13, fontWeight: 900,
              color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>{t.tutor.name}</div>
            <div style={{
              fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: COLORS.win, marginTop: 1,
            }}>{t.tutor.online} · {isPremium ? 'PRO' : getTutorRemaining() + '/10'}</div>
          </div>
        </div>

        {/* Welcome assistant bubble */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          marginBottom: 12,
          animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: COLORS.streak, border: '1.5px solid var(--ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: FF.brand,
            fontWeight: 900, fontSize: 12, letterSpacing: '-0.04em',
            flexShrink: 0, marginBottom: 2,
          }}>Д</div>
          <div style={{
            maxWidth: '85%',
            padding: '12px 14px',
            borderRadius: 16, borderBottomLeftRadius: R.sm,
            background: 'var(--bg-card)',
            border: '2px solid var(--ink)',
            boxShadow: '0 2px 0 0 var(--ink)',
            fontFamily: FF.body, fontSize: FS.lg, fontWeight: 600,
            color: 'var(--text)', lineHeight: 1.55,
          }}>
            <div style={{ marginBottom: 8 }}>
              {t.tutor.welcome}
            </div>
            <div style={{
              fontFamily: FF.mono, fontSize: FS.xs, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>{t.tutor.welcomeHint}</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Quick suggestion pills above input */}
        <div style={{
          position: 'fixed', bottom: bp === 'desktop' ? 88 : 148, left: 0, right: 0,
          padding: '0 var(--content-padding)',
          pointerEvents: 'none',
        }}>
          <div style={{
            maxWidth: 'var(--content-max-width)', margin: '0 auto',
            display: 'flex', gap: 6, overflowX: 'auto',
            paddingBottom: 8, WebkitOverflowScrolling: 'touch' as never,
            pointerEvents: 'auto',
          }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={s.onClick} style={{
                flexShrink: 0,
                padding: '7px 12px', borderRadius: R.pill,
                background: 'var(--bg-card)',
                border: '1.5px solid var(--ink)',
                boxShadow: '0 2px 0 0 rgba(15,15,16,0.15)',
                fontFamily: FF.body, fontSize: 12, fontWeight: 700,
                color: 'var(--text)', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div style={{
          position: 'fixed', bottom: bp === 'desktop' ? 20 : 80, left: 0, right: 0,
          padding: '8px var(--content-padding) 10px',
          background: 'var(--bg)', borderTop: '2px solid var(--ink)',
        }}>
          <div style={{ display: 'flex', gap: 6, maxWidth: 'var(--content-max-width)', margin: '0 auto', alignItems: 'flex-end' }}>
            {'webkitSpeechRecognition' in window && (
              <button onClick={handleVoice} aria-label={t.tutor.micLabel} aria-pressed={recording} style={iconBtnStyle(recording ? COLORS.streakSoft : 'var(--bg-card)', recording ? COLORS.streak : 'var(--text-muted)', recording)}>
                {recording ? <MicOff size={17} strokeWidth={2.4} /> : <Mic size={17} strokeWidth={2.4} />}
              </button>
            )}
            <button onClick={handleCameraClick} style={iconBtnStyle('var(--bg-card)', 'var(--text-muted)')} aria-label={t.tutor.cameraLabel}>
              <Camera size={17} strokeWidth={2.4} />
              {!isPremium && <span style={proDotStyle} />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              enterKeyHint="send"
              inputMode="text"
              placeholder={t.tutor.inputPlaceholderAny}
              rows={1}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 12,
                background: 'var(--bg-card)',
                border: '2px solid var(--ink)',
                color: 'var(--text)',
                fontFamily: FF.body,
                fontSize: 14, fontWeight: 600, resize: 'none',
                lineHeight: 1.4,
              }}
            />
            <button onClick={() => handleSend()} disabled={!input.trim()} aria-label={t.tutor.sendLabel} style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: input.trim()
                ? `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`
                : 'var(--bg-subtle)',
              border: `2px solid ${input.trim() ? 'var(--ink)' : 'rgba(15,15,16,0.12)'}`,
              boxShadow: input.trim() ? '0 3px 0 0 var(--ink)' : 'none',
              color: input.trim() ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Send size={17} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={handlePhotoPick} style={{ display: 'none' }} />
        {paywallEl}
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
        <BackButton onClick={() => setShowSubjectPicker(false)} style={{ marginBottom: 14 }} />
        <div style={{
          fontFamily: FF.display, fontSize: 22, fontWeight: 900,
          color: 'var(--text)', letterSpacing: '-0.035em', margin: '0 0 6px',
          lineHeight: 1.1,
        }}>{t.tutor.pickerTitle}</div>
        <div style={{
          fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
          color: 'var(--text-secondary)', margin: '0 0 18px',
        }}>{t.tutor.pickerSubtitle}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allSubs.map(s => {
            const topics = TOPIC_MAP[s.id];
            if (!topics) return null;
            const isOpen = pickerExpanded === s.id;
            const subName = (t.subjects as Record<string, string>)[s.id] || s.name;
            return (
              <div key={s.id} style={{
                background: 'var(--bg-card)',
                border: '2px solid var(--ink)',
                borderRadius: 12,
                boxShadow: '0 3px 0 0 var(--ink)',
                overflow: 'hidden',
              }}>
                <button onClick={() => setPickerExpanded(isOpen ? null : s.id)} style={{
                  width: '100%', padding: '12px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 11,
                  background: 'transparent', border: 'none', textAlign: 'left',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: R.sm,
                    background: `${s.color}18`, border: `1.5px solid ${s.color}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <SubjectIcon sid={s.id} size={17} color={s.color} strokeWidth={2.2} />
                  </div>
                  <span style={{
                    flex: 1,
                    fontFamily: FF.body, fontSize: FS.lg, fontWeight: 800,
                    color: 'var(--text)',
                  }}>{subName}</span>
                  <ChevronRight size={15} color="var(--text-muted)" strokeWidth={2.4} style={{
                    transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                  }} />
                </button>
                {isOpen && (
                  <div style={{
                    borderTop: '1.5px solid rgba(15,15,16,0.1)',
                    background: 'var(--bg-subtle)',
                    maxHeight: 320, overflowY: 'auto',
                  }}>
                    {topics.map(tp => (
                      <React.Fragment key={tp.id}>
                        {(tp.subtopics || []).map(st => (
                          <button key={st.id} onClick={() => handleTopicSelect(s.id, st.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '11px 14px',
                            background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(15,15,16,0.06)',
                            textAlign: 'left', cursor: 'pointer',
                            fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
                            color: 'var(--text)',
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: s.color, flexShrink: 0,
                            }} />
                            <span style={{ flex: 1 }}>{isKk && st.name_kk ? st.name_kk : st.name}</span>
                            <ChevronRight size={13} color="var(--text-muted)" strokeWidth={2.2} />
                          </button>
                        ))}
                        {(!tp.subtopics || tp.subtopics.length === 0) && (
                          <button onClick={() => handleTopicSelect(s.id, tp.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '11px 14px',
                            background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(15,15,16,0.06)',
                            textAlign: 'left', cursor: 'pointer',
                            fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
                            color: 'var(--text)',
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: s.color, flexShrink: 0,
                            }} />
                            <span style={{ flex: 1 }}>{isKk && tp.name_kk ? tp.name_kk : tp.name}</span>
                            <ChevronRight size={13} color="var(--text-muted)" strokeWidth={2.2} />
                          </button>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {paywallEl}
      </div>
    );
  }

  // ── Chat View ──
  return (
    <div style={{ padding: `0 var(--content-padding) ${padBottom + 70}px` }}>
      {/* v2 Chat header — Д avatar + status + back + support toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 14, padding: '10px 0',
        borderBottom: '1.5px solid rgba(15,15,16,0.1)',
      }}>
        <BackButton onClick={goHome} />
        <div style={{
          position: 'relative',
          width: 38, height: 38, borderRadius: R.md,
          background: COLORS.streak,
          border: `2px solid ${COLORS.xp}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: FF.brand,
          fontWeight: 900, fontSize: FS.xl, letterSpacing: '-0.04em',
          flexShrink: 0,
        }}>
          Д
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: COLORS.win,
            border: '2px solid var(--bg)',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FF.display, fontSize: 13, fontWeight: 900,
            color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>{t.tutor.name}</div>
          <div style={{
            fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: COLORS.win, marginTop: 1,
          }}>{t.tutor.online} · {isPremium ? 'PRO' : getTutorRemaining() + '/' + 10}</div>
        </div>
        <button onClick={() => setShowSupport(s => !s)} aria-label={t.tutor.supportTitle} aria-pressed={showSupport} style={{
          width: 34, height: 34, borderRadius: R.md,
          background: showSupport ? 'rgba(236,72,153,0.12)' : 'transparent',
          border: showSupport ? '1.5px solid rgba(236,72,153,0.35)' : '1.5px solid rgba(15,15,16,0.12)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: showSupport ? '#ec4899' : 'var(--text-muted)',
          flexShrink: 0,
        }}>
          <Heart size={15} fill={showSupport ? '#ec4899' : 'none'} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {/* Support banner — v2 ink-bordered style */}
      {showSupport && (
        <div style={{
          padding: '14px 14px', marginBottom: 14,
          background: 'rgba(236,72,153,0.06)',
          border: '2px solid var(--ink)',
          borderRadius: R.lg,
          boxShadow: '0 3px 0 0 var(--ink)',
          animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{
            fontFamily: FF.display, fontSize: 11, fontWeight: 900,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#ec4899', marginBottom: 6,
          }}>💜 {t.tutor.supportTitle}</div>
          <div style={{
            fontFamily: FF.body, fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5,
          }}>
            {t.tutor.supportText}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: R.md,
            background: 'var(--ink)',
            fontFamily: FF.mono, fontSize: 13, fontWeight: 800,
            color: '#fff', textAlign: 'center', letterSpacing: '0.04em',
          }}>
            Kaspi · 8 705 234 0280
          </div>
        </div>
      )}

      {/* Messages — role=log + aria-live so screen readers announce new replies */}
      <div role="log" aria-live="polite" aria-label={t.tutor.conversationLabel}>
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const showAvatar = !isUser && (i === 0 || messages[i - 1]?.role !== 'assistant');
        return (
          <div key={i} style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            gap: 6,
            marginBottom: 10,
            animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            {!isUser && (
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: showAvatar ? COLORS.streak : 'transparent',
                border: showAvatar ? '1.5px solid var(--ink)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: showAvatar ? '#fff' : 'transparent',
                fontFamily: FF.brand,
                fontWeight: 900, fontSize: 12, letterSpacing: '-0.04em',
                flexShrink: 0, marginBottom: 2,
              }}>
                {showAvatar ? 'Д' : ''}
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 16,
              background: isUser
                ? `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`
                : 'var(--bg-card)',
              border: '2px solid var(--ink)',
              boxShadow: isUser ? '0 2px 0 0 var(--ink)' : '0 2px 0 0 var(--ink)',
              color: isUser ? '#fff' : 'var(--text)',
              fontFamily: FF.body,
              fontSize: FS.lg, lineHeight: 1.55, whiteSpace: 'pre-wrap', fontWeight: 600,
              borderBottomRightRadius: isUser ? 6 : 16,
              borderBottomLeftRadius: isUser ? 16 : 6,
              wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' && msg.content === '⏳' ? (
                <div style={{ display: 'flex', gap: 4, padding: '4px 2px', alignItems: 'center' }}>
                  {[0, 1, 2].map(di => (
                    <div key={di} style={{
                      width: 7, height: 7, borderRadius: 4,
                      background: COLORS.streak,
                      animation: `pulse 1.2s ease-in-out ${di * 0.2}s infinite`,
                      opacity: 0.7,
                    }} />
                  ))}
                </div>
              ) : msg.role === 'assistant' ? renderBold(msg.content) : renderUserContent(msg, t.tutor.imageAlt)}
            </div>
          </div>
        );
      })}

      {/* Loading indicator (hide if placeholder already showing) */}
      {loading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: COLORS.streak, border: '1.5px solid var(--ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: FF.brand,
            fontWeight: 900, fontSize: 12, letterSpacing: '-0.04em',
            flexShrink: 0, marginBottom: 2,
          }}>Д</div>
          <div style={{
            padding: '10px 14px', borderRadius: 16, borderBottomLeftRadius: R.sm,
            background: 'var(--bg-card)', border: '2px solid var(--ink)',
            boxShadow: '0 2px 0 0 var(--ink)',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(di => (
                <div key={di} style={{
                  width: 7, height: 7, borderRadius: 4,
                  background: COLORS.streak,
                  animation: `pulse 1.2s ease-in-out ${di * 0.2}s infinite`,
                  opacity: 0.7,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
      </div>

      {/* v2 Input bar — ink border, streak gradient send, mic with streak on active */}
      <div style={{
        position: 'fixed', bottom: bp === 'desktop' ? 20 : 70, left: 0, right: 0,
        padding: '10px var(--content-padding) 12px',
        background: 'var(--bg)',
        borderTop: '2px solid var(--ink)',
      }}>
        <div style={{ display: 'flex', gap: 6, maxWidth: 'var(--content-max-width)', margin: '0 auto', alignItems: 'flex-end' }}>
          {/* Voice button */}
          {'webkitSpeechRecognition' in window && (
            <button onClick={handleVoice} aria-label={t.tutor.micLabel} aria-pressed={recording} style={iconBtnStyle(recording ? COLORS.streakSoft : 'var(--bg-card)', recording ? COLORS.streak : 'var(--text-muted)', recording)}>
              {recording ? <MicOff size={17} strokeWidth={2.4} /> : <Mic size={17} strokeWidth={2.4} />}
            </button>
          )}

          {/* Camera button (premium) */}
          <button onClick={handleCameraClick} style={iconBtnStyle('var(--bg-card)', 'var(--text-muted)')} aria-label={t.tutor.cameraLabel}>
            <Camera size={17} strokeWidth={2.4} />
            {!isPremium && <span style={proDotStyle} />}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onBeforeInput={e => { if ((e as unknown as { inputType: string }).inputType === 'insertLineBreak') { e.preventDefault(); handleSend(); } }}
            enterKeyHint="send"
            inputMode="text"
            placeholder={isPremium ? t.tutor.inputPlaceholder : t.tutor.inputPlaceholderLimit.replace('{n}', String(getTutorRemaining()))}
            rows={1}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 12,
              background: 'var(--bg-card)',
              border: '2px solid var(--ink)',
              color: 'var(--text)',
              fontFamily: FF.body,
              fontSize: 14, fontWeight: 600, resize: 'none',
              lineHeight: 1.4,
              maxHeight: 100,
            }}
          />

          <button onClick={() => handleSend()} disabled={!input.trim() || loading} aria-label={t.tutor.sendLabel} style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: input.trim() && !loading
              ? `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`
              : 'var(--bg-subtle)',
            border: `2px solid ${input.trim() && !loading ? 'var(--ink)' : 'rgba(15,15,16,0.12)'}`,
            boxShadow: input.trim() && !loading ? '0 3px 0 0 var(--ink)' : 'none',
            color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Send size={17} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={handlePhotoPick} style={{ display: 'none' }} />
      {paywallEl}
    </div>
  );
}

function iconBtnStyle(bg: string, color: string, pulsing = false): React.CSSProperties {
  return {
    position: 'relative',
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: bg,
    border: '2px solid var(--ink)',
    boxShadow: '0 2px 0 0 var(--ink)',
    color,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: pulsing ? 'pulse 1s ease-in-out infinite' : 'none',
  };
}

const proDotStyle: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2,
  width: 10, height: 10, borderRadius: '50%',
  background: '#FFC233',
  border: '1.5px solid var(--ink)',
};

// Downscale a picked image to a max edge + JPEG before sending — bounds vision
// token cost and request size, and normalizes HEIC/PNG/WebP to JPEG. Falls back to
// the raw data URL if the browser can't decode it (e.g. HEIC on desktop).
async function downscaleImage(file: File, maxEdge = 1024, quality = 0.8): Promise<string> {
  const raw = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => resolve('');
    r.readAsDataURL(file);
  });
  if (!raw) return '';
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = raw;
    });
    const longest = Math.max(img.width, img.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    if (scale === 1 && file.size < 400 * 1024) return raw; // already small enough
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return raw; // browser couldn't decode — send original, backend caps/strips it
  }
}

// Renders a user message — text plus any attached image thumbnails (vision)
function renderUserContent(msg: TutorMessage, imageAlt: string): React.ReactNode {
  if (msg.images && msg.images.length) {
    return (
      <>
        {msg.content && <div style={{ marginBottom: 8 }}>{msg.content}</div>}
        {msg.images.map((src, i) => (
          <img key={i} src={src} alt={imageAlt} style={{
            display: 'block', maxWidth: '100%', borderRadius: R.md,
            border: '1.5px solid rgba(255,255,255,0.35)',
          }} />
        ))}
      </>
    );
  }
  return msg.content;
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

