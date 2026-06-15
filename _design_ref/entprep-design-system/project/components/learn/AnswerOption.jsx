import React from 'react';

/**
 * ENTprep AnswerOption — a full-width quiz answer row with a leading
 * letter marker (А/Б/В/Г). States: base, selected, correct, wrong.
 * When overriding colors we always set the FULL border shorthand
 * (border: '2px solid X') to avoid React's borderColor merge conflict.
 */
export function AnswerOption({
  marker,
  state = 'base',
  disabled = false,
  children,
  style = {},
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);

  const states = {
    base: { border: '2px solid var(--ink)', bg: 'var(--surface-card)', mk: 'var(--ink)', mkFg: '#FFFFFF', mkBg: 'transparent' },
    selected: { border: '2px solid var(--streak)', bg: 'var(--surface-card)', mk: 'var(--streak)', mkFg: '#FFFFFF', mkBg: 'var(--streak)' },
    correct: { border: '2px solid var(--win)', bg: 'var(--win-soft)', mk: 'var(--win)', mkFg: '#FFFFFF', mkBg: 'var(--win)' },
    wrong: { border: '2px solid var(--red)', bg: 'var(--red-soft)', mk: 'var(--red)', mkFg: '#FFFFFF', mkBg: 'var(--red)' },
  }[state];

  const isResult = state === 'correct' || state === 'wrong';

  return (
    <button
      type="button"
      disabled={disabled || isResult}
      aria-pressed={state === 'selected'}
      onPointerDown={() => !disabled && !isResult && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-12)',
        width: '100%',
        textAlign: 'left',
        background: states.bg,
        border: states.border,
        borderRadius: 'var(--r-12)',
        boxShadow: pressed ? 'var(--shadow-press)' : 'var(--shadow-rest)',
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        padding: '14px var(--sp-16)',
        fontFamily: 'var(--ff-body)',
        fontWeight: 700,
        fontSize: 'var(--fs-body)',
        color: 'var(--ink)',
        cursor: disabled || isResult ? 'default' : 'pointer',
        transition: 'transform 90ms cubic-bezier(.2,.8,.2,1), box-shadow 90ms cubic-bezier(.2,.8,.2,1)',
        ...style,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--ff-mono)',
          fontWeight: 800,
          fontSize: 'var(--fs-body-small)',
          border: '2px solid ' + states.mk,
          background: states.mkBg,
          color: states.mkBg === 'transparent' ? states.mk : states.mkFg,
          borderRadius: 'var(--r-8)',
        }}
      >
        {marker}
      </span>
      <span style={{ flex: 1 }}>{children}</span>
    </button>
  );
}
