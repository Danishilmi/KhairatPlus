// Edge Function: lets the KhairatPlus admin create login accounts for amil, ahli
// and other admins, and reset their passwords. Needs the service role key, which Supabase
// injects automatically as SUPABASE_SERVICE_ROLE_KEY — never put it in the web app.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Logins are by username (amil) or member number (ahli). Supabase Auth needs an
// email, so we map them to an internal address. Must match src/lib/auth.js.
const LOGIN_DOMAIN = 'khairatplus.local';
const toEmail = (username: string) => (username.includes('@') ? username : `${username}@${LOGIN_DOMAIN}`).toLowerCase();
const cleanEmail = (e: unknown) => String(e || '').trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  // Public action: log in with a Member ID (ahli) or username (amil) instead of an email.
  // Looks up that account's email, signs in, and returns the session. Never reveals the email.
  if (body.action === 'login') {
    const id = String(body.identifier || '').trim().toLowerCase();
    const invalid = json({ error: 'invalid_login' }, 401);
    if (!id || id.length > 60) return invalid;
    let userId: string | null = null;
    const { data: m } = await service.from('members').select('user_id').eq('member_no', id.toUpperCase()).maybeSingle();
    if (m?.user_id) userId = m.user_id;
    if (!userId) {
      const { data: a } = await service.from('amils').select('user_id').eq('username', id).maybeSingle();
      if (a?.user_id) userId = a.user_id;
    }
    if (!userId) return invalid;
    const { data: u } = await service.auth.admin.getUserById(userId);
    if (!u?.user?.email) return invalid;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
    const { data: s, error } = await anon.auth.signInWithPassword({ email: u.user.email, password: String(body.password || '') });
    if (error || !s.session) return invalid;
    return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  }

  // Verify the caller is an admin.
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await service.auth.getUser(jwt);
  if (!caller?.user) return json({ error: 'unauthorized' }, 401);
  const { data: prof } = await service.from('profiles').select('role').eq('id', caller.user.id).maybeSingle();
  if (prof?.role !== 'admin') return json({ error: 'forbidden' }, 403);

  const password = String(body.password || '');

  if (body.action === 'set_password') {
    if (password.length < 6) return json({ error: 'password_too_short' }, 400);
    if (body.role === 'admin') {
      const { data: p } = await service.from('profiles').select('id').eq('id', body.id).eq('role', 'admin').maybeSingle();
      if (!p) return json({ error: 'not_found' }, 404);
      const { error } = await service.auth.admin.updateUserById(p.id, { password });
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    const table = body.role === 'amil' ? 'amils' : 'members';
    const { data: row } = await service.from(table).select('user_id').eq('id', body.id).maybeSingle();
    if (!row?.user_id) return json({ error: 'not_found' }, 404);
    const { error } = await service.auth.admin.updateUserById(row.user_id, { password });
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  if (body.action === 'create_amil') {
    const a = body.amil || {};
    const username = String(a.username || '').trim().toLowerCase();
    if (!a.full_name || !username) return json({ error: 'missing_fields' }, 400);
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: 'invalid_username' }, 400);
    if (password.length < 6) return json({ error: 'password_too_short' }, 400);
    const email = cleanEmail(a.email);
    if (email && !validEmail(email)) return json({ error: 'invalid_email' }, 400);
    const { data: taken } = await service.from('amils').select('id').eq('username', username).maybeSingle();
    if (taken) return json({ error: 'username_taken' }, 400);
    const { data: created, error } = await service.auth.admin.createUser({ email: email || toEmail(username), password, email_confirm: true });
    if (error) return json({ error: /already|exists/i.test(error.message) ? (email ? 'email_taken' : 'username_taken') : error.message }, 400);
    const uid = created.user.id;
    await service.from('profiles').insert({ id: uid, role: 'amil', full_name: a.full_name, username });
    const { data: amil, error: e2 } = await service.from('amils').insert({
      user_id: uid, username, full_name: a.full_name, ic_no: a.ic_no || '', phone: a.phone || '', email, area: a.area || ''
    }).select().single();
    if (e2) { await service.auth.admin.deleteUser(uid); return json({ error: e2.message }, 400); }
    return json({ amil });
  }

  if (body.action === 'create_member') {
    const m = body.member || {};
    if (!m.full_name) return json({ error: 'missing_fields' }, 400);
    if (password.length < 6) return json({ error: 'password_too_short' }, 400);
    const email = cleanEmail(m.email);
    if (email && !validEmail(email)) return json({ error: 'invalid_email' }, 400);
    const { data: member, error } = await service.from('members').insert({
      full_name: m.full_name, ic_no: m.ic_no || '', phone: m.phone || '', address: m.address || '', map_url: m.map_url || '', email,
      amil_id: m.amil_id || null, join_date: m.join_date || undefined
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    const username = member.member_no.toLowerCase();
    const { data: created, error: e2 } = await service.auth.admin.createUser({ email: email || toEmail(username), password, email_confirm: true });
    if (e2) { await service.from('members').delete().eq('id', member.id); return json({ error: /already|exists/i.test(e2.message) ? 'email_taken' : e2.message }, 400); }
    await service.from('profiles').insert({ id: created.user.id, role: 'ahli', full_name: m.full_name, username });
    const { data: linked } = await service.from('members').update({ user_id: created.user.id }).eq('id', member.id).select().single();
    return json({ member: linked });
  }

  // Change (or clear) the login email of an amil or ahli. Blank falls back to the internal ID address.
  if (body.action === 'set_email') {
    const table = body.role === 'amil' ? 'amils' : 'members';
    const { data: row } = await service.from(table).select(table === 'amils' ? 'user_id, username' : 'user_id, member_no').eq('id', body.id).maybeSingle();
    if (!row?.user_id) return json({ error: 'not_found' }, 404);
    const email = cleanEmail(body.email);
    if (email && !validEmail(email)) return json({ error: 'invalid_email' }, 400);
    const loginEmail = email || toEmail(String((row as any).username || (row as any).member_no).toLowerCase());
    const { error } = await service.auth.admin.updateUserById(row.user_id, { email: loginEmail, email_confirm: true });
    if (error) return json({ error: /already|exists|registered/i.test(error.message) ? 'email_taken' : error.message }, 400);
    await service.from(table).update({ email }).eq('id', body.id);
    return json({ ok: true });
  }

  if (body.action === 'delete_amil') {
    const { data: amil } = await service.from('amils').select('id, user_id').eq('id', body.id).maybeSingle();
    if (!amil) return json({ error: 'not_found' }, 404);
    const { count } = await service.from('members').select('id', { count: 'exact', head: true }).eq('amil_id', amil.id);
    if (count) return json({ error: 'amil_has_members' }, 409);
    const { error } = await service.from('amils').delete().eq('id', amil.id);
    if (error) return json({ error: error.message }, 400);
    if (amil.user_id) await service.auth.admin.deleteUser(amil.user_id); // also removes the profile
    return json({ ok: true });
  }

  // Add another admin. Admins always log in with their email.
  if (body.action === 'create_admin') {
    const a = body.admin || {};
    const full_name = String(a.full_name || '').trim();
    const email = cleanEmail(a.email);
    if (!full_name || !email) return json({ error: 'missing_fields' }, 400);
    if (!validEmail(email)) return json({ error: 'invalid_email' }, 400);
    if (password.length < 6) return json({ error: 'password_too_short' }, 400);
    const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json({ error: /already|exists|registered/i.test(error.message) ? 'email_taken' : error.message }, 400);
    const { data: admin, error: e2 } = await service.from('profiles')
      .insert({ id: created.user.id, role: 'admin', full_name, username: email }).select().single();
    if (e2) { await service.auth.admin.deleteUser(created.user.id); return json({ error: e2.message }, 400); }
    return json({ admin });
  }

  if (body.action === 'delete_admin') {
    if (body.id === caller.user.id) return json({ error: 'cannot_delete_self' }, 400);
    const { data: p } = await service.from('profiles').select('id').eq('id', body.id).eq('role', 'admin').maybeSingle();
    if (!p) return json({ error: 'not_found' }, 404);
    const { count } = await service.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count || 0) <= 1) return json({ error: 'last_admin' }, 409);
    const { error } = await service.auth.admin.deleteUser(p.id); // also removes the profile
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  return json({ error: 'unknown_action' }, 400);
});
