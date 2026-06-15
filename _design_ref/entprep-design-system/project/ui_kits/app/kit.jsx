// Shared UI-kit chrome: Lucide icon helper, top bar, bottom nav.
const { Pill, Stat, IconButton } = window.ENTprepDesignSystem_78ebb6;

function Icon({ name, size = 22, stroke = 'currentColor', width = 2.4 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && window.lucide && window.lucide.icons[name]) {
      ref.current.innerHTML = '';
      const el = window.lucide.createElement(window.lucide.icons[name]);
      el.setAttribute('width', size); el.setAttribute('height', size);
      el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', width);
      ref.current.appendChild(el);
    }
  }, [name, size, stroke, width]);
  return <span ref={ref} style={{ display: 'inline-flex', lineHeight: 0 }} />;
}

function AppHeader({ user, onProfile }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, border: '2px solid var(--ink)', background: 'var(--streak)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-rest)' }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, color: '#fff', fontSize: 16, letterSpacing: '-0.04em' }}>E</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>• ЕНТ 2026 •</div>
          <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>ENTprep</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pill tone="streak" icon={<Icon name="Flame" size={13} stroke="#fff" />}>{user.streak}</Pill>
        <Pill tone="xp" icon={<Icon name="Star" size={13} stroke="var(--ink)" />}>{user.xp.toLocaleString('ru-RU')}</Pill>
      </div>
    </header>
  );
}

function BottomNav({ active, onNav }) {
  const items = [
    { id: 'home', icon: 'House', label: 'Дом' },
    { id: 'subjects', icon: 'LayoutGrid', label: 'Предметы' },
    { id: 'quiz', icon: 'Swords', label: 'Квест' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
  ];
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 12px 14px', borderTop: '2px solid var(--ink)', background: 'var(--surface-card)' }}>
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onNav(it.id)} aria-label={it.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 0, cursor: 'pointer', padding: '4px 10px', minWidth: 56 }}>
            <span style={{ width: 44, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--streak)' : 'transparent', border: on ? '2px solid var(--ink)' : '2px solid transparent', color: on ? '#fff' : 'var(--text-muted)' }}>
              <Icon name={it.icon} size={20} width={2.4} />
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: on ? 'var(--text-primary)' : 'var(--text-faint)' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

Object.assign(window, { Icon, AppHeader, BottomNav });
