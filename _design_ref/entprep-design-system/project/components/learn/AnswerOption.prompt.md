Full-width quiz answer row with a letter marker. Streak = selected, green = correct, red = wrong.

```jsx
<AnswerOption marker="А">Функция возрастает</AnswerOption>
<AnswerOption marker="Б" state="selected">x = 4</AnswerOption>
<AnswerOption marker="В" state="correct">log₂8 = 3</AnswerOption>
<AnswerOption marker="Г" state="wrong">x = −1</AnswerOption>
```

States: `base` / `selected` (streak) / `correct` (win) / `wrong` (red). `correct`/`wrong` auto-lock the button. Color overrides use full `border` shorthand to avoid React merge conflicts.
