import React, { useState, useEffect, useCallback } from 'react';
import { CARD, CARD_COMPACT, COLORS, TINT, TYPE, SECTION_LABEL, scoreColor, SP, R, FS, FW } from '../constants/styles';
import { SUBJECT_META } from '../config/subjects';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config/app';
import { supabase } from '../config/supabase';
import { ArrowLeft, Users, Copy, Check, BookOpen, TrendingUp, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import Button from './ui/Button';

interface StudentData {
  id: string;
  nickname: string;
  avatar_url?: string;
  xp: number;
  level: number;
  streak: number;
  joined_at: string;
  totalTests: number;
  totalCorrect: number;
  totalQuestions: number;
  avgScore: number;
  lastActive: string | null;
  bySubject: Record<string, { tests: number; correct: number; total: number; avgScore: number }>;
}

interface ClassData {
  id: string;
  name: string;
  school: string;
  invite_code: string;
  created_at: string;
}

interface Props {
  onBack: () => void;
}

async function teacherAPI<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('No supabase');
  const session = await supabase.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const method = body ? 'POST' : 'GET';
  const res = await fetch(`${API_BASE}/api/teacher?action=${action}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'нет данных';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  return `${days} дн назад`;
}

export default function TeacherDashboard({ onBack }: Props) {
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'tests' | 'active'>('score');

  // Create class form
  const [creating, setCreating] = useState(false);
  const [className, setClassName] = useState('');
  const [schoolName, setSchoolName] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherAPI<{ class: ClassData | null; students?: StudentData[] }>('get_class');
      setCls(data.class);
      setStudents(data.students || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!className.trim() || !schoolName.trim()) return;
    try {
      setCreating(true);
      const data = await teacherAPI<{ class: ClassData }>('create_class', {
        name: className.trim(),
        school: schoolName.trim(),
      });
      setCls(data.class);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const copyCode = () => {
    if (!cls) return;
    navigator.clipboard.writeText(cls.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <Users size={40} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
          <h2 style={{ ...TYPE.h2, marginBottom: 8 }}>Панель учителя</h2>
          <p style={{ ...TYPE.bodySmall, marginBottom: 20 }}>Войдите в аккаунт чтобы создать класс</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Загрузка...</div>
      </div>
    );
  }

  // No class yet — show create form
  if (!cls) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <div style={{ ...CARD, padding: '28px 20px' }}>
          <h1 style={{ ...TYPE.h1, fontSize: 22, marginBottom: 6 }}>Создать класс</h1>
          <p style={{ ...TYPE.bodySmall, marginBottom: 24 }}>Ученики смогут присоединиться по коду приглашения</p>

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>Название класса</label>
          <input
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder="11Б"
            maxLength={20}
            style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
          />

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>Школа</label>
          <input
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder="НИШ Алматы"
            maxLength={100}
            style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 24, boxSizing: 'border-box' }}
          />

          {error && <p style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <Button onClick={handleCreate} disabled={creating || !className.trim() || !schoolName.trim()} style={{ width: '100%' }}>
            {creating ? 'Создаю...' : 'Создать класс'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────
  const subjects = Object.keys(SUBJECT_META);
  const activeStudents = students.filter(s => s.totalTests > 0);

  // Class-level stats
  const classAvg = activeStudents.length > 0
    ? Math.round(activeStudents.reduce((s, st) => s + st.avgScore, 0) / activeStudents.length)
    : 0;
  const totalClassTests = students.reduce((s, st) => s + st.totalTests, 0);

  // Weak subjects (lowest avg across students who tested)
  const subjectAverages: { id: string; avg: number; tested: number }[] = [];
  for (const sid of subjects) {
    const tested = students.filter(s => s.bySubject[sid]);
    if (tested.length === 0) continue;
    const avg = Math.round(tested.reduce((s, st) => s + (st.bySubject[sid]?.avgScore || 0), 0) / tested.length);
    subjectAverages.push({ id: sid, avg, tested: tested.length });
  }
  subjectAverages.sort((a, b) => a.avg - b.avg);
  const weakSubjects = subjectAverages.slice(0, 3);

  // Sort students
  const sorted = [...students].sort((a, b) => {
    if (sortBy === 'score') return b.avgScore - a.avgScore;
    if (sortBy === 'tests') return b.totalTests - a.totalTests;
    if (sortBy === 'active') {
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
    }
    return 0;
  });

  // Filter by subject
  const filtered = filterSubject
    ? sorted.filter(s => s.bySubject[filterSubject!])
    : sorted;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <button onClick={loadData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
          Обновить
        </button>
      </div>

      {/* Class info + invite code */}
      <div style={{ ...CARD, marginBottom: 16, padding: '20px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ ...TYPE.h2, marginBottom: 4 }}>{cls.school}</h1>
            <p style={{ ...TYPE.bodySmall }}>{cls.name}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color={COLORS.teal} />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{students.length}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: TINT.teal.bgLight, borderRadius: R.md, border: `1px solid ${TINT.teal.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.teal, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Код класса</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text)', marginTop: 2 }}>{cls.invite_code}</div>
          </div>
          <button onClick={copyCode} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: R.sm, background: COLORS.teal, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {copied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Копировать</>}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(classAvg) }}>{classAvg}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Средний балл</div>
        </div>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{totalClassTests}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Тестов решено</div>
        </div>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.teal }}>{activeStudents.length}/{students.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Активных</div>
        </div>
      </div>

      {/* Weak subjects */}
      {weakSubjects.length > 0 && (
        <div style={{ ...CARD_COMPACT, marginBottom: 16, padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <AlertTriangle size={14} color={COLORS.amber} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Слабые предметы</span>
          </div>
          {weakSubjects.map(ws => (
            <div key={ws.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-body)' }}>{SUBJECT_META[ws.id]?.name || ws.id}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(ws.avg) }}>{ws.avg}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={filterSubject || ''}
          onChange={e => setFilterSubject(e.target.value || null)}
          style={{ padding: '8px 12px', borderRadius: R.sm, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="">Все предметы</option>
          {subjects.map(sid => (
            <option key={sid} value={sid}>{SUBJECT_META[sid]?.name || sid}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '8px 12px', borderRadius: R.sm, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="score">По баллу</option>
          <option value="tests">По тестам</option>
          <option value="active">По активности</option>
        </select>
      </div>

      {/* Students table */}
      <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>Ученики ({filtered.length})</div>

      {filtered.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 32 }}>
          <Users size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ ...TYPE.bodySmall }}>
            {students.length === 0 ? 'Пока нет учеников. Поделитесь кодом класса!' : 'Нет данных по выбранному фильтру'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((st, i) => {
            const subjectData = filterSubject ? st.bySubject[filterSubject] : null;
            const score = filterSubject && subjectData ? subjectData.avgScore : st.avgScore;
            const tests = filterSubject && subjectData ? subjectData.tests : st.totalTests;

            return (
              <div key={st.id} style={{ ...CARD_COMPACT, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Rank */}
                <div style={{ width: 24, fontSize: 14, fontWeight: 700, color: i < 3 ? COLORS.accent : 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
                  {i + 1}
                </div>

                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: TINT.teal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {st.avatar_url
                    ? <img src={st.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 16 }}>{st.nickname.charAt(0).toUpperCase()}</span>
                  }
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {st.nickname}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {tests} тест{tests === 1 ? '' : tests < 5 ? 'а' : 'ов'} • {timeAgo(st.lastActive)}
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: tests > 0 ? scoreColor(score) : 'var(--text-muted)' }}>
                    {tests > 0 ? `${score}%` : '—'}
                  </div>
                  {st.streak > 0 && (
                    <div style={{ fontSize: 10, color: COLORS.amber }}>🔥 {st.streak}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p style={{ color: COLORS.red, fontSize: 13, marginTop: 16, textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
