import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// useT() reads the language from AppContext — mock it to render in Russian.
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ st: { lang: 'ru' } }) }));

const mockGetCode = vi.fn();
vi.mock('../../utils/referralHelpers', () => ({
  getReferralCode: () => mockGetCode(),
  buildReferralLink: (c: string) => `https://entprep.org?ref=${c}`,
}));

const mockCopy = vi.fn().mockResolvedValue(true);
const mockWa = vi.fn();
const mockTg = vi.fn();
vi.mock('../../utils/shareHelpers', () => ({
  copyText: (t: string) => mockCopy(t),
  shareToWhatsApp: (t: string) => mockWa(t),
  shareToTelegram: (t: string) => mockTg(t),
}));

import InviteFriend from '../InviteFriend';

describe('InviteFriend', () => {
  beforeEach(() => {
    mockGetCode.mockReset();
    mockCopy.mockClear();
    mockWa.mockClear();
    mockTg.mockClear();
  });

  it('fetches the code, shows the invite link, and copies it on click', async () => {
    mockGetCode.mockResolvedValue('INVITE7');
    render(<InviteFriend />);

    const link = await screen.findByText('https://entprep.org?ref=INVITE7');
    expect(link).toBeTruthy();

    fireEvent.click(await screen.findByText('Копировать ссылку'));
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith('https://entprep.org?ref=INVITE7'));
    // The button swaps to the "copied" label.
    expect(await screen.findByText('Скопировано!')).toBeTruthy();
  });

  it('shares the link with the localized share text via WhatsApp / Telegram', async () => {
    mockGetCode.mockResolvedValue('INVITE7');
    render(<InviteFriend />);
    await screen.findByText('https://entprep.org?ref=INVITE7');

    fireEvent.click(screen.getByLabelText('WhatsApp'));
    fireEvent.click(screen.getByLabelText('Telegram'));
    // Share text carries the link.
    expect(mockWa).toHaveBeenCalledWith(expect.stringContaining('https://entprep.org?ref=INVITE7'));
    expect(mockTg).toHaveBeenCalledWith(expect.stringContaining('https://entprep.org?ref=INVITE7'));
  });

  it('shows an error state when the code fetch fails', async () => {
    mockGetCode.mockRejectedValue(new Error('nope'));
    render(<InviteFriend />);
    expect(await screen.findByText(/Не удалось загрузить/)).toBeTruthy();
  });
});
