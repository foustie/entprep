import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { COLORS, R } from '../../constants/styles';

interface Props { onClose: () => void; }

// Simple recursive descent parser (no eval/Function — CSP safe)
function safeEval(expr: string): string {
  try {
    const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
    let pos = 0;
    const ch = () => sanitized[pos] || '';
    const eat = (c: string) => { if (ch() === c) { pos++; return true; } return false; };

    function parseExpr(): number {
      let val = parseTerm();
      while (true) {
        if (eat('+')) val += parseTerm();
        else if (eat('-')) val -= parseTerm();
        else break;
      }
      return val;
    }
    function parseTerm(): number {
      let val = parseFactor();
      while (true) {
        if (eat('*')) val *= parseFactor();
        else if (eat('/')) { const d = parseFactor(); if (d === 0) throw 'div0'; val /= d; }
        else break;
      }
      return val;
    }
    function parseFactor(): number {
      if (eat('(')) { const val = parseExpr(); eat(')'); return val; }
      if (eat('√')) { eat('('); const val = parseExpr(); eat(')'); return Math.sqrt(val); }
      const neg = eat('-');
      const start = pos;
      while (/[0-9.]/.test(ch())) pos++;
      let val = parseFloat(sanitized.slice(start, pos));
      if (isNaN(val)) val = 0;
      if (eat('²')) val = val * val;
      return neg ? -val : val;
    }

    const result = parseExpr();
    if (!isFinite(result)) return 'Ошибка';
    const str = String(parseFloat(result.toPrecision(12)));
    return str.length > 15 ? result.toExponential(6) : str;
  } catch { return 'Ошибка'; }
}

const BTNS = [
  ['C', '(', ')', '⌫'],
  ['√', 'x²', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '=', '='],
] as const;

export default function CalculatorSheet({ onClose }: Props) {
  const [display, setDisplay] = useState('0');
  const [result, setResult] = useState('');

  const press = useCallback((btn: string) => {
    setDisplay(prev => {
      let next = prev;
      switch (btn) {
        case 'C': setResult(''); return '0';
        case '⌫': { const n = prev.slice(0, -1) || '0'; setResult(''); return n; }
        case '=': { const r = safeEval(prev); setResult(r); return prev; }
        case '√': next = prev === '0' ? '√(' : prev + '√('; break;
        case 'x²': next = prev + '²'; break;
        case '%': {
          const r = safeEval(prev);
          if (r !== 'Ошибка') { setResult(String(parseFloat(r) / 100)); return prev; }
          return prev;
        }
        default:
          if (prev === '0' && btn !== '.') next = btn;
          else if (prev.length >= 30) return prev;
          else next = prev + btn;
      }
      setResult('');
      return next;
    });
  }, []);

  const btnStyle = (btn: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      border: 'none', borderRadius: R.md, fontSize: 18, fontWeight: 600,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono',monospace", height: 52, transition: 'background 0.15s',
    };
    if (btn === '=') return { ...base, background: COLORS.teal, color: '#fff', gridColumn: 'span 2' };
    if (btn === 'C') return { ...base, background: COLORS.red, color: '#fff' };
    if (['+', '-', '×', '÷', '√', 'x²', '%', '(', ')'].includes(btn))
      return { ...base, background: COLORS.accent, color: '#fff' };
    if (btn === '⌫') return { ...base, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' };
    return { ...base, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border-light)' };
  };

  // De-duplicate "=" in last row (it spans 2 cols)
  const rows = BTNS.map(row => {
    const seen = new Set<string>();
    return (row as readonly string[]).filter(b => { if (seen.has(b)) return false; seen.add(b); return true; });
  });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 998 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
        maxWidth: 360, margin: '0 auto',
        background: 'var(--bg-sheet)', borderRadius: '20px 20px 0 0',
        padding: '12px 16px 24px', animation: 'sheetUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>КАЛЬКУЛЯТОР</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: R.md, padding: '12px 14px', marginBottom: 12,
          border: '1px solid var(--border-light)', minHeight: 60, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'flex-end',
        }}>
          <div style={{
            fontSize: display.length > 18 ? 16 : 24, fontWeight: 700, color: 'var(--text)',
            fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all', textAlign: 'right', width: '100%',
          }}>{display}</div>
          {result && <div style={{
            fontSize: 14, color: COLORS.teal, fontFamily: "'JetBrains Mono',monospace",
            fontWeight: 600, marginTop: 4, textAlign: 'right', width: '100%',
          }}>= {result}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {rows.map((row, ri) => row.map(btn => (
            <button key={`${ri}-${btn}`} onClick={() => press(btn)} style={btnStyle(btn)}>{btn}</button>
          )))}
        </div>
      </div>
    </>,
    document.body
  );
}
