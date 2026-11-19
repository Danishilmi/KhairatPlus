import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(SUPABASE_URL && KEY);

// One client per portal, each with its own session storage key, so an admin
// and an amil can be signed in on the same browser without clashing.
const clients = {};
export function getClient(portal) {
  if (!configured) return null;
  if (!clients[portal]) {
    clients[portal] = createClient(SUPABASE_URL, KEY, { auth: { storageKey: `khairatplus-${portal}`, persistSession: true } });
  }
  return clients[portal];
}

// Throws on a Supabase error so callers can use try/catch.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
