import { useState, useEffect, useCallback } from 'react';
import BottomSheet from './ui/BottomSheet';
import { Crown, Sparkles, Bot, GraduationCap, BookOpen, RotateCcw, Loader2, LogIn } from 'lucide-react';
import { COLORS, BUTTON, FF, FS, R } from '../constants/styles';

const INK = 'var(--ink)';
import { useT } from '../locales';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import type { PaywallReason } from '../types';
import { lemonCheckoutUrl, type PlanType } from '../config/payment';
import { trackEvent } from '../utils/analytics';
import {
  isNativePlatform,
  getOfferings,
  purchasePackage,
  restorePurchases,
  type RCPackage,
} from '../config/purchases';

interface PaywallModalProps {
  open: boolean;
  reason: PaywallReason;
  onClose: () => void;
}

const BENEFIT_ICONS = [Bot, Sparkles, GraduationCap, BookOpen];
const BENEFIT_COLORS = [COLORS.streak, COLORS.xp, COLORS.win, COLORS.purple];

export default function PaywallModal({ open, reason, onClose }: PaywallModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { nav } = useNav();
  const [plan, setPlan] = useState<PlanType>('yearly');
  const [packages, setPackages] = useState<{ monthly?: RCPackage; yearly?: RCPackage }>({});
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const isNative = isNativePlatform();

  const handlePay = useCallback(async () => {
    if (!isNative) {
      // Web: no native app yet — send to the Lemon Squeezy checkout for the chosen plan.
      trackEvent('Paywall Checkout Click', { reason: reason ?? 'unknown', plan: plan === 'monthly' ? 'monthly' : 'season' });
      window.open(lemonCheckoutUrl(plan === 'monthly' ? 'monthly' : 'season', user?.email), '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }

    const pkg = plan === 'monthly' ? packages.monthly : packages.yearly;
    if (!pkg) return;

    setPurchasing(true);
    setError('');
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        onClose();
        window.location.reload(); // refresh premium state
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // User cancelled — not an error
      if (code !== 'PURCHASE_CANCELLED' && code !== '1') {
        setError(t.error);
      }
    } finally {
      setPurchasing(false);
    }
  }, [isNative, plan, packages, onClose, t.error, reason, user]);

  const handleRestore = useCallback(async () => {
    if (!isNative) return;
    setPurchasing(true);
    setError('');
    try {
      const success = await restorePurchases();
      if (success) {
        onClose();
        window.location.reload();
      } else {
        setError(t.paywall.noPurchaseFound);
      }
    } catch {
      setError(t.error);
    } finally {
      setPurchasing(false);
    }
  }, [isNative, onClose, t.paywall.noPurchaseFound, t.error]);

  // Fetch offerings on open (native only)
  useEffect(() => {
    if (!open || !isNative) return;
    setLoading(true);
    setError('');
    getOfferings()
      .then(offering => {
        if (!offering) return;
        const pkgs: typeof packages = {};
        for (const pkg of offering.availablePackages) {
          if (pkg.identifier === '$rc_monthly') pkgs.monthly = pkg;
          else if (pkg.identifier === '$rc_annual') pkgs.yearly = pkg;
        }
        setPackages(pkgs);
      })
      .catch(() => { setError(t.error); })
      .finally(() => setLoading(false));
  }, [open, isNative, t.error]);

  if (!reason) return null;

  const pw = t.paywall as Record<string, string>;

  const titles: Record<string, string> = {
    daily_limit: pw.dailyLimit,
    fullent: pw.fullentTitle || pw.fullent,
    ai: pw.ai,
    upgrade: pw.upgradeTitle || 'ENTprep Premium',
    study_plan_locked: pw.upgradeTitle || 'ENTprep Premium',
    test_limit: pw.testLimit || pw.upgradeTitle || 'ENTprep Premium',
  };

  const descs: Record<string, string> = {
    daily_limit: pw.freeUsesUp || pw.dailyLimitDesc,
    fullent: pw.fullentUnlock || pw.fullentDesc,
    ai: pw.aiDesc,
    upgrade: pw.upgradeDesc || pw.dailyLimitDesc,
    study_plan_locked: pw.upgradeDesc || pw.dailyLimitDesc,
    test_limit: pw.testLimitDesc || pw.upgradeDesc || pw.dailyLimitDesc,
  };

  const benefitLabels = [
    t.paywall.unlimitedAI,
    t.paywall.aiErrors,
    t.paywall.aiPlan,
    t.paywall.fullEntSim,
  ];

  const monthlyPrice = packages.monthly?.product?.priceString || t.paywall.monthlyPlan;
  const yearlyPrice = packages.yearly?.product?.priceString || t.paywall.yearlyPlanAuto;

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: COLORS.streak,
          border: `2px solid ${INK}`,
          boxShadow: `0 3px 0 0 ${INK}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Crown size={26} color="#fff" strokeWidth={2.25} />
        </div>

        <div style={{ fontSize: FS.xl, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {titles[reason] || 'Premium'}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          {descs[reason] || ''}
        </div>

        {/* Benefits list */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: R.lg, padding: '14px 16px',
          marginBottom: 16, textAlign: 'left',
        }}>
          {benefitLabels.map((label, i) => {
            const Icon = BENEFIT_ICONS[i];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < benefitLabels.length - 1 ? '1px solid var(--border-light)' : 'none',
              }}>
                <Icon size={18} color={BENEFIT_COLORS[i]} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-body)', fontWeight: 500 }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Plan selector */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Loader2 size={24} color={COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setPlan('monthly')}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                background: plan === 'monthly' ? 'rgba(255,107,53,0.08)' : 'var(--bg-subtle)',
                border: plan === 'monthly' ? `2px solid ${COLORS.accent}` : '2px solid var(--border)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t.paywall.monthlyLabel}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: plan === 'monthly' ? COLORS.accent : 'var(--text)', fontFamily: FF.display }}>
                {monthlyPrice}
              </div>
            </button>

            <button
              onClick={() => setPlan('yearly')}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: 12, cursor: 'pointer', position: 'relative',
                background: plan === 'yearly' ? 'rgba(255,107,53,0.08)' : 'var(--bg-subtle)',
                border: plan === 'yearly' ? `2px solid ${COLORS.accent}` : '2px solid var(--border)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: -8, right: 10,
                background: COLORS.streak,
                border: `2px solid ${INK}`,
                color: '#fff', fontSize: 9, fontWeight: 700,
                padding: '2px 8px', borderRadius: R.sm,
                fontFamily: FF.mono, letterSpacing: '0.06em',
              }}>
                {t.paywall.yearlyBadge}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t.paywall.yearlyLabel}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: plan === 'yearly' ? COLORS.accent : 'var(--text)', fontFamily: FF.display }}>
                {yearlyPrice}
              </div>
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* CTA */}
        {!user ? (
          <>
            <button
              onClick={() => { onClose(); nav('settings'); }}
              style={{
                ...BUTTON.primary,
                width: '100%',
                padding: '15px',
                fontSize: 14,
                borderRadius: R.lg,
                justifyContent: 'center',
              }}
            >
              <LogIn size={18} />{t.paywall.loginToSubscribe || 'Войдите, чтобы подписаться'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {t.paywall.loginToSubscribeDesc || 'Для оформления подписки нужен аккаунт'}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={handlePay}
              disabled={purchasing}
              style={{
                ...BUTTON.primary,
                width: '100%',
                padding: '15px',
                fontSize: 14,
                borderRadius: R.lg,
                justifyContent: 'center',
                background: purchasing ? 'var(--bg-muted)' : COLORS.streak,
                borderBottomColor: purchasing ? 'transparent' : '#C94524',
                cursor: purchasing ? 'default' : 'pointer',
                opacity: purchasing ? 0.7 : 1,
              }}
            >
              {purchasing ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />{t.paywall.purchasing}</>
              ) : (
                <><Crown size={18} />{t.paywall.getPremium}</>
              )}
            </button>

            <button
              onClick={isNative ? handleRestore : onClose}
              disabled={purchasing}
              style={{
                width: '100%', padding: '12px', marginTop: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500,
                cursor: purchasing ? 'default' : 'pointer',
                opacity: purchasing ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {isNative && <RotateCcw size={14} />}
              {t.paywall.alreadyPaid}
            </button>
          </>
        )}

        {/* Legal links (Apple requirement) */}
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 14, lineHeight: 1.6, textAlign: 'center' }}>
          {isNative && (
            <div style={{ marginBottom: 6 }}>{t.paywall.legalRenewalNotice}</div>
          )}
          {t.paywall.legalPrefix}{' '}
          <a href="https://entprep.org/offer.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>{t.paywall.legalOfferLink}</a>
          {', '}
          <a href="https://entprep.org/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>{t.paywall.legalTermsLink}</a>
          {t.paywall.legalConjunction}
          <a href="https://entprep.org/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>{t.paywall.legalPrivacyLink}</a>
        </div>
      </div>
    </BottomSheet>
  );
}
