import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { getClient, configured, q } from '../lib/supabase.js';
import { passkeySupported, passkeysEnabled, roleHome } from '../lib/auth.js';
import { fmtDate } from '../lib/format.js';
import { useLang, useT, useErrorText } from '../lib/i18n.jsx';
import { Field, Spinner, ToastProvider, PasswordInput, FingerprintIcon } from './ui.jsx';

const PortalCtx = createContext(null);
export const usePortal = () => useContext(PortalCtx);

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === 'ms' ? 'on' : ''} onClick={() => setLang('ms')}>BM</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="center-page">
      <div className="card narrow">
        <h2>Supabase belum disambung / not configured</h2>
        <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> (or in Vercel environment variables), then restart. See README.</p>
      </div>
    </div>
  );
}

// Wraps a portal: needs a signed-in user whose role matches this portal.
// Not signed in → the login page at "/". Wrong role → that user's own portal.
export function Portal({ role, title, accent, tabs, children }) {
  const t = useT();
  const client = getClient();
  const location = useLocation();
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let alive = true;
    (async () => {
      const p = await q(client.from('profiles').select('*').eq('id', session.user.id).maybeSingle()).catch(() => null);
      if (!alive) return;
      if (!p) { await client.auth.signOut({ scope: 'local' }); setRedirect({ to: '/', state: { error: 'no_role' } }); return; }
      if (p.role !== role) { setRedirect({ to: roleHome(p.role) }); return; }
      const s = await q(client.from('settings').select('*').eq('id', 1).maybeSingle()).catch(() => null);
      if (alive) { setSettings(s); setProfile(p); }
    })();
    return () => { alive = false; };
  }, [session, client, role]);

  if (!configured) return <NotConfigured />;
  if (redirect) return <Navigate to={redirect.to} state={redirect.state} replace />;
  if (session === null) return <Navigate to="/" state={{ from: location.pathname }} replace />;
  if (session === undefined || !profile) return <div className="center-page"><Spinner /></div>;

  const value = { client, session, profile, settings, setSettings, role, signOut: () => client.auth.signOut() };
  return (
    <PortalCtx.Provider value={value}>
      <ToastProvider>
        <div className={'portal portal-' + accent}>
          <header className="topbar">
            <div className="topbar-inner">
              <Link to={'/' + role} className="brand">
                <img src="/favicon.svg" alt="" width="30" height="30" />
                <span><strong>KhairatPlus</strong><small>{title}</small></span>
              </Link>
              <div className="topbar-right">
                <LangToggle />
                <span className="who" title={profile.username}>{profile.full_name || profile.username}</span>
                <button className="btn btn-ghost btn-sm" onClick={value.signOut}>{t('Log keluar', 'Log out')}</button>
              </div>
            </div>
            <nav className="tabs">
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{tab.label}</NavLink>
              ))}
            </nav>
          </header>
          <main className="content">{children}</main>
        </div>
      </ToastProvider>
    </PortalCtx.Provider>
  );
}

// Change own password (all roles).
export function ChangePassword() {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState(null);
  const eye = { showLabel: t('Tunjuk kata laluan', 'Show password'), hideLabel: t('Sembunyi kata laluan', 'Hide password') };
  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) return setMsg({ err: t('Kata laluan tidak sepadan.', 'Passwords do not match.') });
    const { error } = await client.auth.updateUser({ password: pw });
    setMsg(error ? { err: errText(error) } : { ok: t('Kata laluan dikemas kini.', 'Password updated.') });
    if (!error) { setPw(''); setPw2(''); }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3>{t('Tukar kata laluan', 'Change password')}</h3>
      {msg?.err && <div className="alert alert-error">{msg.err}</div>}
      {msg?.ok && <div className="alert alert-ok">{msg.ok}</div>}
      <div className="grid-2">
        <Field label={t('Kata laluan baharu', 'New password')}><PasswordInput {...eye} minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" /></Field>
        <Field label={t('Sahkan kata laluan', 'Confirm password')}><PasswordInput {...eye} minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" /></Field>
      </div>
      <button className="btn btn-primary">{t('Simpan', 'Save')}</button>
    </form>
  );
}

// Register and remove passkeys (fingerprint / Face ID / screen lock) for the signed-in user.
export function Passkeys() {
  const t = useT();
  const errText = useErrorText();
  const { client, role } = usePortal();
  const [enabled, setEnabled] = useState(undefined); // undefined while checking the server
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const supported = passkeySupported();

  const isOff = (e) => /passkey_disabled|Passkeys are disabled/i.test(String(e?.code || '') + ' ' + String(e?.message || ''));

  async function load() {
    const { data, error } = await client.auth.passkey.list();
    if (error) { if (isOff(error)) setEnabled(false); else setErr(errText(error)); }
    else setList(data || []);
  }
  useEffect(() => {
    passkeysEnabled().then((on) => { setEnabled(on); if (on) load(); });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  async function add() {
    setBusy(true); setErr(''); setOk('');
    const { error } = await client.auth.registerPasskey();
    if (error) { if (isOff(error)) setEnabled(false); else setErr(errText(error)); }
    else { setOk(t('Cap jari / Face ID didaftarkan. Lain kali, tekan "Log masuk dengan cap jari / Face ID".', 'Fingerprint / Face ID set up. Next time, tap "Log in with fingerprint / Face ID".')); await load(); }
    setBusy(false);
  }
  async function remove(p) {
    if (!window.confirm(t('Buang log masuk cap jari ini?', 'Remove this fingerprint login?'))) return;
    const { error } = await client.auth.passkey.delete({ passkeyId: p.id });
    if (error) setErr(errText(error)); else load();
  }

  return (
    <div className="card">
      <h3 className="row"><FingerprintIcon /> {t('Log masuk cap jari / Face ID', 'Fingerprint / Face ID login')}</h3>
      <p className="small muted">{t('Gunakan cap jari, Face ID atau kunci skrin telefon/komputer ini untuk log masuk tanpa kata laluan. Daftar sekali pada setiap peranti.', 'Use the fingerprint, Face ID or screen lock of this phone or computer to log in without a password. Set it up once on each device.')}</p>
      {err && <div className="alert alert-error">{err}</div>}
      {ok && <div className="alert alert-ok">{ok}</div>}
      {list && list.length > 0 && (
        <ul className="passkey-list">
          {list.map((p) => (
            <li key={p.id}>
              <FingerprintIcon />
              <div><strong>{p.friendly_name || t('Peranti', 'Device')}</strong><div className="small muted">{t('Didaftar', 'Added')} {fmtDate(p.created_at)}{p.last_used_at ? ` · ${t('Terakhir digunakan', 'Last used')} ${fmtDate(p.last_used_at)}` : ''}</div></div>
              <span className="spacer" />
              <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>{t('Buang', 'Remove')}</button>
            </li>
          ))}
        </ul>
      )}
      {enabled === false && (
        <div className="alert alert-info small">
          <strong>{t('Log masuk cap jari / Face ID belum diaktifkan pada pelayan.', 'Fingerprint / Face ID login is not turned on in the server yet.')}</strong>{' '}
          {role === 'admin'
            ? t('Untuk mengaktifkannya: di projek Supabase, buka Authentication → Passkeys dan aktifkan. Jika menggunakan Supabase tempatan, mulakan semula dengan "npx supabase stop" kemudian "npx supabase start" supaya tetapan dalam supabase/config.toml dibaca.',
                'To turn it on: in your Supabase project, open Authentication → Passkeys and enable it. On a local Supabase, restart it with "npx supabase stop" then "npx supabase start" so it reads supabase/config.toml.')
            : t('Sila minta pentadbir mengaktifkannya.', 'Please ask the admin to turn it on.')}
        </div>
      )}
      {!supported && <div className="alert alert-info small">{t('Pelayar ini tidak menyokong log masuk cap jari / Face ID.', 'This browser does not support fingerprint / Face ID login.')}</div>}
      {supported && (
        <button className="btn btn-primary" onClick={add} disabled={busy || !enabled}>
          <FingerprintIcon /> {busy ? t('Menunggu cap jari / Face ID…', 'Waiting for fingerprint / Face ID…') : t('Daftar cap jari / Face ID pada peranti ini', 'Set up fingerprint / Face ID on this device')}
        </button>
      )}
    </div>
  );
}

export function AccountSecurity() {
  return <><Passkeys /><ChangePassword /></>;
}
