// Subjects screen — full lesson path list.
const { Eyebrow, SubjectTile, Pill } = window.ENTprepDesignSystem_78ebb6;

function SubjectsScreen({ data, onStartQuiz }) {
  return (
    <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Eyebrow>• 13 предметов ЕНТ •</Eyebrow>
        <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.035em', marginTop: 6 }}>Выбери предмет</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Pill tone="streak">Все</Pill>
          <Pill>Обязательные</Pill>
          <Pill>Профильные</Pill>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.subjects.map((s) => (
          <SubjectTile
            key={s.id}
            icon={<Icon name={s.icon} size={22} stroke="var(--ink)" />}
            title={s.title}
            subtitle={s.locked ? 'скоро' : `${s.count} вопросов · ${s.progress}%`}
            progress={s.locked ? null : s.progress}
            accent={s.accent}
            locked={s.locked}
            onClick={onStartQuiz}
          />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SubjectsScreen });
