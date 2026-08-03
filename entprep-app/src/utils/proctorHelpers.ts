import { API_BASE } from '../config/app';
import { isSchoolTenant } from '../config/tenant';
import { supabase } from '../config/supabase';

export type ProctorEventType =
  | 'visibility_hidden'
  | 'blur'
  | 'focus'
  | 'fullscreen_exit'
  | 'session_start'
  | 'session_end';

export function isSoftProctorEnabled(): boolean {
  return isSchoolTenant() || import.meta.env.VITE_SOFT_PROCTOR === 'true';
}

/** @deprecated use isSoftProctorEnabled */
export const softProctorEnabled = isSoftProctorEnabled;

export function newProctorSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Fire-and-forget single proctor event. Never throws. */
export async function logProctorEvent(
  sessionId: string,
  eventType: ProctorEventType,
  meta?: Record<string, unknown>,
): Promise<void> {
  return logProctorEvents([{ session_id: sessionId, event_type: eventType, meta }]);
}

/** Fire-and-forget proctor event(s). Never throws to callers. */
export async function logProctorEvents(
  events: Array<{ session_id: string; event_type: ProctorEventType; meta?: Record<string, unknown> }>,
): Promise<void> {
  if (!isSoftProctorEnabled() || !events.length || !supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch(`${API_BASE}/api/proctor?action=log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    });
  } catch {
    /* soft proctor must never break the exam */
  }
}
