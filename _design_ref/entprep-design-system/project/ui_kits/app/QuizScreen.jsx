// Quiz screen — interactive: select an answer, check, see result + explanation.
const { Card, Button, Eyebrow, AnswerOption, IconButton, ProgressBar } = window.ENTprepDesignSystem_78ebb6;

function QuizScreen({ data, onBack, onFinish }) {
  const q = data.quiz;
  const [selected, setSelected] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const correctIdx = q.options.findIndex((o) => o.correct);
  const isRight = selected === correctIdx;

  function answerState(i) {
    if (!checked) return selected === i ? 'selected' : 'base';
    if (i === correctIdx) return 'correct';
    if (i === selected) return 'wrong';
    return 'base';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* progress header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 6px' }}>
        <IconButton ariaLabel="Выйти" onClick={onBack}><Icon name="X" size={20} stroke="var(--ink)" /></IconButton>
        <ProgressBar value={(q.index / q.total) * 100} tone="streak" />
        <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{q.index}/{q.total}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Eyebrow>• {q.subject} •</Eyebrow>
          <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.035em', lineHeight: 1.15, marginTop: 10, color: 'var(--text-primary)' }}>
            {q.question}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {q.options.map((o, i) => (
            <AnswerOption key={i} marker={o.marker} state={answerState(i)} onClick={() => !checked && setSelected(i)}>
              {o.text}
            </AnswerOption>
          ))}
        </div>

        {checked && (
          <Card tone={isRight ? 'win' : 'streak'} variant="compact">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name={isRight ? 'CircleCheck' : 'Lightbulb'} size={18} stroke="var(--ink)" />
              <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                {isRight ? 'Верно! +10 XP' : 'Почти! Разбор:'}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: 13, lineHeight: 1.55, color: 'var(--ink)' }}>{q.explain}</div>
          </Card>
        )}
      </div>

      {/* footer CTA */}
      <div style={{ padding: '12px 20px', borderTop: '2px solid var(--ink)', background: 'var(--surface-card)' }}>
        {!checked ? (
          <Button variant="primary" fullWidth size="lg" disabled={selected === null} onClick={() => setChecked(true)}>
            Проверить
          </Button>
        ) : (
          <Button variant="primary" fullWidth size="lg" trailingIcon={<Icon name="ArrowRight" size={18} stroke="#fff" />} onClick={onFinish}>
            Дальше
          </Button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { QuizScreen });
