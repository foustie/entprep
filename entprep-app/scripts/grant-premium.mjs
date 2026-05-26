// One-off: grant exactly 365 days of Premium to a fixed list of emails.
// Differs from admin-action `activate_premium` (which yearly = until June 30):
// here `yearly` means a full calendar year (now + 365 days).
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_KEY=eyJ... \
//   node scripts/grant-premium.mjs

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required');
  process.exit(1);
}

const TARGETS = [
  { email: 'aidaamantaeva34@gmail.com', plan: 'yearly' },
  { email: 'sayan.sd@icloud.com',       plan: 'yearly' },
];

const PLAN_AMOUNT = { monthly: 1990, yearly: 9990 };

const headers = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

function premiumUntil(plan) {
  const now = new Date();
  const days = plan === 'monthly' ? 30 : 365;
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function findUserByEmail(email) {
  const res = await fetch(
    `${SB_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=1`,
    { headers },
  );
  if (!res.ok) throw new Error(`Lookup failed for ${email}: ${await res.text()}`);
  const data = await res.json();
  return (data.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function grant({ email, plan }) {
  const user = await findUserByEmail(email);
  if (!user) {
    console.log(`SKIP  ${email} — user not found in auth.users`);
    return;
  }

  const until = premiumUntil(plan);
  const amount = PLAN_AMOUNT[plan];

  // 1) user_metadata
  const upd = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      user_metadata: { ...(user.user_metadata || {}), is_premium: true, premium_until: until },
    }),
  });
  if (!upd.ok) throw new Error(`user_metadata update failed for ${email}: ${await upd.text()}`);

  // 2) subscriptions (authoritative)
  const sub = await fetch(`${SB_URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: user.id,
      is_active: true,
      plan,
      expires_at: until,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!sub.ok) throw new Error(`subscriptions upsert failed for ${email}: ${await sub.text()}`);

  // 3) payments audit row
  const pay = await fetch(`${SB_URL}/rest/v1/payments`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: user.id,
      amount,
      plan,
      kaspi_tx_id: 'manual-grant',
      status: 'completed',
      premium_until: until,
    }),
  });
  if (!pay.ok) throw new Error(`payments insert failed for ${email}: ${await pay.text()}`);

  console.log(`OK    ${email} → ${plan}, until ${until.slice(0, 10)}`);
}

for (const t of TARGETS) {
  try { await grant(t); }
  catch (e) { console.error(`FAIL  ${t.email}: ${e.message}`); }
}
