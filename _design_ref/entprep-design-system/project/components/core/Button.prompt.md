The stamped, pressable CTA — use `primary` (streak orange) for the single action per screen, `secondary`/`ink` for everything else.

```jsx
<Button variant="primary" size="lg" fullWidth>Поехали</Button>
<Button variant="secondary">Позже</Button>
```

Variants: `primary` (streak orange, shadow 0 6px), `secondary` (white + ink border), `ink` (solid black). Sizes: `sm` / `md` / `lg`. Pass `leadingIcon`/`trailingIcon` for icon buttons. Press collapses the hard shadow and sinks the button ~4px. Never put two `primary` buttons on one screen.
