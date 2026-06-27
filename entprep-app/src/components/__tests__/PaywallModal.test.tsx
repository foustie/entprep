import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaywallModal from '../PaywallModal';

vi.mock('../../config/payment', () => ({
  PLANS: { monthly: { amount: 2990 }, yearly: { amount: 9990 } },
  RC_PRODUCT_IDS: { monthly: 'entprep_monthly', yearly: 'entprep_yearly' },
  lemonCheckoutUrl: (plan: string, email?: string) =>
    `https://entprep.lemonsqueezy.com/checkout/buy/${plan === 'monthly' ? 'MID' : 'SID'}${email ? `?checkout[email]=${encodeURIComponent(email)}` : ''}`,
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('../../config/purchases', () => ({
  isNativePlatform: () => false,
  getOfferings: async () => null,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test', email: 'test@test.com' }, premium: false }),
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNav: () => ({ nav: vi.fn() }),
}));

vi.mock('../../locales', () => ({
  useT: () => ({
    error: 'Ошибка',
    paywall: {
      dailyLimit: 'Лимит тестов',
      fullent: 'Полный ЕНТ',
      ai: 'AI-помощник',
      dailyLimitDesc: 'Вы исчерпали дневной лимит',
      fullentDesc: 'Симуляция ЕНТ доступна в Premium',
      aiDesc: 'AI доступен в Premium',
      unlimitedAI: 'Разбери каждую ошибку с ИИ-репетитором',
      aiErrors: 'Личный план подготовки к ЕНТ',
      aiPlan: 'Полная симуляция ЕНТ без ограничений',
      fullEntSim: 'Разбор каждого вопроса с объяснением',
      monthlyPlan: '2 990 ₸/мес',
      yearlyPlan: '9 990 ₸',
      yearlyPlanAuto: '9 990 ₸/сезон',
      yearlyPlanDesc: 'автопродление раз в год',
      monthlyLabel: 'Ежемесячно',
      yearlyLabel: 'За сезон',
      yearlyBadge: 'Выгодно',
      getPremium: 'Подписаться',
      alreadyPaid: 'Восстановить покупку',
      noPurchaseFound: 'Подписка не найдена',
      purchasing: 'Оформление...',
    },
  }),
}));

vi.mock('../ui/BottomSheet', () => ({
  default: ({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!visible) return null;
    return <div data-testid="bottom-sheet">{children}<button data-testid="sheet-close" onClick={onClose} /></div>;
  },
}));

describe('PaywallModal', () => {
  it('renders null when no reason', () => {
    const { container } = render(<PaywallModal open={true} reason={null as any} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null when not visible', () => {
    const { container } = render(<PaywallModal open={false} reason="daily_limit" onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows correct title per reason', () => {
    render(<PaywallModal open={true} reason="daily_limit" onClose={() => {}} />);
    expect(screen.getByText('Лимит тестов')).toBeInTheDocument();
  });

  it('shows 4 benefit items', () => {
    render(<PaywallModal open={true} reason="daily_limit" onClose={() => {}} />);
    expect(screen.getByText('Разбери каждую ошибку с ИИ-репетитором')).toBeInTheDocument();
    expect(screen.getByText('Разбор каждого вопроса с объяснением')).toBeInTheDocument();
  });

  it('shows two plan options with fallback prices on web', () => {
    render(<PaywallModal open={true} reason="daily_limit" onClose={() => {}} />);
    expect(screen.getByText('2 990 ₸/мес')).toBeInTheDocument();
    expect(screen.getByText('9 990 ₸/сезон')).toBeInTheDocument();
  });

  it('on web: "already paid" button calls onClose', () => {
    const onClose = vi.fn();
    render(<PaywallModal open={true} reason="daily_limit" onClose={onClose} />);
    fireEvent.click(screen.getByText('Восстановить покупку'));
    expect(onClose).toHaveBeenCalled();
  });

  it('on web: CTA opens the Lemon Squeezy checkout with the email prefilled', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onClose = vi.fn();
    render(<PaywallModal open={true} reason="daily_limit" onClose={onClose} />);
    fireEvent.click(screen.getByText('Подписаться'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('lemonsqueezy.com/checkout');
    expect(url).toContain('checkout[email]=test%40test.com'); // logged-in user's email prefilled
    expect(onClose).toHaveBeenCalled(); // modal closes after sending to checkout
    openSpy.mockRestore();
  });
});
