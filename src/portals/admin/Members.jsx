import React, { useMemo, useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, Search, Badge, PasswordInput, IcInput } from '../../components/ui.jsx';
import { MemberProfile, DependentsTable, PaymentsTable, MonthGrid } from '../../components/MemberDetail.jsx';
import { useT, useErrorText, useLabel, STATUS } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { adminFn } from '../../lib/adminFn.js';
import { rm, fmtDate, thisYear, arrearsFor, icDigits, fmtIc, icSearchText } from '../../lib/format.js';
import { loadAll, sum } from './data.js';

export default function Members() {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const [search, setSearch] = useState('');
  const [amilFilter, setAmilFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [edit, setEdit] = useState(null);
  const [viewId, setViewId] = useState(null);
  const { data, loading, error, reload } = useLoad(() => loadAll(client, ['members', 'amils', 'payments', 'dependents']), []);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.toLowerCase();
    return data.members
      .filter((m) => !s || [m.member_no, m.full_name, icSearchText(m.ic_no), m.address, m.phone].join(' ').toLowerCase().includes(s))
      .filter((m) => !amilFilter || (amilFilter === 'none' ? !m.amil_id : m.amil_id === amilFilter))
      .filter((m) => !statusFilter || (statusFilter === 'arrears' ? arrearsFor(m, data.payments).length > 0 : m.status === statusFilter));
  }, [data, search, amilFilter, statusFilter]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;
  const amilName = (id) => data.amils.find((a) => a.id === id)?.full_name || '';

  return (
    <>
      <div className="page-head">
        <h2>{t('Senarai ahli', 'Members')} <span className="muted small">({rows.length}/{data.members.length})</span></h2>
        <button className="btn btn-primary" onClick={() => setEdit({})}>+ {t('Daftar ahli', 'Register member')}</button>
      </div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <Search value={search} onChange={setSearch} placeholder={t('Cari ID, nama, KP, alamat…', 'Search ID, name, IC, address…')} />
        <select value={amilFilter} onChange={(e) => setAmilFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t('Semua amil', 'All amil')}</option>
          {data.amils.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          <option value="none">{t('Tiada amil', 'No amil')}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t('Semua status', 'All statuses')}</option>
          <option value="active">{t('Aktif', 'Active')}</option>
          <option value="arrears">{t('Tertunggak', 'In arrears')}</option>
          <option value="inactive">{t('Tidak aktif', 'Inactive')}</option>
          <option value="deceased">{t('Meninggal dunia', 'Deceased')}</option>
        </select>
      </div>
      {rows.length === 0 ? <div className="card"><Empty>{t('Tiada ahli dijumpai.', 'No members found.')}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('ID Ahli', 'Member ID')}</th><th>{t('Nama penuh', 'Full name')}</th><th>{t('Lokasi rumah', 'House location')}</th><th className="hide-sm">Amil</th><th className="num">{t('Tanggungan', 'Dependents')}</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((m) => {
                const owed = arrearsFor(m, data.payments).length;
                return (
                  <tr key={m.id} className="clickable" onClick={() => setViewId(m.id)}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong>{m.member_no}</strong></td>
                    <td>{m.full_name}<div className="small muted">{fmtIc(m.ic_no)}</div></td>
                    <td className="small">{m.address || '-'}</td>
                    <td className="hide-sm small">{amilName(m.amil_id) || <span className="muted">-</span>}</td>
                    <td className="num">{data.dependents.filter((d) => d.member_id === m.id).length}</td>
                    <td><Badge status={m.status} />{owed > 0 && <div><span className="badge badge-arrears">{t(`Tertunggak ${owed} bln`, `${owed} mo owed`)}</span></div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {viewId && <MemberView id={viewId} data={data} onClose={() => setViewId(null)} onEdit={(m) => { setViewId(null); setEdit(m); }} />}
      {edit && <MemberForm member={edit} amils={data.amils} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function MemberView({ id, data, onClose, onEdit }) {
  const t = useT();
  const [year, setYear] = useState(thisYear());
  const m = data.members.find((x) => x.id === id);
  const deps = data.dependents.filter((d) => d.member_id === id);
  const pays = data.payments.filter((p) => p.member_id === id).sort((a, b) => b.year - a.year || b.month - a.month);
  const amil = data.amils.find((a) => a.id === m.amil_id);
  return (
    <Modal size="lg" title={t('Profil ahli', 'Member profile')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Tutup', 'Close')}</button><button className="btn btn-primary" onClick={() => onEdit(m)}>{t('Sunting ahli', 'Edit member')}</button></>}>
      <MemberProfile member={m} amilName={amil ? `${amil.full_name}${amil.phone ? ' · ' + amil.phone : ''}` : ''} />
      <h4 className="section-title">{t('Tanggungan', 'Dependents')} ({deps.length})</h4>
      <DependentsTable dependents={deps} />
      <div className="row"><h4 className="section-title">{t('Bayaran', 'Payments')}</h4><span className="spacer" />
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
          {[thisYear() + 1, thisYear(), thisYear() - 1, thisYear() - 2].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}><MonthGrid payments={pays} year={year} joinDate={m.join_date} status={m.status} /></div>
      <p className="small muted">{t('Jumlah dibayar', 'Total paid')}: <strong>{rm(sum(pays.filter((p) => p.status === 'paid')))}</strong></p>
      <PaymentsTable payments={pays.slice(0, 24)} />
    </Modal>
  );
}

function MemberForm({ member, amils, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const label = useLabel();
  const { client } = usePortal();
  const toast = useToast();
  const isNew = !member.id;
  const { values, bind } = useForm({ full_name: '', ic_no: '', phone: '', email: '', address: '', map_url: '', amil_id: '', status: 'active', join_date: new Date().toISOString().slice(0, 10), password: '', ...member, email: member.email || '', amil_id: member.amil_id || '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const fields = { full_name: values.full_name.trim(), ic_no: icDigits(values.ic_no), phone: values.phone, address: values.address, map_url: values.map_url, amil_id: values.amil_id || null, join_date: values.join_date };
      if (isNew) {
        const res = await adminFn(client, { action: 'create_member', password: values.password, member: { ...fields, email: values.email.trim().toLowerCase() } });
        setCreated({ ...res.member, password: values.password });
      } else {
        const upd = { ...fields };
        if (member.status !== 'deceased') upd.status = values.status;
        await q(client.from('members').update(upd).eq('id', member.id));
        if (member.user_id) await q(client.from('profiles').update({ full_name: fields.full_name }).eq('id', member.user_id));
        if (values.email.trim().toLowerCase() !== (member.email || '')) await adminFn(client, { action: 'set_email', role: 'ahli', id: member.id, email: values.email.trim().toLowerCase() });
        if (values.password) await adminFn(client, { action: 'set_password', role: 'ahli', id: member.id, password: values.password });
        toast(t('Maklumat ahli disimpan.', 'Member saved.'));
        onSaved();
      }
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  if (created) {
    return (
      <Modal title={t('Ahli berjaya didaftarkan', 'Member registered')} onClose={onSaved} footer={<button className="btn btn-primary" onClick={onSaved}>{t('Selesai', 'Done')}</button>}>
        <p>{t('Berikan maklumat log masuk ini kepada ahli:', 'Give these login details to the member:')}</p>
        <dl className="dl card" style={{ boxShadow: 'none' }}>
          <dt>{t('ID Ahli', 'Member ID')}</dt><dd><strong style={{ fontSize: '1.2rem' }}>{created.member_no}</strong></dd>
          {created.email && <><dt>{t('Atau e-mel', 'Or email')}</dt><dd>{created.email}</dd></>}
          <dt>{t('Kata laluan', 'Password')}</dt><dd><code>{created.password}</code></dd>
          <dt>Portal</dt><dd>{window.location.origin}/ahli</dd>
        </dl>
        <p className="small muted">{t('Ahli boleh menukar kata laluan selepas log masuk.', 'The member can change the password after logging in.')}</p>
      </Modal>
    );
  }

  return (
    <Modal size="lg" title={isNew ? t('Daftar ahli baharu', 'Register new member') : `${t('Sunting ahli', 'Edit member')} · ${member.member_no}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="member-form" disabled={busy}>{t('Simpan', 'Save')}</button></>}>
      <form id="member-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        {isNew && <div className="alert alert-info small">{t('ID Ahli (cth. KWMZ-0004) dijana secara automatik dan digunakan untuk log masuk.', 'The Member ID (e.g. KWMZ-0004) is generated automatically and used to log in.')}</div>}
        <div className="grid-2">
          <Field label={t('Nama penuh', 'Full name')} wide><input {...bind('full_name')} required /></Field>
          <Field label={t('No. KP', 'IC no.')}><IcInput {...bind('ic_no')} placeholder="800212-03-5233" /></Field>
          <Field label={t('Telefon', 'Phone')}><input {...bind('phone')} type="tel" /></Field>
          <Field label={t('E-mel log masuk (pilihan)', 'Login email (optional)')} hint={t('Ahli boleh log masuk dengan e-mel ini atau ID Ahli', 'The member can log in with this email or the Member ID')} wide><input {...bind('email')} type="email" /></Field>
          <Field label={t('Lokasi rumah (alamat)', 'House location (address)')} wide><textarea {...bind('address')} placeholder="Lot 12, Lorong Masjid, Kg Wakaf Mek Zainab" /></Field>
          <Field label={t('Pautan peta (pilihan)', 'Map link (optional)')} hint={t('Google Maps atau Waze', 'Google Maps or Waze')} wide><input {...bind('map_url')} type="url" placeholder="https://maps.google.com/…" /></Field>
          <Field label={t('Amil yang menjaga', 'Assigned amil')}>
            <select {...bind('amil_id')}>
              <option value="">{t('— Belum ditetapkan —', '— Not assigned —')}</option>
              {amils.map((a) => <option key={a.id} value={a.id}>{a.full_name}{a.area ? ` (${a.area})` : ''}</option>)}
            </select>
          </Field>
          <Field label={t('Tarikh sertai', 'Join date')}><input {...bind('join_date')} type="date" /></Field>
          {!isNew && (
            <Field label="Status">
              {member.status === 'deceased' ? <input value={label(STATUS, 'deceased') + ' · ' + fmtDate(member.death_date)} disabled /> : (
                <select {...bind('status')}><option value="active">{label(STATUS, 'active')}</option><option value="inactive">{label(STATUS, 'inactive')}</option></select>
              )}
            </Field>
          )}
          <Field label={isNew ? t('Kata laluan awal', 'Initial password') : t('Kata laluan baharu (kosongkan jika tiada perubahan)', 'New password (leave blank to keep)')}>
            <PasswordInput {...bind('password')} minLength={6} required={isNew} autoComplete="new-password" showLabel={t('Tunjuk kata laluan', 'Show password')} hideLabel={t('Sembunyi kata laluan', 'Hide password')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
