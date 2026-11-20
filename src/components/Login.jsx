import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getClient, configured, q } from '../lib/supabase.js';
import { signIn, passkeySupported, passkeysEnabled, roleHome } from '../lib/auth.js';
import { useT, useErrorText } from '../lib/i18n.jsx';
import { Field, Spinner, ErrorBox, PasswordInput, FingerprintIcon } from './ui.jsx';
import { LangToggle, NotConfigured } from './Portal.jsx';

// The only way in: one login page for admin, amil and ahli. After sign-in the
// account's role (profiles.role) decides which portal the user is sent to.
export default function LoginPage() {
  const t = useT();
  const errText = useErrorText();
  const location = useLocation();
  const client = getClient();
  const [session, setSession] = useState(undefined);
  const [target, setTarget] = useState(null);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(location.state?.error ? errText(location.state.error) : '');
  const [passkeyOn, setPasskeyOn] = useState(false);
  const canPasskey = passkeySupported() && passkeyOn;
  useEffect(() => { if (configured && passkeySupported()) passkeysEnabled().then(setPasskeyOn); }, []);

  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [client]);

  // Signed in (by password, fingerprint, or an earlier visit): look up the role and go.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      const p = await q(client.from('profiles').select('role').eq('id', session.user.id).maybeSingle()).catch(() => null);
      if (!alive) return;
      if (!p?.role) {
        await client.auth.signOut({ scope: 'local' });
        setErr(errText('no_role')); setBusy(false);
        return;
      }
      const home = roleHome(p.role);
      const from = location.state?.from;
      // Return to the page they first asked for, if it belongs to their own portal.
      setTarget(from && (from === home || from.startsWith(home + '/')) ? from : home);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, client]);

  if (!configured) return <NotConfigured />;
  if (target) return <Navigate to={target} replace />;
  if (session !== null) return <div className="center-page"><Spinner /></div>;

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
    <div className="login-page">
      <div className="login-top"><span /><LangToggle /></div>
      <form className="card login-card" onSubmit={submit}>
        <img src="/favicon.svg" alt="" width="52" height="52" />
        <h1>KhairatPlus</h1>
        <p className="login-sub">{t('Khairat Kematian Kampung Wakaf Mek Zainab', 'Kampung Wakaf Mek Zainab Bereavement Fund')}</p>
        <ErrorBox>{err}</ErrorBox>
        <Field label={t('E-mel, ID Ahli atau nama pengguna', 'Email, Member ID or username')}
          hint={t('Contoh: ali@gmail.com, KWMZ-0001 atau amil1', 'Example: ali@gmail.com, KWMZ-0001 or amil1')}>
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
            <p className="small muted" style={{ marginTop: 8 }}>{t('Daftar cap jari / Face ID dahulu di halaman akaun selepas log masuk.', 'Set up fingerprint / Face ID first on your account page after logging in.')}</p>
          </>
        )}
      </form>
    </div>
  );
}
