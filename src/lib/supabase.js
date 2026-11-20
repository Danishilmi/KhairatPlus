import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_ANON_KEY = KEY;
export const configured = Boolean(SUPABASE_URL && KEY);

// One shared client: everyone logs in on the same page and the app sends them
// to the portal that matches their account's role.
let client = null;
export function getClient() {
  if (!configured) return null;
  if (!client) client = createClient(SUPABASE_URL, KEY, { auth: { storageKey: 'khairatplus-auth', persistSession: true } });
  return client;
}

// Throws on a Supabase error so callers can use try/catch.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
