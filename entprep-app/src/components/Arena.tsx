import { useState, useEffect, useRef, useCallback } from 'react';
import { CARD_COMPACT, TYPE, COLORS } from '../constants/styles';
import { SUBJECT_META } from '../config/subjects';
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { useApp } from '../contexts/AppContext';
import { shareToWhatsApp, shareToTelegram, copyText } from '../utils/shareHelpers';
import {
  createArena, joinArena, startArena, submitArenaAnswer,
  checkAdvance, getArenaState, subscribeToArena,
  buildArenaInviteUrl, parseArenaInviteParam,
} from '../utils/arenaHelpers';
import type { ArenaPlayer } from '../utils/arenaHelpers';
import type { DuelQuestion } from '../types/index';
import { trackEvent } from '../utils/analytics';
import BackButton from './ui/BackButton';
import LoadingSpinner from './ui/LoadingSpinner';
import SubjectIcon from './ui/SubjectIcon';
import {
  Users, Copy, MessageCircle, Send, ChevronRight,
  Crown, Clock, Zap, Trophy, Play, RotateCcw,
} from 'lucide-react';

type Phase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'leaderboard' | 'results';

const QUESTION_TIME = 30;
const LEADERBOARD_TIME = 3;
const VALID_COUNTS = [5, 10, 15];

const ALL_SUBJECTS = [
  ...Object.values(SUBS).map(s => ({ id: s.id, name: s.name, icon: s.icon, color: s.color })),
  ...ALL_PROFILES.map(p => ({ id: p.id, name: p.name, icon: p.icon, color: p.color })),
];

export default function Arena() {
  const { goHome } = useNav();
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();
  const { st } = useApp();
  const bp = useBreakpoint();
  const isKk = st.lang === 'kk';

  const [phase, setPhase] = useState<Phase>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Arena state
  const [arenaId, setArenaId] = useState<number | null>(null);
  const [arenaCode, setArenaCode] = useState('');
  const [subject, setSubject] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [isHost, setIsHost] = useState(false);
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [players, setPlayers] = useState<ArenaPlayer[]>([]);
  const [leaderboard, setLeaderboard] = useState<ArenaPlayer[]>([]);

  // Playing state
  const [currentQ, setCurrentQ] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timer, setTimer] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctIdx: number; points: number; speedBonus: number } | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [streak, setStreak] = useState(0);

  // Countdown
  const [countdownNum, setCountdownNum] = useState(3);

  // Join code input
  const [joinCode, setJoinCode] = useState('');
  const [menuTab, setMenuTab] = useState<'create' | 'join'>('create');

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const unsubRef = useRef<(() => void) | null>(null);
  const submittingRef = useRef(false);

  // Check for ?arena=CODE
  useEffect(() => {
    const code = parseArenaInviteParam();
    if (code) { setJoinCode(code.toUpperCase()); setMenuTab('join'); }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // ── Realtime handler ──
  const handleStatusChange = useCallback((status: string) => {
    if (status.startsWith('question_')) {
      const qi = parseInt(status.split('_')[1]);
      setCurrentQ(qi);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setTimer(QUESTION_TIME);
      setAnsweredCount(0);
      setPhase('playing');
    } else if (status.startsWith('leaderboard_')) {
      // Fetch leaderboard
      if (arenaId) {
        checkAdvance(arenaId).then(res => {
          if (res.leaderboard) setLeaderboard(res.leaderboard);
        }).catch(() => {});
      }
      setPhase('leaderboard');
    } else if (status === 'finished') {
      if (arenaId) {
        checkAdvance(arenaId).then(res => {
          if (res.leaderboard) setLeaderboard(res.leaderboard);
        }).catch(() => {});
      }
      setPhase('results');
    }
  }, [arenaId]);

  // ── Create Arena ──
  const handleCreate = async (subjectId: string) => {
    if (!user) { toast.error(isKk ? 'Кіру қажет' : 'Войдите в аккаунт'); return; }
    setLoading(true); setError('');
    try {
      const result = await createArena(subjectId, questionCount);
      setArenaId(result.arena_id);
      setArenaCode(result.code);
      setSubject(subjectId);
      setQuestions(result.questions);
      setIsHost(true);
      setPlayers([{ user_id: user.id, nickname: null, avatar_url: null, score: 0 }]);
      unsubRef.current = subscribeToArena(result.arena_id, handleStatusChange);
      // Poll for new players in lobby
      pollRef.current = setInterval(async () => {
        try {
          const state = await getArenaState(result.arena_id);
          setPlayers(state.players);
        } catch {}
      }, 5000);
      setPhase('lobby');
      trackEvent('Arena Created', { subject: subjectId, questionCount });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
    setLoading(false);
  };

  // ── Join Arena ──
  const handleJoin = async () => {
    if (!user) { toast.error(isKk ? 'Кіру қажет' : 'Войдите в аккаунт'); return; }
    if (joinCode.length !== 6) { setError('Код должен быть 6 символов'); return; }
    setLoading(true); setError('');
    try {
      const result = await joinArena(joinCode);
      setArenaId(result.arena_id);
      setArenaCode(result.code);
      setSubject(result.subject);
      setQuestions(result.questions);
      setIsHost(result.host_id === user.id);
      setPlayers(result.players);
      setQuestionCount(result.question_count);
      unsubRef.current = subscribeToArena(result.arena_id, handleStatusChange);
      // Poll for new players
      pollRef.current = setInterval(async () => {
        try {
          const state = await getArenaState(result.arena_id);
          setPlayers(state.players);
          if (state.arena.status !== 'lobby') {
            handleStatusChange(state.arena.status);
          }
        } catch {}
      }, 5000);
      setPhase('lobby');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
    setLoading(false);
  };

  // ── Start (host only) ──
  const handleStart = async () => {
    if (!arenaId) return;
    try {
      await startArena(arenaId);
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase('countdown');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  // ── Countdown → Playing ──
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdownNum(3);
    const id = setInterval(() => {
      setCountdownNum(prev => {
        if (prev <= 1) { clearInterval(id); setPhase('playing'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Question timer ──
  useEffect(() => {
    if (phase !== 'playing') return;
    setTimer(QUESTION_TIME);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!answerResult && !submittingRef.current) handleSubmit(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll for advance during playing ──
  useEffect(() => {
    if (phase !== 'playing' || !arenaId) return;
    const interval = setInterval(async () => {
      try {
        const res = await checkAdvance(arenaId);
        if (res.answered != null) setAnsweredCount(res.answered);
        if (res.status !== `question_${currentQ}`) {
          handleStatusChange(res.status);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [phase, arenaId, currentQ, handleStatusChange]);

  // ── Leaderboard auto-advance ──
  useEffect(() => {
    if (phase !== 'leaderboard' || !arenaId) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await checkAdvance(arenaId);
        handleStatusChange(res.status);
      } catch {}
    }, LEADERBOARD_TIME * 1000);
    return () => clearTimeout(timeout);
  }, [phase, arenaId, handleStatusChange]);

  // ── Submit answer ──
  const handleSubmit = async (answer: number | null) => {
    if (!arenaId || submittingRef.current) return;
    submittingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedAnswer(answer);

    try {
      const result = await submitArenaAnswer(arenaId, currentQ, answer);
      setAnswerResult({
        correct: result.correct, correctIdx: result.correct_answer,
        points: result.points, speedBonus: result.speed_bonus,
      });
      setMyScore(result.your_score);

      if (navigator.vibrate) {
        navigator.vibrate(result.correct ? [30] : [50, 30, 50]);
      }

      if (result.correct) {
        setStreak(prev => prev + 1);
      } else {
        setStreak(0);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
    submittingRef.current = false;
  };

  const meta = SUBJECT_META[subject];
  const inviteUrl = buildArenaInviteUrl(arenaCode);
  const inviteText = `${isKk ? 'Ареная қосыл!' : 'Заходи в арену!'} ${meta?.name || subject}\n${isKk ? 'Код' : 'Код'}: ${arenaCode}\n${inviteUrl}`;
  const padBottom = bp === 'desktop' ? 40 : 100;

  // ── MENU ──
  if (phase === 'menu') {
    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px` }}>
        <BackButton onClick={goHome} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ ...TYPE.h2, margin: 0 }}>{isKk ? 'Арена' : 'Арена'}</h1>
            <p style={{ ...TYPE.caption, margin: '2px 0 0' }}>{isKk ? 'Сыныптасыңмен жарыс' : 'Соревнуйся с классом'}</p>
          </div>
        </div>

        {/* Create / Join tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['create', 'join'] as const).map(mt => (
            <button key={mt} onClick={() => { setMenuTab(mt); setError(''); }} style={{
              flex: 1, padding: '10px 16px',
              background: menuTab === mt ? 'linear-gradient(135deg, #8b5cf6, #a855f7)' : 'var(--bg-card)',
              border: menuTab === mt ? 'none' : '1px solid var(--border)',
              borderRadius: 14, color: menuTab === mt ? '#fff' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: menuTab === mt ? 700 : 600,
              cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
            }}>
              {mt === 'create' ? (isKk ? 'Құру' : 'Создать') : (isKk ? 'Қосылу' : 'Войти')}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ ...CARD_COMPACT, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', marginBottom: 10, fontSize: 12, color: COLORS.red }}>
            {error}
          </div>
        )}

        {loading && <LoadingSpinner />}

        {!loading && menuTab === 'create' && (
          <>
            {/* Question count selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {VALID_COUNTS.map(n => (
                <button key={n} onClick={() => setQuestionCount(n)} style={{
                  flex: 1, padding: '8px', borderRadius: 10,
                  background: questionCount === n ? 'rgba(139,92,246,0.12)' : 'var(--bg-card)',
                  border: questionCount === n ? '1.5px solid rgba(139,92,246,0.4)' : '1px solid var(--border)',
                  color: questionCount === n ? '#8b5cf6' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  {n} {isKk ? 'сұрақ' : 'вопр.'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
              {isKk ? 'Пәнді таңдаңыз' : 'Выберите предмет'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 6 }}>
              {ALL_SUBJECTS.map(s => (
                <button key={s.id} onClick={() => handleCreate(s.id)} style={{
                  ...CARD_COMPACT, display: 'flex', alignItems: 'center',
                  borderLeft: `3px solid ${s.color}`, padding: '13px 14px',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10 }}>
                    <SubjectIcon sid={s.id} size={18} color={s.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                    {(t.subjects as Record<string, string>)[s.id] || s.name}
                  </span>
                  <ChevronRight size={16} color={s.color} />
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && menuTab === 'join' && (
          <div style={{ maxWidth: 360, margin: '20px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              {isKk ? 'Кодты енгізіңіз' : 'Введите код арены'}
            </div>
            <input
              type="text" value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError(''); }}
              placeholder="ABCDEF" maxLength={6}
              style={{
                width: '100%', padding: '16px', textAlign: 'center',
                background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                borderRadius: 14, color: 'var(--text)', fontSize: 24,
                fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                letterSpacing: 6, boxSizing: 'border-box',
              }}
            />
            <button onClick={handleJoin} disabled={joinCode.length !== 6} style={{
              width: '100%', padding: '14px', marginTop: 12,
              background: joinCode.length === 6 ? 'linear-gradient(135deg, #8b5cf6, #a855f7)' : 'var(--bg-subtle-2)',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: joinCode.length === 6 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Users size={18} />{isKk ? 'Қосылу' : 'Войти'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── LOBBY ──
  if (phase === 'lobby') {
    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px` }}>
        <BackButton onClick={goHome} />
        <div style={{ maxWidth: 400, margin: '20px auto', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={32} color="#fff" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {(t.subjects as Record<string, string>)[subject] || subject} • {questionCount} {isKk ? 'сұрақ' : 'вопр.'}
          </div>

          {/* Code */}
          <div style={{ padding: '20px', background: 'var(--bg-card)', border: '2px dashed rgba(139,92,246,0.3)', borderRadius: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 8, color: 'var(--text)' }}>
              {arenaCode}
            </div>
          </div>

          {/* Share */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => shareToWhatsApp(inviteText)} style={{ flex: 1, padding: '10px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, color: '#25D366', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <MessageCircle size={15} />WhatsApp
            </button>
            <button onClick={() => shareToTelegram(inviteText)} style={{ flex: 1, padding: '10px', background: 'rgba(42,171,238,0.1)', border: '1px solid rgba(42,171,238,0.2)', borderRadius: 10, color: '#2AABEE', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Send size={15} />Telegram
            </button>
            <button onClick={async () => { const ok = await copyText(inviteUrl); toast.success(ok ? 'Скопировано!' : 'Error'); }} style={{ flex: 1, padding: '10px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, color: '#8b5cf6', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={15} />{isKk ? 'Көшіру' : 'Копия'}
            </button>
          </div>

          {/* Player list */}
          <div style={{ ...CARD_COMPACT, padding: '12px', marginBottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isKk ? 'Ойыншылар' : 'Игроки'} ({players.length})
            </div>
            {players.map((p, i) => (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                {p.avatar_url
                  ? <img src={p.avatar_url} style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {(p.nickname || '?').slice(0, 2).toUpperCase()}
                    </div>
                }
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                  {p.nickname || (isKk ? 'Ойыншы' : 'Игрок')}
                </span>
                {i === 0 && <Crown size={14} color="#8b5cf6" />}
              </div>
            ))}
          </div>

          {/* Start button (host only) */}
          {isHost && (
            <button onClick={handleStart} disabled={players.length < 2} style={{
              width: '100%', padding: '16px',
              background: players.length >= 2 ? 'linear-gradient(135deg, #8b5cf6, #a855f7)' : 'var(--bg-subtle-2)',
              border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: players.length >= 2 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: players.length >= 2 ? '0 4px 20px rgba(139,92,246,0.3)' : 'none',
              animation: players.length >= 2 ? 'rematchPulse 2s ease-in-out infinite' : 'none',
            }}>
              <Play size={20} />{isKk ? 'Бастау' : 'Старт'} ({players.length} {isKk ? 'ойыншы' : 'игр.'})
            </button>
          )}
          {!isHost && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', padding: '16px 0' }}>
              <div style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }}><Clock size={14} /></div>
              <span style={{ fontSize: 12 }}>{isKk ? 'Хост бастағанын күтіңіз' : 'Ждём хоста...'}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── COUNTDOWN ──
  if (phase === 'countdown') {
    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{
          fontSize: 72, fontWeight: 900, fontFamily: "'Unbounded',sans-serif",
          background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          animation: 'firePulse 1s ease-in-out infinite',
        }}>
          {countdownNum > 0 ? countdownNum : 'GO!'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12 }}>
          {players.length} {isKk ? 'ойыншы' : 'игроков'} • {(t.subjects as Record<string, string>)[subject] || subject}
        </div>
      </div>
    );
  }

  // ── PLAYING ──
  if (phase === 'playing') {
    const q = questions[currentQ];
    if (!q) return <LoadingSpinner />;

    const timerColor = timer <= 5 ? COLORS.red : timer <= 10 ? COLORS.amber : 'var(--text)';

    return (
      <div style={{ padding: `0 var(--content-padding) 20px` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={16} color="#8b5cf6" />
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: '#8b5cf6' }}>
              {myScore}
            </div>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: `3px solid ${timerColor}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: timer <= 5 ? 'rgba(239,68,68,0.08)' : 'transparent',
            position: 'relative',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: timerColor, lineHeight: 1 }}>
              {timer}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
              {currentQ + 1}/{questionCount}
            </div>
            {streak >= 3 && <div style={{ position: 'absolute', top: -8, right: -8, fontSize: 16, animation: 'firePulse 0.6s ease-in-out infinite' }}>🔥</div>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {answeredCount}/{players.length} {isKk ? 'жауап' : 'отв.'}
          </div>
        </div>

        {/* Speed bonus hint */}
        {answerResult && answerResult.speedBonus > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.amber, marginBottom: 6, animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            ⚡ +{answerResult.speedBonus} {isKk ? 'жылдамдық бонусы' : 'бонус за скорость'}
          </div>
        )}

        {/* Timer bar */}
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-secondary)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{
            width: `${(timer / QUESTION_TIME) * 100}%`, height: '100%', borderRadius: 2,
            background: timer <= 5 ? COLORS.red : timer <= 10 ? COLORS.amber : 'linear-gradient(90deg, #8b5cf6, #a855f7)',
            transition: 'width 1s linear',
          }} />
        </div>

        {/* Question */}
        <div style={{ ...CARD_COMPACT, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6 }}>{q.q}</div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.o.map((opt, i) => {
            let bg = 'var(--bg-card)';
            let border = '1px solid var(--border)';
            let color = 'var(--text)';

            if (answerResult) {
              if (i === answerResult.correctIdx) {
                bg = 'rgba(34,197,94,0.12)'; border = `1.5px solid ${COLORS.green}`; color = COLORS.green;
              } else if (i === selectedAnswer && !answerResult.correct) {
                bg = 'rgba(239,68,68,0.12)'; border = `1.5px solid ${COLORS.red}`; color = COLORS.red;
              }
            } else if (i === selectedAnswer) {
              bg = 'rgba(139,92,246,0.1)'; border = '1.5px solid #8b5cf6';
            }

            return (
              <button key={i}
                onClick={() => !answerResult && !submittingRef.current && handleSubmit(i)}
                disabled={!!answerResult || submittingRef.current}
                style={{
                  padding: '14px 16px', background: bg, border, borderRadius: 12,
                  color, fontSize: 13, fontWeight: 500, cursor: answerResult ? 'default' : 'pointer',
                  textAlign: 'left', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                  background: answerResult && i === answerResult.correctIdx ? COLORS.green : 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
                  color: answerResult && i === answerResult.correctIdx ? '#fff' : 'var(--text-secondary)',
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── LEADERBOARD (between questions) ──
  if (phase === 'leaderboard') {
    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px`, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6', marginBottom: 4, marginTop: 20, fontFamily: "'Unbounded',sans-serif" }}>
          {isKk ? 'РЕЙТИНГ' : 'РЕЙТИНГ'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          {isKk ? `${currentQ + 1}/${questionCount} сұрақтан кейін` : `После ${currentQ + 1}/${questionCount} вопроса`}
        </div>

        <div style={{ maxWidth: 360, margin: '0 auto' }}>
          {leaderboard.map((p, i) => {
            const isMe = p.user_id === user?.id;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div key={p.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 4,
                background: isMe ? 'rgba(139,92,246,0.1)' : 'var(--bg-card)',
                border: isMe ? '1.5px solid rgba(139,92,246,0.3)' : '1px solid var(--border)',
                borderRadius: 12, animation: `slideUp 0.3s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-muted)', width: 24 }}>
                  {medal || `${i + 1}.`}
                </span>
                {p.avatar_url
                  ? <img src={p.avatar_url} style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 8, background: isMe ? 'linear-gradient(135deg, #8b5cf6, #a855f7)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isMe ? '#fff' : 'var(--text-muted)' }}>
                      {(p.nickname || '?').slice(0, 2).toUpperCase()}
                    </div>
                }
                <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 500, color: 'var(--text)', textAlign: 'left' }}>
                  {p.nickname || (isMe ? (isKk ? 'Сен' : 'Ты') : (isKk ? 'Ойыншы' : 'Игрок'))}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? COLORS.amber : 'var(--text)' }}>
                  {p.score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  if (phase === 'results') {
    const myPlace = leaderboard.findIndex(p => p.user_id === user?.id) + 1;
    const top3 = leaderboard.slice(0, 3);
    const isWinner = myPlace === 1;

    return (
      <div style={{ padding: `0 var(--content-padding) ${padBottom}px`, textAlign: 'center' }}>
        {/* Confetti */}
        {isWinner && (
          <div style={{ position: 'relative', height: 0 }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: 6 + (i % 3) * 3, height: 6 + (i % 2) * 4,
                borderRadius: i % 2 === 0 ? '50%' : 2,
                background: ['#8b5cf6', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#ef4444'][i % 6],
                left: `${10 + (i * 3.5)}%`, top: 0,
                animation: `confettiFall ${1.5 + (i % 5) * 0.3}s ease-out forwards`,
                animationDelay: `${i * 0.05}s`, opacity: 0,
              }} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, marginBottom: 20 }}>
          <Trophy size={40} color="#8b5cf6" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Unbounded',sans-serif", color: '#8b5cf6' }}>
            {isKk ? 'НӘТИЖЕЛЕР' : 'РЕЗУЛЬТАТЫ'}
          </div>
        </div>

        {/* Podium */}
        {top3.length >= 3 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24, height: 140 }}>
            {/* 2nd place */}
            <div style={{ textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
              {top3[1].avatar_url
                ? <img src={top3[1].avatar_url} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', display: 'block', margin: '0 auto 4px' }} />
                : <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '0 auto 4px' }}>{(top3[1].nickname || '?').slice(0, 2).toUpperCase()}</div>
              }
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>{top3[1].nickname || (isKk ? 'Ойыншы' : 'Игрок')}</div>
              <div style={{ width: 70, height: 80, borderRadius: '10px 10px 0 0', background: 'rgba(192,192,192,0.15)', border: '1px solid rgba(192,192,192,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>🥈</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text)' }}>{top3[1].score}</div>
              </div>
            </div>
            {/* 1st place */}
            <div style={{ textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
              {top3[0].avatar_url
                ? <img src={top3[0].avatar_url} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', display: 'block', margin: '0 auto 4px' }} />
                : <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 auto 4px' }}>{(top3[0].nickname || '?').slice(0, 2).toUpperCase()}</div>
              }
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>{top3[0].nickname || (isKk ? 'Ойыншы' : 'Игрок')}</div>
              <div style={{ width: 70, height: 110, borderRadius: '10px 10px 0 0', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>🥇</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: COLORS.amber }}>{top3[0].score}</div>
              </div>
            </div>
            {/* 3rd place */}
            <div style={{ textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
              {top3[2].avatar_url
                ? <img src={top3[2].avatar_url} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', display: 'block', margin: '0 auto 4px' }} />
                : <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '0 auto 4px' }}>{(top3[2].nickname || '?').slice(0, 2).toUpperCase()}</div>
              }
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>{top3[2].nickname || (isKk ? 'Ойыншы' : 'Игрок')}</div>
              <div style={{ width: 70, height: 60, borderRadius: '10px 10px 0 0', background: 'rgba(205,127,50,0.12)', border: '1px solid rgba(205,127,50,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>🥉</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text)' }}>{top3[2].score}</div>
              </div>
            </div>
          </div>
        )}

        {/* Your place */}
        <div style={{ ...CARD_COMPACT, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{isKk ? 'Сенің орның' : 'Твоё место'}:</span>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: '#8b5cf6' }}>
            {myPlace}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isKk ? `/${leaderboard.length}` : `из ${leaderboard.length}`}</span>
        </div>

        {/* Full leaderboard */}
        <div style={{ ...CARD_COMPACT, padding: '12px', marginBottom: 16, maxHeight: 200, overflowY: 'auto', textAlign: 'left' }}>
          {leaderboard.map((p, i) => {
            const isMe = p.user_id === user?.id;
            return (
              <div key={p.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                background: isMe ? 'rgba(139,92,246,0.06)' : 'transparent',
                borderRadius: isMe ? 6 : 0,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 20 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 700 : 500, color: 'var(--text)' }}>
                  {p.nickname || (isMe ? (isKk ? 'Сен' : 'Ты') : (isKk ? 'Ойыншы' : 'Игрок'))}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? COLORS.amber : 'var(--text)' }}>{p.score}</span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { if (subject) handleCreate(subject); }} style={{
            flex: 1, padding: '14px', background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
            border: 'none', borderRadius: 14, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            animation: 'rematchPulse 2s ease-in-out infinite',
          }}>
            <RotateCcw size={16} />{isKk ? 'Қайта' : 'Ещё раз'}
          </button>
          <button onClick={goHome} style={{
            flex: 1, padding: '14px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {isKk ? 'Басты бет' : 'Домой'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
