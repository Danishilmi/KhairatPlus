import React, { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Portal, usePortal, AccountSecurity } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, Badge } from '../../components/ui.jsx';
import { MemberProfile, DependentsTable, PaymentsTable, MonthGrid, initials } from '../../components/MemberDetail.jsx';
import { useT, useErrorText, useLabel, useMonths, RELATIONSHIPS } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { rm, thisYear, arrearsFor } from '../../lib/format.js';

export default function AhliPortal() {
  const t = useT();
  const tabs = [
    { to: '/ahli', end: true, label: t('Profil saya', 'My profile') },
    { to: '/ahli/tanggungan', label: t('Tanggungan', 'Dependents') },
    { to: '/ahli/bayar', label: t('Bayar yuran', 'Pay fees') },
    { to: '/ahli/amil', label: t('Amil saya', 'My amil') }
  ];
  return (
    <Portal role="ahli" accent="ahli" title={t('Portal Ahli', 'Member Portal')} loginLabel={t('E-mel atau ID Ahli', 'Email or Member ID')} loginHint={t('Contoh: ali@gmail.com atau KWMZ-0001', 'Example: ali@gmail.com or KWMZ-0001')} tabs={tabs}>
      <MemberData>
        {(ctx) => (
          <Routes>
            <Route index element={<Profile {...ctx} />} />
            <Route path="tanggungan" element={<Dependents {...ctx} />} />
            <Route path="bayar" element={<Pay {...ctx} />} />
            <Route path="amil" element={<MyAmil {...ctx} />} />
            <Route path="*" element={<Navigate to="/ahli" replace />} />
          </Routes>
        )}
      </MemberData>
    </Portal>
  );
}

// Loads the signed-in member, their dependents, payments and amil (RLS limits each to their own rows).
function MemberData({ children }) {
  const { client, session } = usePortal();
  const errText = useErrorText();
  const res = useLoad(async () => {
    const member = await q(client.from('members').select('*').eq('user_id', session.user.id).single());
    const [dependents, payments, amil] = await Promise.all([
      q(client.from('dependents').select('*').eq('member_id', member.id).order('created_at')),
      q(client.from('payments').select('*').eq('member_id', member.id).order('year', { ascending: false }).order('month', { ascending: false })),
      member.amil_id ? q(client.from('amils').select('full_name, phone, email, area, ic_no').eq('id', member.amil_id).maybeSingle()) : null
    ]);
    return { member, dependents, payments, amil };
  }, []);
  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox>{errText(res.error)}</ErrorBox>;
  return children({ ...res.data, reload: res.reload });
}

function Profile({ member, payments, dependents, amil, reload }) {
  const t = useT();
  const months = useMonths();
  const [editing, setEditing] = useState(false);
  const owed = arrearsFor(member, payments);
  return (
    <>
      <div className="page-head"><h2>{t('Profil saya', 'My profile')}</h2><button className="btn btn-primary" onClick={() => setEditing(true)}>{t('Kemas kini profil', 'Edit profile')}</button></div>
      {owed.length > 0 && member.status === 'active' && (
        <div className="alert alert-error">{t(`Anda mempunyai ${owed.length} bulan tertunggak (${owed.map((m) => months[m - 1]).join(', ')}).`, `You have ${owed.length} month(s) unpaid (${owed.map((m) => months[m - 1]).join(', ')}).`)} <Link to="/ahli/bayar">{t('Bayar sekarang', 'Pay now')} →</Link></div>
      )}
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card"><MemberProfile member={member} amilName={amil?.full_name || ''} /></div>
        <div className="card">
          <h3>{t(`Status bayaran ${thisYear()}`, `Payment status ${thisYear()}`)}</h3>
          <div style={{ overflowX: 'auto' }}><MonthGrid payments={payments} year={thisYear()} joinDate={member.join_date} status={member.status} /></div>
          <p className="small muted">{t('Tanggungan berdaftar', 'Registered dependents')}: <strong>{dependents.length}</strong></p>
        </div>
      </div>
      <AccountSecurity />
      {editing && <ProfileForm member={member} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}

function ProfileForm({ member, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const { client, session } = usePortal();
  const toast = useToast();
  const { values, bind } = useForm(member);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await q(client.from('members').update({ full_name: values.full_name.trim(), ic_no: values.ic_no, phone: values.phone, address: values.address, map_url: values.map_url }).eq('id', member.id));
      await q(client.from('profiles').update({ full_name: values.full_name.trim() }).eq('id', session.user.id)).catch(() => {});
      toast(t('Profil dikemas kini.', 'Profile updated.')); onSaved();
    } catch (e2) { setErr(errText(e2)); }
  }
  return (
    <Modal title={t('Kemas kini profil', 'Edit profile')} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="profile-form">{t('Simpan', 'Save')}</button></>}>
      <form id="profile-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        <div className="grid-2">
          <Field label={t('Nama penuh', 'Full name')} wide><input {...bind('full_name')} required /></Field>
          <Field label={t('No. KP', 'IC no.')}><input {...bind('ic_no')} /></Field>
          <Field label={t('Telefon', 'Phone')}><input type="tel" {...bind('phone')} /></Field>
          <Field label={t('Lokasi rumah (alamat)', 'House location (address)')} wide><textarea {...bind('address')} /></Field>
          <Field label={t('Pautan peta (pilihan)', 'Map link (optional)')} wide hint={t('Kongsi lokasi dari Google Maps / Waze', 'Share your location from Google Maps / Waze')}><input type="url" {...bind('map_url')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function Dependents({ member, dependents, reload }) {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  async function remove(d) {
    if (!window.confirm(t(`Padam ${d.full_name}?`, `Delete ${d.full_name}?`))) return;
    try { await q(client.from('dependents').delete().eq('id', d.id)); toast(t('Tanggungan dipadam.', 'Dependent deleted.')); reload(); }
    catch (e) { toast(errText(e), 'err'); }
  }
  return (
    <>
      <div className="page-head"><h2>{t('Tanggungan saya', 'My dependents')}</h2><button className="btn btn-primary" onClick={() => setEdit({})}>+ {t('Tambah tanggungan', 'Add dependent')}</button></div>
      <p className="muted small">{t('Daftarkan pasangan, anak dan ahli keluarga di bawah tanggungan anda supaya mereka dilindungi oleh khairat kematian.', 'Register your spouse, children and other family members you support so they are covered by the bereavement fund.')}</p>
      <DependentsTable dependents={dependents} onEdit={(d) => (d.status === 'deceased' ? null : setEdit(d))} onDelete={remove} />
      {edit && <DependentForm memberId={member.id} dep={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function DependentForm({ memberId, dep, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const label = useLabel();
  const { client } = usePortal();
  const toast = useToast();
  const isNew = !dep.id;
  const { values, bind } = useForm({ full_name: '', ic_no: '', relationship: 'child', dob: '', phone: '', ...dep });
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr('');
    const row = { full_name: values.full_name.trim(), ic_no: values.ic_no, relationship: values.relationship, dob: values.dob || null, phone: values.phone };
    try {
      if (isNew) await q(client.from('dependents').insert({ ...row, member_id: memberId }));
      else await q(client.from('dependents').update(row).eq('id', dep.id));
      toast(t('Tanggungan disimpan.', 'Dependent saved.')); onSaved();
    } catch (e2) { setErr(errText(e2)); }
  }
  return (
    <Modal title={isNew ? t('Tambah tanggungan', 'Add dependent') : t('Sunting tanggungan', 'Edit dependent')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="dep-form">{t('Simpan', 'Save')}</button></>}>
      <form id="dep-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        <div className="grid-2">
          <Field label={t('Nama penuh', 'Full name')} wide><input {...bind('full_name')} required /></Field>
          <Field label={t('No. KP / Sijil lahir', 'IC / birth cert no.')}><input {...bind('ic_no')} /></Field>
          <Field label={t('Hubungan', 'Relationship')}>
            <select {...bind('relationship')}>{Object.keys(RELATIONSHIPS).map((r) => <option key={r} value={r}>{label(RELATIONSHIPS, r)}</option>)}</select>
          </Field>
          <Field label={t('Tarikh lahir', 'Date of birth')}><input type="date" {...bind('dob')} /></Field>
          <Field label={t('Telefon (pilihan)', 'Phone (optional)')}><input type="tel" {...bind('phone')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function Pay({ member, payments, reload }) {
  const t = useT();
  const errText = useErrorText();
  const months = useMonths();
  const { client, settings } = usePortal();
  const toast = useToast();
  const [year, setYear] = useState(thisYear());
  const [selected, setSelected] = useState(() => arrearsFor(member, payments).filter((m) => !payments.some((p) => p.year === thisYear() && p.month === m && p.status === 'pending')));
  const [qr, setQr] = useState(null);
  const [refNo, setRefNo] = useState('');
  const [busy, setBusy] = useState(false);
  const fee = Number(settings?.monthly_fee || 0);
  const byMonth = Object.fromEntries(payments.filter((p) => p.year === year).map((p) => [p.month, p]));
  const total = selected.length * fee;
  const ref = `${member.member_no}-${year}-${selected.slice().sort((a, b) => a - b).join('.')}`;

  function toggle(m) {
    if (byMonth[m]?.status === 'paid' || byMonth[m]?.status === 'pending') return;
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
    setQr(null);
  }

  async function showQr() {
    if (settings?.qr_image) return setQr({ src: settings.qr_image, official: true });
    const text = [settings?.org_name, settings?.bank_name && `Bank: ${settings.bank_name}`, settings?.account_no && `Akaun: ${settings.account_no}`, settings?.account_name && `Nama: ${settings.account_name}`, `Rujukan: ${ref}`, `Jumlah: RM${total.toFixed(2)}`].filter(Boolean).join('\n');
    setQr({ src: await QRCode.toDataURL(text, { margin: 1, width: 320 }), official: false });
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try {
      await q(client.rpc('submit_qr_payment', { p_year: year, p_months: selected, p_reference: refNo }));
      toast(t('Bayaran dihantar. Amil anda akan mengesahkannya.', 'Payment submitted. Your amil will verify it.'));
      setSelected([]); setQr(null); setRefNo(''); reload();
    } catch (e2) { toast(errText(e2), 'err'); }
    setBusy(false);
  }

  if (member.status !== 'active') return <div className="card"><Empty>{t('Akaun ini tidak aktif untuk bayaran.', 'This account is not active for payments.')}</Empty></div>;
  return (
    <>
      <div className="page-head"><h2>{t('Bayar yuran khairat', 'Pay fund fees')}</h2>
        <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected([]); setQr(null); }} style={{ width: 'auto' }}>
          {[thisYear() - 1, thisYear(), thisYear() + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <h3>1. {t('Pilih bulan', 'Choose months')}</h3>
          <p className="small muted">{t(`Yuran RM${fee.toFixed(2)} sebulan. Ketik bulan untuk pilih.`, `Fee RM${fee.toFixed(2)} per month. Tap months to select.`)}</p>
          <div style={{ overflowX: 'auto' }}><MonthGrid payments={payments} year={year} joinDate={member.join_date} onCell={toggle} selected={selected} /></div>
          <div className="row" style={{ marginTop: 14 }}>
            <div><div className="small muted">{t('Jumlah perlu dibayar', 'Amount to pay')}</div><div className="amount-big">{rm(total)}</div></div>
            <span className="spacer" />
            <button className="btn btn-primary" disabled={!selected.length} onClick={showQr}>{t('Jana kod QR', 'Show QR code')}</button>
          </div>
        </div>
        <div className="card">
          <h3>2. {t('Imbas & bayar', 'Scan & pay')}</h3>
          {!qr ? <Empty>{t('Pilih bulan dahulu, kemudian tekan "Jana kod QR".', 'Choose months first, then press "Show QR code".')}</Empty> : (
            <>
              <div className="qr-box">
                <img src={qr.src} alt="QR" className={qr.official ? 'official' : ''} />
                <div className="amount-big">{rm(total)}</div>
                <div className="small">{t('Rujukan', 'Reference')}: <code>{ref}</code></div>
                {settings?.bank_name && <div className="small muted">{settings.bank_name} · {settings.account_no} · {settings.account_name}</div>}
              </div>
              <p className="small muted">{qr.official
                ? t('Imbas dengan aplikasi bank atau e-dompet anda (DuitNow QR). Masukkan jumlah dan rujukan di atas.', 'Scan with your banking or e-wallet app (DuitNow QR). Enter the amount and reference above.')
                : t('Imbas untuk melihat butiran akaun, kemudian buat pindahan dengan rujukan di atas.', 'Scan to see the account details, then transfer using the reference above.')}</p>
              <form onSubmit={submit}>
                <h3>3. {t('Sahkan bayaran', 'Confirm payment')}</h3>
                <Field label={t('No. rujukan transaksi bank', 'Bank transaction reference')} hint={t('Dari resit aplikasi bank anda', 'From your banking app receipt')}><input value={refNo} onChange={(e) => setRefNo(e.target.value)} required /></Field>
                <button className="btn btn-primary btn-block" disabled={busy}>{t('Saya sudah bayar', 'I have paid')}</button>
              </form>
            </>
          )}
        </div>
      </div>
      <h3>{t('Sejarah bayaran', 'Payment history')}</h3>
      <PaymentsTable payments={payments} />
      {payments.some((p) => p.status === 'rejected') && <p className="small muted">{t('Bayaran yang ditolak boleh dihantar semula. Hubungi amil anda jika ada pertanyaan.', 'Rejected payments can be submitted again. Contact your amil with any questions.')}</p>}
    </>
  );
}

function MyAmil({ amil, member }) {
  const t = useT();
  if (!amil) return <div className="card"><Empty>{t('Amil belum ditetapkan untuk anda. Sila hubungi pentadbir khairat.', 'No amil has been assigned to you yet. Please contact the fund admin.')}</Empty></div>;
  const wa = amil.phone ? 'https://wa.me/6' + amil.phone.replace(/\D/g, '').replace(/^6/, '') : null;
  return (
    <div className="card narrow">
      <div className="profile-head">
        <div className="avatar">{initials(amil.full_name)}</div>
        <div><h3 style={{ margin: 0 }}>{amil.full_name}</h3><div className="small muted">{t('Amil yang menjaga anda', 'Your assigned amil')}</div></div>
      </div>
      <dl className="dl">
        <dt>{t('Telefon', 'Phone')}</dt><dd>{amil.phone ? <a href={'tel:' + amil.phone}>{amil.phone}</a> : '-'}</dd>
        <dt>{t('E-mel', 'Email')}</dt><dd>{amil.email ? <a href={'mailto:' + amil.email}>{amil.email}</a> : '-'}</dd>
        <dt>{t('Kawasan jagaan', 'Area covered')}</dt><dd>{amil.area || '-'}</dd>
      </dl>
      {wa && <div className="row" style={{ marginTop: 14 }}><a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer">WhatsApp</a><a className="btn" href={'tel:' + amil.phone}>{t('Telefon', 'Call')}</a></div>}
      <p className="small muted" style={{ marginTop: 14 }}>{t(`Sebut ID Ahli anda (${member.member_no}) apabila menghubungi amil.`, `Mention your Member ID (${member.member_no}) when contacting your amil.`)}</p>
    </div>
  );
}
