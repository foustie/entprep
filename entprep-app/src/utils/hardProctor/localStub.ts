import { logProctorEvent } from '../proctorHelpers';
import type { HardProctorAdapter, HardProctorConsentResult, HardProctorStartContext } from './types';

const PIP_ID = 'entprep-hard-proctor-pip';

function removePip() {
  document.getElementById(PIP_ID)?.remove();
}

function mountPip(stream: MediaStream) {
  removePip();
  const wrap = document.createElement('div');
  wrap.id = PIP_ID;
  wrap.setAttribute('aria-hidden', 'true');
  Object.assign(wrap.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    width: '112px',
    height: '84px',
    zIndex: '9999',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '2px solid var(--ink, #111)',
    boxShadow: '0 4px 0 0 var(--ink, #111)',
    background: '#000',
    pointerEvents: 'none',
  });
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'cover' });
  wrap.appendChild(video);
  document.body.appendChild(wrap);
  void video.play().catch(() => {});
}

/**
 * Local hard-proctor stub: consent logging + optional camera PIP.
 * No upload, no analysis, never blocks the exam.
 */
export function createLocalHardProctorStub(): HardProctorAdapter {
  let stream: MediaStream | null = null;
  let sessionId: string | null = null;
  let stoppedHandler: (() => void) | null = null;

  const stopTracks = () => {
    stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    stream = null;
    removePip();
  };

  return {
    isEnabled: () => true,

    async completeConsent(accepted, sid): Promise<HardProctorConsentResult> {
      sessionId = sid;
      await logProctorEvent(
        sid,
        accepted ? 'camera_consent_accepted' : 'camera_consent_declined',
      );
      return { ok: true, reason: accepted ? undefined : 'declined' };
    },

    async startSession(ctx: HardProctorStartContext): Promise<void> {
      sessionId = ctx.sessionId;
      stoppedHandler = ctx.onCameraStopped || null;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        await logProctorEvent(ctx.sessionId, 'camera_denied', { reason: 'unsupported' });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const track = stream.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            const sid = sessionId;
            stopTracks();
            if (sid) void logProctorEvent(sid, 'camera_stopped', { reason: 'track_ended' });
            stoppedHandler?.();
          };
        }
        mountPip(stream);
        await logProctorEvent(ctx.sessionId, 'camera_start');
      } catch (err) {
        await logProctorEvent(ctx.sessionId, 'camera_denied', {
          reason: err instanceof Error ? err.name : 'error',
        });
      }
    },

    async stopSession(): Promise<void> {
      const sid = sessionId;
      const hadStream = !!stream;
      stopTracks();
      sessionId = null;
      stoppedHandler = null;
      if (sid && hadStream) {
        await logProctorEvent(sid, 'camera_stopped', { reason: 'session_end' });
      }
    },
  };
}
