-- Extend proctor_events.event_type for hard-proctor stub (camera consent / stream).
-- Warn+log only — scoring never reads this table.
-- Apply later with school soft-proctor migration; not auto-applied.

ALTER TABLE public.proctor_events DROP CONSTRAINT IF EXISTS proctor_events_event_type_check;

ALTER TABLE public.proctor_events ADD CONSTRAINT proctor_events_event_type_check CHECK (event_type IN (
  'visibility_hidden',
  'blur',
  'focus',
  'fullscreen_exit',
  'session_start',
  'session_end',
  'camera_consent_accepted',
  'camera_consent_declined',
  'camera_start',
  'camera_denied',
  'camera_stopped'
));
