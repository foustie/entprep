import { useState, useEffect, useCallback, useRef } from 'react';
import { CARD, CARD_COMPACT, COLORS, TINT, TYPE, SECTION_LABEL, scoreColor, R, FF, FS } from '../constants/styles';
import { SUBJECT_META } from '../config/subjects';
import { TOPIC_MAP } from '../config/topics';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config/app';
import { supabase } from '../config/supabase';
import { isSchoolTenant } from '../config/tenant';
import { useNav } from '../contexts/NavigationContext';
import { ArrowLeft, Users, Copy, Check, TrendingUp, AlertTriangle, ArrowUp, Target, Printer, ChevronRight, Upload, PlayCircle, FileJson, Plus, UserMinus } from 'lucide-react';
import Button from './ui/Button';
import { useT } from '../locales';
import { pluralizeForms } from '../utils/formatters';
import type { Question } from '../types';

interface WeakTopic {
  tp: string;
  correct: number;
  total: number;
  pct: number;
}

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
  bySubject: Record<string, { tests: number; correct: number; total: number; avgScore: number; firstAvg?: number; latestAvg?: number; growth?: number }>;
  growth: number | null;
  predictedScore: number | null;
  weakTopics: WeakTopic[];
}

function getTopicName(topicId: string): string {
  for (const topics of Object.values(TOPIC_MAP)) {
    if (!topics) continue;
    const found = topics.find(t => t.id === topicId);
    if (found) return found.name;
  }
  return topicId;
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

async function teacherAPI<T>(action: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
  if (!supabase) throw new Error('No supabase');
  const session = await supabase.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const method = body ? 'POST' : 'GET';
  const qs = query && Object.keys(query).length ? `&${new URLSearchParams(query).toString()}` : '';
  const res = await fetch(`${API_BASE}/api/teacher?action=${action}${qs}`, {
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

// WS5: school pack import/assign — separate endpoint from teacherAPI above
// (netlify/functions/school-content.mjs), same auth pattern.
interface QuestionPack {
  id: string;
  subject: string;
  title: string | null;
  payload: Question[] | { questions: Question[] };
  created_by: string;
  created_at: string;
  assigned_class_ids: string[];
}

function packQuestions(pack: QuestionPack): Question[] {
  return Array.isArray(pack.payload) ? pack.payload : (pack.payload?.questions || []);
}

async function schoolAPI<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('No supabase');
  const session = await supabase.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const method = body ? 'POST' : 'GET';
  const res = await fetch(`${API_BASE}/api/school-content?action=${action}`, {
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

function timeAgo(dateStr: string | null, labels: { noData: string; minAgo: string; hAgo: string; yesterday: string; dAgo: string }): string {
  if (!dateStr) return labels.noData;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} ${labels.minAgo}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${labels.hAgo}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return labels.yesterday;
  return `${days} ${labels.dAgo}`;
}

export default function TeacherDashboard({ onBack }: Props) {
  const { user } = useAuth();
  const { navToErrorTest } = useNav();
  const t = useT();
  const tt = t.teacher;
  const [cls, setCls] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [proctorByStudent, setProctorByStudent] = useState<Record<string, Array<{ event_type: string; created_at: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'tests' | 'active'>('score');

  // WS5: school test packs
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [packSubject, setPackSubject] = useState('');
  const [packTitle, setPackTitle] = useState('');
  const [packPaste, setPackPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPacks = useCallback(async () => {
    try {
      const data = await schoolAPI<{ packs: QuestionPack[] }>('list_packs');
      setPacks(data.packs || []);
    } catch (e) {
      setImportErr((e as Error).message);
    }
  }, []);

  useEffect(() => { if (isSchoolTenant()) loadPacks(); }, [loadPacks]);

  const handlePackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPackPaste(String(reader.result || ''));
    reader.readAsText(file);
  };

  const doImportPack = async () => {
    setImportErr(null);
    setImportMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(packPaste);
    } catch {
      setImportErr(tt.packInvalidJson);
      return;
    }
    const questions = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown[] } | null)?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      setImportErr(tt.packNoQuestions);
      return;
    }
    try {
      setImporting(true);
      const data = await schoolAPI<{ imported: number; skipped: number }>('import_pack', {
        subject: packSubject.trim(),
        title: packTitle.trim() || undefined,
        questions,
      });
      let msg = tt.packImportSuccess.replace('{n}', String(data.imported));
      if (data.skipped) msg += tt.packImportSkipped.replace('{n}', String(data.skipped));
      setImportMsg(msg);
      setPackPaste('');
      setPackTitle('');
      await loadPacks();
    } catch (e) {
      setImportErr((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const doAssignPack = async (packId: string) => {
    if (!cls) return;
    try {
      setAssigningId(packId);
      setImportErr(null);
      await schoolAPI('assign_pack', { pack_id: packId, class_id: cls.id });
      await loadPacks();
    } catch (e) {
      setImportErr((e as Error).message);
    } finally {
      setAssigningId(null);
    }
  };

  const runPack = async (pack: QuestionPack) => {
    try {
      if (!supabase) return;
      const session = await supabase.auth.getSession();
      const token = session?.data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/school-content?action=get_pack&pack_id=${pack.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      const qs = packQuestions(body.pack);
      if (!qs.length) return;
      navToErrorTest(qs.map(q => ({ ...q, _su: q._su || pack.subject })));
    } catch (e) {
      setImportErr((e as Error).message);
    }
  };

  const loadProctor = async (studentId: string) => {
    try {
      if (!supabase) return;
      const session = await supabase.auth.getSession();
      const token = session?.data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/proctor?action=student_events&student_id=${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setProctorByStudent(prev => ({ ...prev, [studentId]: body.events || [] }));
    } catch { /* ignore */ }
  };

  // Create class form
  const [creating, setCreating] = useState(false);
  const [className, setClassName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Multi-class: teacher can own several classes — a simple switcher when >1.
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [showAddClass, setShowAddClass] = useState(false);

  // Kick student (teacher-only)
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null);
  const [kicking, setKicking] = useState(false);

  const loadData = useCallback(async (classId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherAPI<{ class: ClassData | null; students?: StudentData[]; classes?: ClassData[] }>(
        'get_class', undefined, classId ? { class_id: classId } : undefined,
      );
      setCls(data.class);
      setStudents(data.students || []);
      setClasses(data.classes || (data.class ? [data.class] : []));
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
      setClassName('');
      setSchoolName('');
      setShowAddClass(false);
      await loadData(data.class.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleKick = async (studentId: string) => {
    if (!cls) return;
    try {
      setKicking(true);
      await teacherAPI('kick_student', { class_id: cls.id, student_id: studentId });
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setKickConfirmId(null);
      if (expandedStudent === studentId) setExpandedStudent(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setKicking(false);
    }
  };

  const copyCode = async () => {
    if (!cls) return;
    try {
      await navigator.clipboard.writeText(cls.invite_code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for iOS Safari
      const ta = document.createElement('textarea');
      ta.value = cls.invite_code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> {t.back}
        </button>
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <Users size={40} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
          <h2 style={{ ...TYPE.h2, marginBottom: 8 }}>{tt.panel}</h2>
          <p style={{ ...TYPE.bodySmall, marginBottom: 20 }}>{tt.loginRequired}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> {t.back}
        </button>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{t.loading}</div>
      </div>
    );
  }

  // No class yet — show create form
  if (!cls) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: R.md, marginBottom: 20 }}>
          <ArrowLeft size={18} /> {t.back}
        </button>
        <div style={{ ...CARD, padding: '28px 20px' }}>
          <h1 style={{ ...TYPE.h1, fontSize: 22, marginBottom: 6 }}>{tt.createClass}</h1>
          <p style={{ ...TYPE.bodySmall, marginBottom: 24 }}>{tt.inviteHint}</p>

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.className}</label>
          <input
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder={tt.classNamePlaceholder}
            maxLength={20}
            style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
          />

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.school}</label>
          <input
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder={tt.schoolPlaceholder}
            maxLength={100}
            style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 24, boxSizing: 'border-box' }}
          />

          {error && <p style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <Button onClick={handleCreate} disabled={creating || !className.trim() || !schoolName.trim()} style={{ width: '100%' }}>
            {creating ? tt.creating : tt.createClass}
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
          <ArrowLeft size={18} /> {t.back}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddClass(v => !v)} aria-label={tt.addClass} title={tt.addClass} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} /> {tt.addClass}
          </button>
          <button onClick={() => window.print()} aria-label={tt.print} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
            <Printer size={14} />
          </button>
          <button onClick={() => loadData(cls.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
            {tt.refresh}
          </button>
        </div>
      </div>

      {/* Add another class — inline create form */}
      {showAddClass && (
        <div style={{ ...CARD, marginBottom: 16, padding: '18px 16px' }}>
          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.className}</label>
          <input
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder={tt.classNamePlaceholder}
            maxLength={20}
            style={{ width: '100%', padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.school}</label>
          <input
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder={tt.schoolPlaceholder}
            maxLength={100}
            style={{ width: '100%', padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <Button onClick={handleCreate} disabled={creating || !className.trim() || !schoolName.trim()} style={{ width: '100%' }}>
            {creating ? tt.creating : tt.createClass}
          </Button>
        </div>
      )}

      {/* Class switcher — only shown when the teacher owns more than one class */}
      {classes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {classes.map(c => (
            <button
              key={c.id}
              onClick={() => loadData(c.id)}
              style={{
                padding: '8px 14px', borderRadius: R.sm, border: `1px solid ${c.id === cls.id ? COLORS.teal : 'var(--border-md)'}`,
                background: c.id === cls.id ? TINT.teal.bgLight : 'var(--bg-card)', color: c.id === cls.id ? COLORS.teal : 'var(--text)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

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
            <div style={{ fontSize: 10, color: COLORS.teal, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{tt.classCode}</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.mono, color: 'var(--text)', marginTop: 2 }}>{cls.invite_code}</div>
          </div>
          <button onClick={copyCode} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: R.sm, background: COLORS.teal, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {copied ? <><Check size={14} /> {tt.copied}</> : <><Copy size={14} /> {tt.copy}</>}
          </button>
        </div>
      </div>

      {/* WS5: school test packs — import own JSON test, assign to class, launch */}
      {isSchoolTenant() && (
        <div style={{ ...CARD, marginBottom: 16, padding: '20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FileJson size={16} color={COLORS.teal} />
            <h2 style={{ ...TYPE.h3 }}>{tt.packsTitle}</h2>
          </div>
          <p style={{ ...TYPE.bodySmall, marginBottom: 16 }}>{tt.packsHint}</p>

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.packSubject}</label>
          <input
            value={packSubject}
            onChange={e => setPackSubject(e.target.value)}
            placeholder={tt.packSubjectPlaceholder}
            maxLength={100}
            style={{ width: '100%', padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
          />

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.packTitle}</label>
          <input
            value={packTitle}
            onChange={e => setPackTitle(e.target.value)}
            placeholder={tt.packTitlePlaceholder}
            maxLength={200}
            style={{ width: '100%', padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
          />

          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handlePackFile} style={{ display: 'none' }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: R.sm, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 8 }}
          >
            <Upload size={14} /> {tt.packUploadFile}
          </button>

          <label style={{ ...SECTION_LABEL, display: 'block', marginBottom: 6 }}>{tt.packOrPaste}</label>
          <textarea
            value={packPaste}
            onChange={e => setPackPaste(e.target.value)}
            placeholder={tt.packPastePlaceholder}
            rows={5}
            style={{ width: '100%', padding: '10px 12px', borderRadius: R.md, border: '1px solid var(--border-md)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 12, fontFamily: FF.mono, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }}
          />

          {importErr && <p style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>{importErr}</p>}
          {importMsg && <p style={{ color: '#58CC02', fontSize: 13, marginBottom: 12 }}>{importMsg}</p>}

          <Button
            onClick={doImportPack}
            disabled={importing || !packSubject.trim() || !packPaste.trim()}
            style={{ width: '100%', marginBottom: packs.length > 0 ? 20 : 0 }}
          >
            {importing ? tt.packImporting : tt.packImport}
          </Button>

          {packs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {packs.map(pack => {
                const qCount = packQuestions(pack).length;
                const isAssigned = !!cls && pack.assigned_class_ids.includes(cls.id);
                return (
                  <div key={pack.id} style={{ ...CARD_COMPACT, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pack.title || pack.subject}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {pack.subject} • {tt.packQuestionsCount.replace('{n}', String(qCount))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => doAssignPack(pack.id)}
                          disabled={!cls || isAssigned || assigningId === pack.id}
                          title={!cls ? tt.packNeedClassFirst : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: R.sm, border: '1px solid var(--border-md)',
                            background: isAssigned ? TINT.teal.bgLight : 'var(--bg-card)', color: isAssigned ? COLORS.teal : 'var(--text)',
                            cursor: !cls || isAssigned ? 'default' : 'pointer', fontSize: 11, fontWeight: 600, opacity: !cls ? 0.5 : 1,
                          }}
                        >
                          {isAssigned ? <Check size={12} /> : null}
                          {assigningId === pack.id ? tt.packAssigning : isAssigned ? tt.packAssigned : tt.packAssign}
                        </button>
                        <button
                          onClick={() => runPack(pack)}
                          aria-label={tt.packRun}
                          title={tt.packRun}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: R.sm, border: 'none', background: COLORS.teal, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                        >
                          <PlayCircle size={12} /> {tt.packRun}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {packs.length === 0 && (
            <p style={{ ...TYPE.bodySmall, textAlign: 'center', marginTop: 4 }}>{tt.packListEmpty}</p>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(classAvg) }}>{classAvg}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tt.avgScore}</div>
        </div>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{totalClassTests}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tt.testsSolved}</div>
        </div>
        <div style={{ ...CARD_COMPACT, textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.teal }}>{activeStudents.length}/{students.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tt.activeOf}</div>
        </div>
      </div>

      {/* Class growth */}
      {(() => {
        const withGrowth = students.filter(s => s.growth !== null && s.totalTests >= 3);
        if (withGrowth.length === 0) return null;
        const improved = withGrowth.filter(s => s.growth! > 0);
        const avgGrowth = Math.round(withGrowth.reduce((s, st) => s + (st.growth || 0), 0) / withGrowth.length);
        return (
          <div style={{ ...CARD_COMPACT, marginBottom: 16, padding: '14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <TrendingUp size={14} color={avgGrowth > 0 ? '#58CC02' : COLORS.amber} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{tt.classGrowth}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: avgGrowth > 0 ? '#58CC02' : 'var(--text-muted)' }}>
                  {avgGrowth > 0 ? '+' : ''}{avgGrowth}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tt.avgGrowth}</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#58CC02' }}>
                  {improved.length}/{withGrowth.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tt.improved}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {tt.comparisonNote}
            </div>
          </div>
        );
      })()}

      {/* Weak subjects */}
      {weakSubjects.length > 0 && (
        <div style={{ ...CARD_COMPACT, marginBottom: 16, padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <AlertTriangle size={14} color={COLORS.amber} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{tt.weakSubjects}</span>
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
          <option value="">{tt.allSubjects}</option>
          {subjects.map(sid => (
            <option key={sid} value={sid}>{SUBJECT_META[sid]?.name || sid}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '8px 12px', borderRadius: R.sm, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="score">{tt.byScore}</option>
          <option value="tests">{tt.byTests}</option>
          <option value="active">{tt.byActivity}</option>
        </select>
      </div>

      {/* Students table */}
      <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>{tt.students} ({filtered.length})</div>

      {filtered.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 32 }}>
          <Users size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ ...TYPE.bodySmall }}>
            {students.length === 0 ? tt.noStudents : tt.noFilterData}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((st, i) => {
            const subjectData = filterSubject ? st.bySubject[filterSubject] : null;
            const score = filterSubject && subjectData ? subjectData.avgScore : st.avgScore;
            const tests = filterSubject && subjectData ? subjectData.tests : st.totalTests;
            const isExpanded = expandedStudent === st.id;

            return (
              <div key={st.id} style={{ ...CARD_COMPACT, overflow: 'hidden' }}>
                {/* Main row — clickable */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    const next = isExpanded ? null : st.id;
                    setExpandedStudent(next);
                    if (next && isSchoolTenant()) loadProctor(next);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedStudent(isExpanded ? null : st.id); } }}
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                >
                  {/* Rank */}
                  <div style={{ width: 24, fontSize: 14, fontWeight: 700, color: i < 3 ? COLORS.accent : 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </div>

                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: TINT.teal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {st.avatar_url
                      ? <img src={st.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: FS.xl }}>{st.nickname.charAt(0).toUpperCase()}</span>
                    }
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {st.nickname}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {tests} {pluralizeForms(tests, tt.testsWord)} • {timeAgo(st.lastActive, tt)}
                    </div>
                  </div>

                  {/* Score + growth */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: tests > 0 ? scoreColor(score) : 'var(--text-muted)' }}>
                      {tests > 0 ? `${score}%` : '—'}
                    </div>
                    {st.growth !== null && st.growth !== 0 && (
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        color: st.growth > 0 ? '#58CC02' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end',
                      }}>
                        {st.growth > 0 && <ArrowUp size={10} />}
                        {st.growth > 0 ? `+${st.growth}%` : `${st.growth}%`}
                      </div>
                    )}
                  </div>

                  <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                    {/* Predicted score */}
                    {st.predictedScore !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 8px' }}>
                        <Target size={14} color={COLORS.teal} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tt.predictedEnt}</span>
                        <span style={{ fontSize: FS.xl, fontWeight: 800, fontFamily: FF.mono, color: scoreColor(Math.round(st.predictedScore / 1.4)) }}>
                          {st.predictedScore}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/140</span>
                        </span>
                      </div>
                    )}

                    {/* Weak topics */}
                    {st.weakTopics && st.weakTopics.length > 0 && (
                      <div style={{ paddingTop: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          {tt.weakTopics}
                        </div>
                        {st.weakTopics.map(wt => (
                          <div key={wt.tp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                              {getTopicName(wt.tp)}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <div style={{ width: 50, height: 4, borderRadius: 2, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${wt.pct}%`, background: scoreColor(wt.pct), borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FF.mono, color: scoreColor(wt.pct), width: 32, textAlign: 'right' }}>
                                {wt.pct}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-subject breakdown */}
                    {Object.keys(st.bySubject).length > 0 && (
                      <div style={{ paddingTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          {tt.bySubjects}
                        </div>
                        {Object.entries(st.bySubject).map(([sid, data]) => (
                          <div key={sid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-body)' }}>{SUBJECT_META[sid]?.name || sid}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(data.avgScore) }}>{data.avgScore}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Soft proctor journal — WS6: warn+log only, never affects scoring */}
                    {isSchoolTenant() && (() => {
                      const events = proctorByStudent[st.id] || [];
                      // Session start/end are bookkeeping, not distractions — only count
                      // the signals a teacher actually cares about.
                      const distractions = events.filter(ev => ev.event_type !== 'session_start' && ev.event_type !== 'session_end' && ev.event_type !== 'focus');
                      const label = (type: string) => {
                        if (type === 'visibility_hidden' || type === 'blur') return tt.proctorTabSwitch;
                        if (type === 'fullscreen_exit') return tt.proctorFullscreenExit;
                        if (type === 'focus') return tt.proctorFocusReturn;
                        return type;
                      };
                      return (
                        <div style={{ paddingTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {tt.proctorLog}
                            </span>
                            {distractions.length > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.amber }}>
                                {distractions.length} {pluralizeForms(distractions.length, tt.proctorEventWord)}
                              </span>
                            )}
                          </div>
                          {distractions.length === 0 ? (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tt.proctorEmpty}</div>
                          ) : (
                            distractions.slice(0, 12).map((ev, idx) => (
                              <div key={`${ev.created_at}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                                <span style={{ color: 'var(--text-body)' }}>{label(ev.event_type)}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{new Date(ev.created_at).toLocaleString('ru-RU')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}

                    {/* Kick student */}
                    <div style={{ paddingTop: 12, marginTop: 8, borderTop: '1px solid var(--border)' }}>
                      {kickConfirmId === st.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleKick(st.id)}
                            disabled={kicking}
                            style={{ flex: 1, padding: '8px', background: COLORS.red, border: 'none', borderRadius: R.md, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            {t.yes}
                          </button>
                          <button
                            onClick={() => setKickConfirmId(null)}
                            style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid var(--border-md)', borderRadius: R.md, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}
                          >
                            {t.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setKickConfirmId(st.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: COLORS.red, fontSize: 12, fontWeight: 600, padding: 0 }}
                        >
                          <UserMinus size={13} /> {tt.kick}
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
