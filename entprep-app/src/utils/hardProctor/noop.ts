import type { HardProctorAdapter, HardProctorConsentResult, HardProctorStartContext } from './types';

export const noopHardProctor: HardProctorAdapter = {
  isEnabled: () => false,
  completeConsent: async (): Promise<HardProctorConsentResult> => ({ ok: true }),
  startSession: async () => {},
  stopSession: async () => {},
};
