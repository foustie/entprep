// Self-service subscription reconciliation — for users who paid on Lemon Squeezy
// with a different email than they registered with. They paste their order ID,
// the server verifies it in Lemon API, then activates premium on their current
// logged-in user.

import { supabase } from '../config/supabase';
import { API_BASE } from '../config/app';

export interface ReconcileResult {
  plan: 'monthly' | 'yearly';
  premiumUntil: string;
  orderId: string;
}

export async function reconcileMyOrder(lemonOrderId: string): Promise<ReconcileResult> {
  if (!supabase) throw new Error('Supabase not configured');
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Войдите в аккаунт');

  const res = await fetch(`${API_BASE}/api/lemon-reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ mode: 'self', lemonOrderId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось восстановить подписку');
  }
  return data as ReconcileResult;
}
