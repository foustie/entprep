// Results screen — shown after a quest. One yellow hero card, one CTA.
const { Card, Button, Eyebrow, Stat, Pill } = window.ENTprepDesignSystem_78ebb6;

function ResultsScreen({ data, onReview, onHome }) {
  const r = data.results;
  return (
    <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ width: 76, height: 76, margin: '0 auto 14px', borderRadius: 20, border: '2px solid var(--ink)', background: 'var(--xp)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-hero)' }}>
          <Icon name="Trophy" size={38} stroke="var(--ink)" />
        </div>
        <Eyebrow>• Квест пройден •</Eyebrow>
        <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.04em', marginTop: 8 }}>Красава! 🔥</div>
        <div style={{ fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>Серия {data.user.streak} дней сохранена</div>
      </div>

      {/* hero score card */}
      <Card variant="hero">
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <Stat value={`${r.score}/${r.total}`} label="ответов" color="var(--ink)" align="center" />
          <div style={{ width: 2, background: 'var(--ink)', opacity: 0.25 }} />
          <Stat value={`+${r.xp}`} label="XP" color="var(--ink)" align="center" />
          <div style={{ width: 2, background: 'var(--ink)', opacity: 0.25 }} />
          <Stat value={`${r.accuracy}%`} label="точность" color="var(--ink)" align="center" />
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Pill tone="win" icon={<Icon name="TrendingUp" size={13} stroke="var(--ink)" />}>+1 уровень скоро</Pill>
        <Pill tone="streak" icon={<Icon name="Flame" size={13} stroke="#fff" />}>серия x{data.user.streak}</Pill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        <Button variant="primary" fullWidth size="lg" leadingIcon={<Icon name="Search" size={18} stroke="#fff" />} onClick={onReview}>
          Разобрать ошибки
        </Button>
        <Button variant="secondary" fullWidth onClick={onHome}>На главную</Button>
      </div>
    </div>
  );
}

Object.assign(window, { ResultsScreen });
