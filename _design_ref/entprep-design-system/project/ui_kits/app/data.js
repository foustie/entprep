// Fake content for the ENTprep app UI kit. Bilingual-ready strings kept
// inline (RU) for the demo; production uses useT() keys in ru.ts + kk.ts.
window.ENTPREP_DATA = {
  user: { name: 'Алихан', streak: 12, xp: 1240, league: 'Золотая лига' },
  goal: { done: 3, total: 5 },
  subjects: [
    { id: 'math',    icon: 'Calculator', title: 'Математика',     count: 320, progress: 68, accent: 'var(--xp-soft)' },
    { id: 'physics', icon: 'Atom',       title: 'Физика',          count: 240, progress: 41, accent: 'var(--win-soft)' },
    { id: 'history',  icon: 'Landmark',   title: 'История Казахстана', count: 280, progress: 22, accent: 'var(--streak-soft)' },
    { id: 'geo',     icon: 'Globe2',     title: 'География',        count: 190, progress: 12, accent: 'var(--premium-soft)' },
    { id: 'bio',     icon: 'Leaf',       title: 'Биология',         count: 210, progress: 0,  accent: 'var(--win-soft)', locked: true },
  ],
  quiz: {
    subject: 'Математика · Алгебра',
    index: 4, total: 12,
    question: 'Чему равен log₂ 8 ?',
    options: [
      { marker: 'А', text: '2' },
      { marker: 'Б', text: '3', correct: true },
      { marker: 'В', text: '4' },
      { marker: 'Г', text: '8' },
    ],
    explain: 'log₂ 8 — это степень, в которую возводим 2, чтобы получить 8. 2³ = 8, значит ответ 3.',
  },
  results: { score: 9, total: 12, xp: 90, accuracy: 75, streakKept: true },
};
