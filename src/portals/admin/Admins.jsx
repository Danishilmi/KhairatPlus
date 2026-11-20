import React, { useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, PasswordInput } from '../../components/ui.jsx';
import { useT, useErrorText } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { adminFn } from '../../lib/adminFn.js';
import { fmtDate } from '../../lib/format.js';

// List, add and remove admin accounts. Admins log in with their email.
export default function Admins() {
  const t = useT();
  const errText = useErrorText();
  const { client, session } = usePortal();
  const toast = useToast();
  const [edit, setEdit] = useState(null); // null | {} new | admin profile
  const { data, loading, error, reload } = useLoad(
    () => q(client.from('profiles').select('id, full_name, username, created_at').eq('role', 'admin').order('created_at')), []
  );

  async function remove(a) {
    if (!window.confirm(t(`Padam pentadbir ${a.full_name || a.username}?`, `Delete admin ${a.full_name || a.username}?`))) return;
    try { await adminFn(client, { action: 'delete_admin', id: a.id }); toast(t('Pentadbir dipadam.', 'Admin deleted.')); reload(); }
    catch (e) { toast(errText(e), 'err'); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;

  return (
    <>
      <div className="page-head">
        <h2>{t('Pentadbir', 'Admins')}</h2>
        <button className="btn btn-primary" onClick={() => setEdit({})}>+ {t('Tambah pentadbir', 'Add admin')}</button>
      </div>
      <p className="muted small">{t('Pentadbir boleh mengurus ahli, amil, bayaran khairat, kewangan dan tetapan. Mereka log masuk dengan e-mel di halaman log masuk yang sama.', 'Admins can manage members, amil, payouts, finance and settings. They log in with their email on the same login page.')}</p>
      {data.length === 0 ? <div className="card"><Empty>{t('Tiada pentadbir.', 'No admins.')}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Nama', 'Name')}</th><th>{t('E-mel log masuk', 'Login email')}</th><th>{t('Ditambah', 'Added')}</th><th /></tr></thead>
            <tbody>
              {data.map((a) => {
                const me = a.id === session.user.id;
                return (
                  <tr key={a.id}>
                    <td><strong>{a.full_name || '-'}</strong> {me && <span className="small muted">({t('anda', 'you')})</span>}</td>
                    <td><code>{a.username}</code></td>
                    <td>{fmtDate(a.created_at)}</td>
                    <td className="num">
                      {!me && <><button className="btn btn-sm" onClick={() => setEdit(a)}>{t('Tukar kata laluan', 'Reset password')}</button> <button className="btn btn-sm btn-danger" onClick={() => remove(a)} disabled={data.length <= 1}>{t('Padam', 'Delete')}</button></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <AdminForm admin={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function AdminForm({ admin, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const toast = useToast();
  const isNew = !admin.id;
  const { values, bind } = useForm({ full_name: '', email: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const eye = { showLabel: t('Tunjuk kata laluan', 'Show password'), hideLabel: t('Sembunyi kata laluan', 'Hide password') };

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (values.password !== values.password2) return setErr(t('Kata laluan tidak sepadan.', 'Passwords do not match.'));
    setBusy(true);
    try {
      if (isNew) {
        await adminFn(client, { action: 'create_admin', password: values.password, admin: { full_name: values.full_name.trim(), email: values.email.trim().toLowerCase() } });
        toast(t('Pentadbir ditambah.', 'Admin added.'));
      } else {
        await adminFn(client, { action: 'set_password', role: 'admin', id: admin.id, password: values.password });
        toast(t('Kata laluan dikemas kini.', 'Password updated.'));
      }
      onSaved();
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  return (
    <Modal title={isNew ? t('Tambah pentadbir', 'Add admin') : t('Tukar kata laluan pentadbir', 'Reset admin password')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="admin-form" disabled={busy}>{t('Simpan', 'Save')}</button></>}>
      <form id="admin-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        {!isNew && <p className="small muted">{admin.full_name} · <code>{admin.username}</code></p>}
        <div className="grid-2">
          {isNew && <Field label={t('Nama penuh', 'Full name')} wide><input {...bind('full_name')} required /></Field>}
          {isNew && <Field label={t('E-mel log masuk', 'Login email')} wide><input {...bind('email')} type="email" required autoComplete="off" /></Field>}
          <Field label={t('Kata laluan', 'Password')}><PasswordInput {...eye} {...bind('password')} minLength={6} required autoComplete="new-password" /></Field>
          <Field label={t('Sahkan kata laluan', 'Confirm password')}><PasswordInput {...eye} {...bind('password2')} minLength={6} required autoComplete="new-password" /></Field>
        </div>
      </form>
    </Modal>
  );
}
