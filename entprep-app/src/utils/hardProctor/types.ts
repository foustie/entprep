export interface HardProctorStartContext {
  sessionId: string;
  /** Called once if the camera stream ends unexpectedly mid-exam. */
  onCameraStopped?: () => void;
}

export interface HardProctorConsentResult {
  ok: boolean;
  reason?: 'declined' | 'error';
}

/**
 * Vendor-ready seam. FullENT depends only on this interface.
 * Local stub today; Proctorio (etc.) later.
 */
export interface HardProctorAdapter {
  isEnabled(): boolean;
  /**
   * Resolve after the student finishes the consent UI.
   * Stub never blocks the exam on decline — returns ok:true after logging.
   * `accepted` reflects whether they accepted camera monitoring.
   */
  completeConsent(accepted: boolean, sessionId: string): Promise<HardProctorConsentResult>;
  startSession(ctx: HardProctorStartContext): Promise<void>;
  stopSession(): Promise<void>;
}
