Stamped pressable subject row for the lesson path — icon chip, title, mono subtitle, optional progress.

```jsx
<SubjectTile icon={<Calculator/>} title="Математика" subtitle="320 вопросов" progress={68} accent="var(--xp-soft)" />
<SubjectTile icon={<Atom/>} title="Физика" subtitle="скоро" locked />
```

`accent` tints the icon chip — vary it per subject. Pass `progress` (0–100) to show the green bar; `locked` dims and disables.
