import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

// One login page for everyone; the account's role (profiles.role) decides the portal.
// Everyone can log in with an email. Ahli can also use their Member ID (e.g. KWMZ-0001)
// and amil their username: the admin-users Edge Function looks up that account's email,
// signs in on the server and returns the session, so emails are never exposed.
export const LOGIN_DOMAIN = 'khairatplus.local'; // keep in sync with supabase/functions/admin-users/index.ts
export const toEmail = (id) => {
  const v = String(id || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
};
export const isInternalEmail = (e) => String(e || '').toLowerCase().endsWith('@' + LOGIN_DOMAIN);

export async function signIn(client, identifier, password) {
  const id = String(identifier || '').trim();
  if (id.includes('@')) {
    const { error } = await client.auth.signInWithPassword({ email: id.toLowerCase(), password });
    if (error) throw error;
    return;
  }
  const { data, error } = await client.functions.invoke('admin-users', { body: { action: 'login', identifier: id, password } });
  if (error || !data?.access_token) throw new Error('invalid_login');
  const { error: e2 } = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (e2) throw e2;
}

// Asks Supabase Auth whether passkeys are turned on (Authentication → Passkeys on the
// hosted project, [auth.passkey] in supabase/config.toml locally). Cached per page load.
// Resolves true when the answer is unknown, so a network hiccup never hides the option.
let passkeyCheck = null;
export function passkeysEnabled() {
  if (!passkeyCheck) {
    passkeyCheck = fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .then((s) => s?.passkeys_enabled !== false)
      .catch(() => true);
  }
  return passkeyCheck;
}

// Passkeys (fingerprint / Face ID / Windows Hello) need WebAuthn and a secure context.
export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext;

// Where each role lands after logging in.
export const ROLES = ['admin', 'amil', 'ahli'];
export const roleHome = (role) => (ROLES.includes(role) ? '/' + role : '/');
