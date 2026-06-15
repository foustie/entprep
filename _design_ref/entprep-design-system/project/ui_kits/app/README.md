# ENTprep — App UI Kit

A high-fidelity, interactive recreation of the ENTprep mobile app, composed
entirely from the design-system components.

Open `index.html` — it boots into a 390px phone frame and is clickable:

- **Home** — daily-goal hero (the one yellow splash card), streak strip,
  subject tiles. The orange “Продолжить квест” button is the single CTA.
- **Quiz** — pick an answer (streak = selected), tap **Проверить** → the row
  turns green/red and a tinted explanation card appears → **Дальше**.
- **Results** — score / XP / accuracy on a yellow hero card, then review CTA.
- **Subjects** — the full 13-subject lesson path with progress.
- **Profile** — stats, level progress, and a **light/dark theme toggle**
  (flips `data-theme` on `<html>` — try it to see the dark surfaces).

Bottom nav switches Home / Subjects / Quest / Profile.

## Files
- `index.html` — app shell, phone frame, router.
- `data.js` — fake content (user, subjects, question, results).
- `kit.jsx` — Icon helper (Lucide), `AppHeader`, `BottomNav`.
- `HomeScreen.jsx`, `QuizScreen.jsx`, `ResultsScreen.jsx`,
  `SubjectsScreen.jsx`, `ProfileScreen.jsx`.

Strings are inline RU for demo readability; production uses `useT()` (ru + kk).
