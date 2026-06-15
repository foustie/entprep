import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { COLORS, FF } from '../constants/styles';
import { useT } from '../locales';

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const updateSW = useRef<((reloadPage?: boolean) => void) | null>(null);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      updateSW.current = registerSW({
        onNeedRefresh() {
          // Delay update prompt: 60s for first-time users (no history), 3s for returning
          const hasHistory = !!localStorage.getItem('entprep_data');
          const delay = hasHistory ? 3000 : 60000;
          setTimeout(() => { if (!cancelled) setShow(true); }, delay);
        },
        onOfflineReady() {},
      });
    });
    return () => { cancelled = true; };
  }, []);

  const handleUpdate = () => {
    if (updateSW.current) updateSW.current(true);
  };

  if (!show) return null;

  return (
    <div role="alert" aria-label={t.pwa.updateAvailable} style={{
      position: 'fixed', bottom: 74, left: 16, right: 16,
      maxWidth: 448, margin: '0 auto', zIndex: 9998,
      background: 'var(--bg-card)',
      border: '2px solid var(--ink)',
      borderRadius: 14, padding: '16px 18px',
      boxShadow: `0 5px 0 0 ${COLORS.streak}`,
      animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)',
      willChange: 'opacity,transform',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: COLORS.streak,
          border: '2px solid var(--ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <RefreshCw size={18} strokeWidth={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FF.display, fontSize: 14, fontWeight: 900,
            color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>{t.pwa.updateAvailable}</div>
          <div style={{
            fontFamily: FF.body, fontSize: 11.5, fontWeight: 700,
            color: 'var(--text-muted)', marginTop: 2,
          }}>{t.pwa.newVersion}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setShow(false)} style={{
          background: 'var(--bg-subtle)',
          border: '1.5px solid rgba(15,15,16,0.14)',
          color: 'var(--text-muted)',
          borderRadius: 10, padding: '9px 16px',
          fontFamily: FF.body, fontSize: 12, fontWeight: 800,
          cursor: 'pointer',
        }}>{t.pwa.later}</button>
        <button onClick={handleUpdate} style={{
          background: 'var(--ink)',
          border: '2px solid var(--ink)',
          boxShadow: '0 2px 0 0 ' + COLORS.streak,
          color: '#fff',
          borderRadius: 10, padding: '8px 18px',
          fontFamily: FF.display, fontSize: 11, fontWeight: 900,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={13} strokeWidth={2.6} />{t.pwa.update}
        </button>
      </div>
    </div>
  );
}
