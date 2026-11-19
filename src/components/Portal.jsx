import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { getClient, configured, q } from '../lib/supabase.js';
import { toEmail } from '../lib/auth.js';
import { useLang, useT, useErrorText } from '../lib/i18n.jsx';
import { Field, Spinner, ErrorBox, ToastProvider } from './ui.jsx';

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
      if (!p || p.role !== role) { setDenied(true); await client.auth.signOut(); setProfile(null); return; }
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

  // On success the Portal takes over; it signs out again (and shows `denied`) if the role is wrong.
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await client.auth.signInWithPassword({ email: toEmail(id), password: pw });
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
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required autoFocus />
        </Field>
        <Field label={t('Kata laluan', 'Password')}>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('Sedang log masuk…', 'Signing in…') : t('Log masuk', 'Log in')}</button>
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
        <Field label={t('Kata laluan baharu', 'New password')}><input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        <Field label={t('Sahkan kata laluan', 'Confirm password')}><input type="password" minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} required /></Field>
      </div>
      <button className="btn btn-primary">{t('Simpan', 'Save')}</button>
    </form>
  );
}
