import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { getClient, configured, q } from '../lib/supabase.js';
import { signIn, passkeySupported } from '../lib/auth.js';
import { fmtDate } from '../lib/format.js';
import { useLang, useT, useErrorText } from '../lib/i18n.jsx';
import { Field, Spinner, ErrorBox, ToastProvider, PasswordInput, FingerprintIcon } from './ui.jsx';

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

// Wraps a portal: handles session, role check, login screen, header and tabs.
export function Portal({ role, title, accent, loginLabel, loginHint, tabs, children }) {
  const t = useT();
  const client = getClient(role);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [denied, setDenied] = useState(false);

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
      // Local sign-out only: a global one would also end this user's session in their own portal.
      if (!p || p.role !== role) { setDenied(true); await client.auth.signOut({ scope: 'local' }); setProfile(null); return; }
      setDenied(false);
      const s = await q(client.from('settings').select('*').eq('id', 1).maybeSingle()).catch(() => null);
      if (alive) { setSettings(s); setProfile(p); }
    })();
    return () => { alive = false; };
  }, [session, client, role]);

  if (!configured) return <NotConfigured />;
  if (session === undefined || (session && !profile)) return <div className="center-page"><Spinner /></div>;
  if (!session) return <Login client={client} role={role} title={title} accent={accent} loginLabel={loginLabel} loginHint={loginHint} denied={denied} />;

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

function Login({ client, title, accent, loginLabel, loginHint, denied }) {
  const t = useT();
  const errText = useErrorText();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(denied ? errText('wrong_role') : '');
  const canPasskey = passkeySupported();

  // On success the Portal takes over; it signs out again (and shows `denied`) if the role is wrong.
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await signIn(client, id, pw); } catch (e2) { setErr(errText(e2)); setBusy(false); }
  }

  async function passkey() {
    setBusy(true); setErr('');
    const { error } = await client.auth.signInWithPasskey();
    if (error) { setErr(errText(error)); setBusy(false); }
  }

  return (
    <div className={'login-page portal-' + accent}>
      <div className="login-top"><Link to="/" className="back">← {t('Semua portal', 'All portals')}</Link><LangToggle /></div>
      <form className="card login-card" onSubmit={submit}>
        <img src="/favicon.svg" alt="" width="52" height="52" />
        <h1>KhairatPlus</h1>
        <p className="login-sub">{title}</p>
        <ErrorBox>{err}</ErrorBox>
        <Field label={loginLabel} hint={loginHint}>
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username webauthn" required autoFocus inputMode="email" autoCapitalize="none" />
        </Field>
        <Field label={t('Kata laluan', 'Password')}>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required
            showLabel={t('Tunjuk kata laluan', 'Show password')} hideLabel={t('Sembunyi kata laluan', 'Hide password')} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('Sedang log masuk…', 'Signing in…') : t('Log masuk', 'Log in')}</button>
        {canPasskey && (
          <>
            <div className="divider">{t('atau', 'or')}</div>
            <button type="button" className="btn btn-block btn-passkey" onClick={passkey} disabled={busy}>
              <FingerprintIcon /> {t('Log masuk dengan cap jari / Face ID', 'Log in with fingerprint / Face ID')}
            </button>
            <p className="small muted" style={{ marginTop: 8 }}>{t('Daftar cap jari dahulu di halaman akaun selepas log masuk.', 'Set up fingerprint first on your account page after logging in.')}</p>
          </>
        )}
      </form>
    </div>
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
  const { client } = usePortal();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const supported = passkeySupported();

  async function load() {
    const { data, error } = await client.auth.passkey.list();
    if (error) setErr(errText(error)); else setList(data || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function add() {
    setBusy(true); setErr(''); setOk('');
    const { error } = await client.auth.registerPasskey();
    if (error) setErr(errText(error));
    else { setOk(t('Cap jari didaftarkan. Lain kali, tekan "Log masuk dengan cap jari".', 'Fingerprint registered. Next time, tap "Log in with fingerprint".')); await load(); }
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
      {supported
        ? <button className="btn btn-primary" onClick={add} disabled={busy}>{t('Daftar cap jari peranti ini', 'Set up fingerprint on this device')}</button>
        : <div className="alert alert-info small">{t('Pelayar ini tidak menyokong log masuk cap jari.', 'This browser does not support fingerprint login.')}</div>}
    </div>
  );
}

export function AccountSecurity() {
  return <><Passkeys /><ChangePassword /></>;
}
