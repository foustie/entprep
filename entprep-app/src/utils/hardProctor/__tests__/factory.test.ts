import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../proctorHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../proctorHelpers')>();
  return {
    ...actual,
    isHardProctorEnabled: vi.fn(),
    logProctorEvent: vi.fn(async () => {}),
  };
});

import { isHardProctorEnabled, logProctorEvent } from '../../proctorHelpers';
import { getHardProctorAdapter } from '../index';

describe('getHardProctorAdapter', () => {
  beforeEach(() => {
    vi.mocked(isHardProctorEnabled).mockReset();
    vi.mocked(logProctorEvent).mockClear();
  });

  afterEach(() => {
    document.getElementById('entprep-hard-proctor-pip')?.remove();
  });

  it('returns disabled no-op when hard proctor is off', async () => {
    vi.mocked(isHardProctorEnabled).mockReturnValue(false);
    const adapter = getHardProctorAdapter();
    expect(adapter.isEnabled()).toBe(false);
    await adapter.startSession({ sessionId: 's1' });
    expect(logProctorEvent).not.toHaveBeenCalled();
  });

  it('returns enabled stub when hard proctor is on', async () => {
    vi.mocked(isHardProctorEnabled).mockReturnValue(true);
    const adapter = getHardProctorAdapter();
    expect(adapter.isEnabled()).toBe(true);
    await adapter.completeConsent(true, 's1');
    expect(logProctorEvent).toHaveBeenCalledWith('s1', 'camera_consent_accepted');
  });

  it('logs camera_denied when getUserMedia is missing', async () => {
    vi.mocked(isHardProctorEnabled).mockReturnValue(true);
    const adapter = getHardProctorAdapter();
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await adapter.startSession({ sessionId: 's2' });
    expect(logProctorEvent).toHaveBeenCalledWith('s2', 'camera_denied', { reason: 'unsupported' });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original });
  });
});
