// Amil log in with a username and ahli with their member number (e.g. KWMZ-0001).
// Supabase Auth needs an email, so those map to an internal address.
// Keep LOGIN_DOMAIN in sync with supabase/functions/admin-users/index.ts.
export const LOGIN_DOMAIN = 'khairatplus.local';
export const toEmail = (id) => {
  const v = String(id || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
};
