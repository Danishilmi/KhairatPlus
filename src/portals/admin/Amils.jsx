import React, { useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, Search, PasswordInput, IcInput } from '../../components/ui.jsx';
import { useT, useErrorText } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { useDobFromIc } from '../../lib/icDate.js';
import { adminFn } from '../../lib/adminFn.js';
import { icDigits, fmtIc } from '../../lib/format.js';

export default function Amils() {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const toast = useToast();
  const [edit, setEdit] = useState(null); // null | {} new | amil
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useLoad(async () => {
    const [amils, members] = await Promise.all([q(client.from('amils').select('*').order('full_name')), q(client.from('members').select('id, amil_id'))]);
    return { amils, members };
  }, []);

  async function remove(a) {
    if (!window.confirm(t(`Padam amil ${a.full_name}?`, `Delete amil ${a.full_name}?`))) return;
    try {
      if (data.members.some((m) => m.amil_id === a.id)) throw new Error('amil_has_members');
      await adminFn(client, { action: 'delete_amil', id: a.id });
      toast(t('Amil dipadam.', 'Amil deleted.')); reload();
    } catch (e) { toast(errText(e), 'err'); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;
  const s = search.toLowerCase();
  const list = data.amils.filter((a) => !s || [a.full_name, a.username, a.area, a.phone].join(' ').toLowerCase().includes(s));

  return (
    <>
      <div className="page-head">
        <h2>Amil</h2>
        <div className="toolbar">
          <Search value={search} onChange={setSearch} placeholder={t('Cari amil…', 'Search amil…')} />
          <button className="btn btn-primary" onClick={() => setEdit({})}>+ {t('Tambah amil', 'Add amil')}</button>
        </div>
      </div>
      {list.length === 0 ? <div className="card"><Empty>{t('Belum ada amil. Tambah amil pertama.', 'No amil yet. Add the first one.')}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Nama', 'Name')}</th><th>{t('Nama pengguna', 'Username')}</th><th>{t('Telefon', 'Phone')}</th><th>{t('Kawasan', 'Area')}</th><th className="num">{t('Ahli', 'Members')}</th><th /></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.full_name}</strong><div className="small muted">{fmtIc(a.ic_no)}</div></td>
                  <td><code>{a.username}</code></td>
                  <td>{a.phone || '-'}</td>
                  <td>{a.area || '-'}</td>
                  <td className="num">{data.members.filter((m) => m.amil_id === a.id).length}</td>
                  <td className="num"><button className="btn btn-sm" onClick={() => setEdit(a)}>{t('Sunting', 'Edit')}</button> <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>{t('Padam', 'Delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <AmilForm amil={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function AmilForm({ amil, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const toast = useToast();
  const isNew = !amil.id;
  const { values, bind, setValues } = useForm({ full_name: '', ic_no: '', phone: '', email: '', area: '', username: '', password: '', ...amil, password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useDobFromIc(values.ic_no, setValues);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const email = values.email.trim().toLowerCase();
      const fields = { full_name: values.full_name.trim(), ic_no: icDigits(values.ic_no), phone: values.phone, area: values.area };
      if (isNew) {
        const res = await adminFn(client, { action: 'create_amil', password: values.password, amil: { ...fields, email, username: values.username.trim().toLowerCase() } });
        if (values.dob && res.amil?.id) await q(client.from('amils').update({ dob: values.dob }).eq('id', res.amil.id));
      } else {
        await q(client.from('amils').update({ ...fields, dob: values.dob || null }).eq('id', amil.id));
        await q(client.from('profiles').update({ full_name: fields.full_name }).eq('id', amil.user_id));
        if (email !== (amil.email || '')) await adminFn(client, { action: 'set_email', role: 'amil', id: amil.id, email });
        if (values.password) await adminFn(client, { action: 'set_password', role: 'amil', id: amil.id, password: values.password });
      }
      toast(isNew ? t('Amil ditambah.', 'Amil added.') : t('Maklumat amil disimpan.', 'Amil saved.'));
      onSaved();
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  return (
    <Modal title={isNew ? t('Tambah amil', 'Add amil') : t('Sunting amil', 'Edit amil')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="amil-form" disabled={busy}>{t('Simpan', 'Save')}</button></>}>
      <form id="amil-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        <div className="grid-2">
          <Field label={t('Nama penuh', 'Full name')} wide><input {...bind('full_name')} required /></Field>
          <Field label={t('No. KP', 'IC no.')}><IcInput {...bind('ic_no')} placeholder="700101-03-5011" /></Field>
          <Field label={t('Telefon', 'Phone')}><input {...bind('phone')} type="tel" /></Field>
          <Field label={t('Tarikh lahir', 'Date of birth')} hint={t('Diisi automatik daripada No. KP', 'Filled in from the IC no.')}><input type="date" {...bind('dob')} /></Field>
          <Field label={t('E-mel log masuk (pilihan)', 'Login email (optional)')} hint={t('Amil boleh log masuk dengan e-mel ini atau nama pengguna', 'The amil can log in with this email or the username')}><input {...bind('email')} type="email" /></Field>
          <Field label={t('Kawasan jagaan', 'Area covered')}><input {...bind('area')} placeholder="Lorong Masjid" /></Field>
          <Field label={t('Nama pengguna (untuk log masuk)', 'Username (for login)')} hint={isNew ? t('Huruf kecil, contoh: ahmad.ismail', 'Lowercase, e.g. ahmad.ismail') : t('Tidak boleh diubah', 'Cannot be changed')}>
            <input {...bind('username')} required={isNew} disabled={!isNew} pattern="[a-zA-Z0-9._\-]{3,30}" />
          </Field>
          <Field label={isNew ? t('Kata laluan', 'Password') : t('Kata laluan baharu (kosongkan jika tiada perubahan)', 'New password (leave blank to keep)')}>
            <PasswordInput {...bind('password')} minLength={6} required={isNew} autoComplete="new-password" showLabel={t('Tunjuk kata laluan', 'Show password')} hideLabel={t('Sembunyi kata laluan', 'Hide password')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
