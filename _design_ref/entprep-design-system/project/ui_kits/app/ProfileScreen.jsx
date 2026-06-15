// Profile screen — stats, league, theme toggle.
const { Card, Eyebrow, Stat, Button, ProgressBar, Pill } = window.ENTprepDesignSystem_78ebb6;

function ProfileScreen({ data, theme, onToggleTheme }) {
  const { user } = data;
  return (
    <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, border: '2px solid var(--ink)', background: 'var(--streak)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-rest)' }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: 26, color: '#fff', letterSpacing: '-0.04em' }}>{user.name[0]}</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em' }}>{user.name}</div>
          <div style={{ marginTop: 6 }}><Pill tone="xp" icon={<Icon name="Crown" size={13} stroke="var(--ink)" />}>{user.league}</Pill></div>
        </div>
      </div>

      <Card>
        <Eyebrow>• Статистика •</Eyebrow>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <Stat value={user.streak} label="дней подряд" color="var(--streak)" align="center" />
          <Stat value={user.xp.toLocaleString('ru-RU')} label="всего XP" color="var(--xp)" align="center" />
          <Stat value="87%" label="точность" color="var(--win)" align="center" />
        </div>
      </Card>

      <Card variant="hero">
        <Eyebrow>• До следующего уровня •</Eyebrow>
        <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '8px 0 12px' }}>Уровень 7 → 8</div>
        <ProgressBar value={62} tone="xp" showLabel />
      </Card>

      <Button variant="secondary" fullWidth leadingIcon={<Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={18} stroke="var(--ink)" />} onClick={onToggleTheme}>
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </Button>
    </div>
  );
}

Object.assign(window, { ProfileScreen });
