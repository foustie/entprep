import { useState, useEffect } from 'react';
import { Bell, Flame, BookOpen, BarChart2 } from 'lucide-react';
import { COLORS, FF, FS, R } from '../constants/styles';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../locales';
import { isPushSupported, getPushPermission, subscribeToPush } from '../utils/pushHelpers';
import BottomSheet from './ui/BottomSheet';

const DISMISS_KEY = 'entprep_push_dismissed';
const PROMPTED_KEY = 'entprep_push_prompted';

export default function PushPrompt() {
  const { hist, st, updSt } = useApp();
  const { user } = useAuth();
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (getPushPermission() !== 'default') return; // already granted or denied
    if (!user) return; // push requires auth
    if (st.pushEnabled) return; // already enabled
    if (localStorage.getItem(PROMPTED_KEY)) return; // already accepted

    // Check dismiss — re-ask after 7 days
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - new Date(dismissedAt).getTime()) / 86400000;
      if (daysSince < 7) return;
    }

    // Check 3+ unique study days
    const uniqueDates = new Set(hist.map(h => h.dt));
    if (uniqueDates.size < 3) return;

    // Show after a short delay
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [hist, user, st.pushEnabled]);

  const handleEnable = async () => {
    const ok = await subscribeToPush();
    if (ok) {
      updSt({ ...st, pushEnabled: true, pushStreak: true, pushErrors: true, pushWeekly: true });
      localStorage.setItem(PROMPTED_KEY, 'true');
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setVisible(false);
  };

  return (
    <BottomSheet visible={visible} onClose={handleDismiss}>
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: R.lg,
          background: 'var(--ink)',
          border: '2px solid var(--ink)',
          boxShadow: '0 4px 0 0 ' + COLORS.streak,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', margin: '0 auto 16px',
        }}>
          <Bell size={26} strokeWidth={2.4} />
        </div>

        <div style={{
          fontFamily: FF.display, fontSize: 20, fontWeight: 900,
          color: 'var(--text)', letterSpacing: '-0.035em', margin: '0 0 8px', lineHeight: 1.1,
        }}>{t.push?.promptTitle || 'Не забывай заниматься!'}</div>

        <div style={{
          fontFamily: FF.body, fontSize: FS.md, fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.5,
        }}>{t.push?.promptDesc || 'Включи уведомления, чтобы мы напомнили о серии и ошибках'}</div>

        <div style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--ink)',
          boxShadow: '0 3px 0 0 var(--ink)',
          borderRadius: 12, padding: '6px 14px',
          marginBottom: 18, textAlign: 'left',
        }}>
          {[
            { Icon: Flame, color: COLORS.streak, text: t.push?.streakToggle || 'Напоминание о серии' },
            { Icon: BookOpen, color: COLORS.xp, text: t.push?.errorsToggle || 'Повтори ошибки' },
            { Icon: BarChart2, color: COLORS.win, text: t.push?.weeklyToggle || 'Еженедельный отчёт' },
          ].map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 0',
              borderBottom: i < 2 ? '1.5px solid rgba(15,15,16,0.06)' : 'none',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${b.color}18`, border: `1.5px solid ${b.color}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <b.Icon size={15} color={b.color} strokeWidth={2.4} />
              </div>
              <span style={{
                fontFamily: FF.body, fontSize: 13, fontWeight: 700,
                color: 'var(--text)',
              }}>{b.text}</span>
            </div>
          ))}
        </div>

        <button onClick={handleEnable} style={{
          width: '100%', padding: '14px',
          background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
          color: '#fff',
          border: '2px solid var(--ink)',
          borderRadius: 12,
          boxShadow: '0 3px 0 0 var(--ink)',
          fontFamily: FF.display, fontSize: 14, fontWeight: 900,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Bell size={16} strokeWidth={2.6} />{t.push?.promptEnable || 'Включить'}
        </button>

        <button onClick={handleDismiss} style={{
          width: '100%', padding: '11px', marginTop: 10,
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)',
          fontFamily: FF.body, fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}>
          {t.push?.later || 'Позже'}
        </button>
      </div>
    </BottomSheet>
  );
}
