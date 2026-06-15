import type { ThemePalette } from '../types/index';

// Restored Apr 22 after eye-strain (астенопия) user request.
// Strategy: ink stays #0F0F10 (text on light splash cards must remain dark/readable);
// bg-card is significantly LIGHTER than page bg so dark ink borders/shadows read via contrast.
export const DARK: ThemePalette = {
  bg: 'radial-gradient(ellipse at 50% 0%, #16161E 0%, #0B0B12 60%)',
  'bg-card': '#22222E',                          // solid, ~40% lighter than bg → dark ink border visible
  'bg-header': 'rgba(11,11,18,0.92)',
  'bg-footer': 'rgba(11,11,18,0.95)',
  'bg-hero': 'linear-gradient(135deg,rgba(30,24,18,0.8),rgba(24,20,16,0.8),rgba(20,28,26,0.6))',
  'bg-modal': 'linear-gradient(180deg,#1E1E2A,#0B0B12)',
  'bg-sheet': '#1B1B26',
  'bg-prompt': 'rgba(28,28,42,0.9)',
  'bg-overlay': 'rgba(0,0,0,0.7)',
  'bg-overlay-light': 'rgba(0,0,0,0.5)',
  'bg-elevated': '#262632',
  'bg-subtle': 'rgba(255,255,255,0.05)',
  'bg-subtle-2': 'rgba(255,255,255,0.08)',
  'bg-option': 'rgba(255,255,255,0.04)',
  'bg-disabled': 'rgba(36,36,52,0.6)',
  'bg-card-dim': 'rgba(34,34,46,0.45)',
  text: '#F5F2EA',
  'text-body': '#E2E0D6',
  'text-secondary': '#A8AAB4',
  'text-muted': '#9A9CA6',   // A11Y-3: was #7B7D87 (3.84:1 on card, AA fail) → 5.75:1
  'text-dim': '#8C8E98',     // A11Y-3: was #5A5C66 (2.36:1 on card, AA+large fail) → 4.82:1
  'text-light': '#CDCFD7',
  border: 'rgba(255,255,255,0.1)',
  'border-light': 'rgba(255,255,255,0.07)',
  'border-md': 'rgba(255,255,255,0.13)',
  'border-strong': 'rgba(255,255,255,0.16)',
  'border-stronger': 'rgba(255,255,255,0.2)',
  'scroll-thumb': 'rgba(255,255,255,0.1)',
  'spinner-track': 'rgba(255,255,255,0.1)',
  'toggle-off': 'rgba(255,255,255,0.1)',
  'sheet-handle': 'rgba(255,255,255,0.18)',
  'skeleton-bg': 'rgba(255,255,255,0.07)',
  'shadow-sm': '0 2px 8px rgba(0,0,0,0.4)',
  'shadow-md': '0 4px 16px rgba(0,0,0,0.5)',
  'shadow-glow': '0 4px 16px rgba(255,90,54,0.18)',
  'color-scheme': 'dark',
  'theme-color': '#0B0B12',
  // KEEP DARK to preserve readability of text/icons placed on bright splash cards
  // (xpSoft/streakSoft/winSoft hero panels remain coloured even in dark theme).
  ink: '#0F0F10',
  'ink-soft': 'rgba(15,15,16,0.7)',
};

export const LIGHT: ThemePalette = {
  bg: 'radial-gradient(ellipse at 50% 0%, #FBF7EE 0%, #F2ECDE 60%)',
  'bg-card': 'rgba(255,255,255,0.96)',
  'bg-header': 'rgba(255,255,255,0.95)',
  'bg-footer': 'rgba(255,255,255,0.96)',
  'bg-hero': 'linear-gradient(135deg,rgba(255,248,240,0.9),rgba(250,245,238,0.9),rgba(240,248,246,0.8))',
  'bg-modal': 'linear-gradient(180deg,#F5F3F0,#FAFAF8)',
  'bg-sheet': 'rgba(255,255,255,0.99)',
  'bg-prompt': 'rgba(255,255,255,0.95)',
  'bg-overlay': 'rgba(0,0,0,0.5)',
  'bg-overlay-light': 'rgba(0,0,0,0.3)',
  'bg-elevated': 'rgba(250,250,248,0.95)',
  'bg-subtle': 'rgba(0,0,0,0.03)',
  'bg-subtle-2': 'rgba(0,0,0,0.05)',
  'bg-option': 'rgba(0,0,0,0.02)',
  'bg-disabled': 'rgba(230,230,235,0.8)',
  'bg-card-dim': 'rgba(255,255,255,0.5)',
  text: '#1a1a2e',
  'text-body': '#334155',
  'text-secondary': '#5B6A7D',  // A11Y-3: was #64748b (4.04:1 on page gradient, AA fail) → 4.69:1
  'text-muted': '#5c6a7a',
  'text-dim': '#5F6B7A',        // A11Y-3: was #7a8694 (3.15:1 on page, AA fail) → 4.61:1
  'text-light': '#475569',
  border: 'rgba(0,0,0,0.08)',
  'border-light': 'rgba(0,0,0,0.06)',
  'border-md': 'rgba(0,0,0,0.1)',
  'border-strong': 'rgba(0,0,0,0.1)',
  'border-stronger': 'rgba(0,0,0,0.12)',
  'scroll-thumb': 'rgba(0,0,0,0.1)',
  'spinner-track': 'rgba(0,0,0,0.08)',
  'toggle-off': 'rgba(0,0,0,0.08)',
  'sheet-handle': 'rgba(0,0,0,0.12)',
  'skeleton-bg': 'rgba(0,0,0,0.06)',
  'shadow-sm': '0 2px 8px rgba(0,0,0,0.04)',
  'shadow-md': '0 4px 16px rgba(0,0,0,0.06)',
  'shadow-glow': '0 4px 16px rgba(255,90,54,0.06)',
  'color-scheme': 'light',
  'theme-color': '#FAFAF8',
  ink: '#0F0F10',
  'ink-soft': 'rgba(15,15,16,0.7)',
};

export function themeToCss(palette: ThemePalette): string {
  return Object.entries(palette).map(([k, v]) => `--${k}:${v}`).join(';');
}
