// Home / dashboard screen.
const { Card, Button, Eyebrow, ProgressBar, SubjectTile, Stat } = window.ENTprepDesignSystem_78ebb6;

function HomeScreen({ data, onStartQuiz, onOpenSubjects }) {
  const { user, goal, subjects } = data;
  return (
    <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero: daily goal — the one yellow splash card */}
      <Card variant="hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <Eyebrow>• Дневная цель •</Eyebrow>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.035em', color: 'var(--ink)', marginTop: 8 }}>
              Привет, {user.name} 👋
            </div>
            <div style={{ fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginTop: 2 }}>
              Ещё {goal.total - goal.done} урока — и серия в безопасности
            </div>
          </div>
          <Stat value={`${goal.done}/${goal.total}`} label="уроков" color="var(--ink)" align="center" />
        </div>
        <div style={{ marginTop: 16 }}>
          <ProgressBar value={(goal.done / goal.total) * 100} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" fullWidth size="lg" leadingIcon={<Icon name="Play" size={18} stroke="#fff" />} onClick={onStartQuiz}>
            Продолжить квест
          </Button>
        </div>
      </Card>

      {/* Streak strip */}
      <Card variant="compact">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, border: '2px solid var(--ink)', background: 'var(--streak-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="Flame" size={22} stroke="var(--streak)" />
            </span>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>Серия {user.streak} дней</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{user.league}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,1,1,1,1,0,0].map((d, i) => (
              <span key={i} style={{ width: 16, height: 16, borderRadius: 6, border: '2px solid var(--ink)', background: d ? 'var(--win)' : 'var(--surface-sunken)' }} />
            ))}
          </div>
        </div>
      </Card>

      {/* Subjects */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <Eyebrow>• Твои предметы •</Eyebrow>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.025em', marginTop: 4 }}>Куда дальше?</div>
          </div>
          <button onClick={onOpenSubjects} style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, color: 'var(--streak)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Все →</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subjects.slice(0, 3).map((s) => (
            <SubjectTile key={s.id} icon={<Icon name={s.icon} size={22} stroke="var(--ink)" />} title={s.title} subtitle={`${s.count} вопросов`} progress={s.progress} accent={s.accent} onClick={onStartQuiz} />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen });
