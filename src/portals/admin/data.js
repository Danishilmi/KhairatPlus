import { q } from '../../lib/supabase.js';

// Admin can read everything; a kampung khairat is small enough to load whole tables.
export async function loadAll(client, parts = ['members', 'amils', 'payments', 'payouts', 'dependents']) {
  const out = {};
  await Promise.all(parts.map(async (p) => {
    const order = { members: 'member_no', amils: 'full_name', payments: 'year', payouts: 'paid_at', dependents: 'full_name' }[p];
    out[p] = await q(client.from(p).select('*').order(order, { ascending: p !== 'payouts' }));
  }));
  return out;
}

export function sum(rows, f = (r) => r.amount) { return rows.reduce((s, r) => s + Number(f(r) || 0), 0); }
