// Self-service subscription management — view / cancel / resume the logged-in user's
// recurring Lemon Squeezy subscription, entirely on entprep.org. The backend
// (lemon-subscription.mjs) looks the subscription up by the caller's account email
// and acts only on their own record — no subscription id is ever sent from the client.

import { supabase } from '../config/supabase';
import { API_BASE } from '../config/app';

export interface SubscriptionStatus {
  found: boolean;
  status?: string | null;
  cancelled?: boolean;
  renewsAt?: string | null;
  endsAt?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

export interface CancelResult {
  ok: boolean;
  alreadyCancelled?: boolean;
  endsAt?: string | null;
  status?: string;
}

export interface ResumeResult {
  ok: boolean;
  renewsAt?: string | null;
  status?: string;
}

async function callSubscription<T>(mode: 'status' | 'cancel' | 'resume'): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Войдите в аккаунт');

  const res = await fetch(`${API_BASE}/api/lemon-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ mode }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'request_failed');
  return data as T;
}

export const getSubscriptionStatus = () => callSubscription<SubscriptionStatus>('status');
export const cancelSubscription = () => callSubscription<CancelResult>('cancel');
export const resumeSubscription = () => callSubscription<ResumeResult>('resume');
