import React, { useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Portal, usePortal, AccountSecurity } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, Search, Badge, Stat } from '../../components/ui.jsx';
import { MemberProfile, DependentsTable, PaymentsTable, MonthGrid, Legend } from '../../components/MemberDetail.jsx';
import { useT, useErrorText, useLabel, useMonths, METHODS } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { rm, thisYear, thisMonth, arrearsFor, fmtDate, icSearchText } from '../../lib/format.js';

export default function AmilPortal() {
  const t = useT();
  const tabs = [
    { to: '/amil', end: true, label: t('Ahli saya', 'My members') },
    { to: '/amil/pengesahan', label: t('Pengesahan QR', 'QR verification') },
    { to: '/amil/akaun', label: t('Akaun', 'Account') }
  ];
  return (
    <Portal role="amil" accent="amil" title={t('Portal Amil', 'Collector Portal')} tabs={tabs}>
      <AmilData>
        {(ctx) => (
          <Routes>
            <Route index element={<MyMembers {...ctx} />} />
            <Route path="pengesahan" element={<Pending {...ctx} />} />
            <Route path="akaun" element={<Account {...ctx} />} />
            <Route path="*" element={<Navigate to="/amil" replace />} />
          </Routes>
        )}
      </AmilData>
    </Portal>
  );
}

// RLS returns only this amil's members, their dependents and payments.
function AmilData({ children }) {
  const { client, session } = usePortal();
  const errText = useErrorText();
  const res = useLoad(async () => {
    const amil = await q(client.from('amils').select('*').eq('user_id', session.user.id).single());
    const members = await q(client.from('members').select('*').eq('amil_id', amil.id).order('member_no'));
    const ids = members.map((m) => m.id);
    const [payments, dependents] = ids.length
      ? await Promise.all([q(client.from('payments').select('*').in('member_id', ids)), q(client.from('dependents').select('*').in('member_id', ids))])
      : [[], []];
    return { amil, members, payments, dependents };
  }, []);
  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox>{errText(res.error)}</ErrorBox>;
  return children({ ...res.data, reload: res.reload });
}

function MyMembers({ amil, members, payments, dependents, reload }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(thisYear());
  const [filter, setFilter] = useState('');
  const [payEdit, setPayEdit] = useState(null);
  const [view, setView] = useState(null);
  const monthNow = thisMonth();
  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return members
      .filter((m) => !s || [m.member_no, m.full_name, icSearchText(m.ic_no), m.address, m.phone].join(' ').toLowerCase().includes(s))
      .filter((m) => !filter || (filter === 'owed' ? arrearsFor(m, payments, year).length > 0 : filter === 'unpaid_month' ? m.status === 'active' && !payments.some((p) => p.member_id === m.id && p.year === thisYear() && p.month === monthNow && p.status === 'paid') : true));
  }, [members, payments, search, filter, year, monthNow]);

  const yearPaid = payments.filter((p) => p.year === year && p.status === 'paid');
  const paidThisMonth = new Set(payments.filter((p) => p.year === thisYear() && p.month === monthNow && p.status === 'paid').map((p) => p.member_id));
  const active = members.filter((m) => m.status === 'active');
  const pending = payments.filter((p) => p.status === 'pending').length;

  return (
    <>
      <div className="page-head"><h2>{t('Ahli di bawah jagaan saya', 'Members under my care')}</h2></div>
      <div className="stats">
        <Stat label={t('Ahli', 'Members')} value={members.length} sub={`${active.length} ${t('aktif', 'active')}`} />
        <Stat label={t('Sudah bayar bulan ini', 'Paid this month')} value={`${active.filter((m) => paidThisMonth.has(m.id)).length}/${active.length}`} tone="accent" />
        <Stat label={t(`Kutipan ${year}`, `Collected ${year}`)} value={rm(yearPaid.reduce((s, p) => s + Number(p.amount), 0))} />
        <Stat label={t('QR menunggu pengesahan', 'QR awaiting check')} value={pending} tone={pending ? 'bad' : undefined} />
      </div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <Search value={search} onChange={setSearch} placeholder={t('Cari ID, nama, alamat…', 'Search ID, name, address…')} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t('Semua ahli', 'All members')}</option>
          <option value="unpaid_month">{t('Belum bayar bulan ini', 'Not paid this month')}</option>
          <option value="owed">{t('Ada tunggakan', 'Has arrears')}</option>
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
          {[thisYear() - 1, thisYear(), thisYear() + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <p className="small muted">{t('Ketik bulan pada grid untuk merekod atau mengubah bayaran.', 'Tap a month in the grid to record or change a payment.')}</p>
      <div style={{ marginBottom: 10 }}><Legend /></div>
      {rows.length === 0 ? <div className="card"><Empty>{members.length ? t('Tiada ahli sepadan.', 'No matching members.') : t('Belum ada ahli ditetapkan kepada anda.', 'No members are assigned to you yet.')}</Empty></div> : (
        <div className="table-wrap">
          <table className="stack-sm">
            <thead><tr><th>{t('Ahli', 'Member')}</th><th>{t(`Bayaran ${year}`, `Payments ${year}`)}</th><th className="num">{t('Tunggakan', 'Owed')}</th></tr></thead>
            <tbody>
              {rows.map((m) => {
                const owed = arrearsFor(m, payments, year).length;
                return (
                  <tr key={m.id}>
                    <td style={{ minWidth: 190 }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontWeight: 700 }} onClick={() => setView(m)}>{m.member_no} · {m.full_name}</button>
                      <div className="small muted">{m.address}</div>
                      {m.phone && <div className="small"><a href={'tel:' + m.phone}>{m.phone}</a></div>}
                      {m.status !== 'active' && <Badge status={m.status} />}
                    </td>
                    <td><MonthGrid legend={false} payments={payments.filter((p) => p.member_id === m.id)} year={year} joinDate={m.join_date} status={m.status} onCell={(month, p) => setPayEdit({ member: m, year, month, payment: p })} /></td>
                    <td className="num">{owed ? <span className="badge badge-arrears">{owed}</span> : <span className="badge badge-paid">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {payEdit && <PaymentForm {...payEdit} onClose={() => setPayEdit(null)} onSaved={() => { setPayEdit(null); reload(); }} />}
      {view && (
        <Modal size="lg" title={t('Profil ahli', 'Member profile')} onClose={() => setView(null)} footer={<button className="btn btn-primary" onClick={() => setView(null)}>{t('Tutup', 'Close')}</button>}>
          <MemberProfile member={view} />
          <h4 className="section-title">{t('Tanggungan', 'Dependents')}</h4>
          <DependentsTable dependents={dependents.filter((d) => d.member_id === view.id)} />
          <h4 className="section-title">{t('Sejarah bayaran', 'Payment history')}</h4>
          <PaymentsTable payments={payments.filter((p) => p.member_id === view.id).sort((a, b) => b.year - a.year || b.month - a.month)}
            onEdit={(p) => { setView(null); setPayEdit({ member: view, year: p.year, month: p.month, payment: p }); }} />
        </Modal>
      )}
    </>
  );
}

function PaymentForm({ member, year, month, payment, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const label = useLabel();
  const months = useMonths();
  const { client, settings, session } = usePortal();
  const toast = useToast();
  const { values, bind } = useForm({ amount: payment?.amount ?? settings?.monthly_fee ?? 5, method: payment?.method || 'cash', status: payment?.status === 'pending' ? 'paid' : payment?.status || 'paid', reference: payment?.reference || '', note: payment?.note || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const row = { amount: Number(values.amount), method: values.method, status: values.status, reference: values.reference, note: values.note, recorded_by: session.user.id };
      if (payment) await q(client.from('payments').update(row).eq('id', payment.id));
      else await q(client.from('payments').insert({ ...row, member_id: member.id, year, month }));
      toast(t('Bayaran disimpan.', 'Payment saved.')); onSaved();
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }
  async function remove() {
    if (!window.confirm(t('Padam rekod bayaran ini?', 'Delete this payment record?'))) return;
    try { await q(client.from('payments').delete().eq('id', payment.id)); toast(t('Rekod dipadam.', 'Record deleted.')); onSaved(); }
    catch (e2) { setErr(errText(e2)); }
  }

  return (
    <Modal title={`${payment ? t('Sunting bayaran', 'Edit payment') : t('Rekod bayaran', 'Record payment')} · ${months[month - 1]} ${year}`} onClose={onClose}
      footer={<>{payment && <button className="btn btn-danger" onClick={remove}>{t('Padam', 'Delete')}</button>}<span className="spacer" /><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="pay-form" disabled={busy}>{t('Simpan', 'Save')}</button></>}>
      <form id="pay-form" onSubmit={submit}>
        <p><strong>{member.member_no}</strong> · {member.full_name}</p>
        {payment?.status === 'pending' && <div className="alert alert-info small">{t(`Ahli menghantar bayaran QR dengan rujukan "${payment.reference}". Semak penyata bank sebelum mengesahkan.`, `The member submitted a QR payment with reference "${payment.reference}". Check the bank statement before confirming.`)}</div>}
        <ErrorBox>{err}</ErrorBox>
        <div className="grid-2">
          <Field label={t('Jumlah (RM)', 'Amount (RM)')}><input type="number" min="0" step="0.01" {...bind('amount')} required /></Field>
          <Field label={t('Kaedah', 'Method')}><select {...bind('method')}>{['cash', 'transfer', 'qr'].map((m) => <option key={m} value={m}>{label(METHODS, m)}</option>)}</select></Field>
          <Field label="Status"><select {...bind('status')}><option value="paid">{t('Dibayar / disahkan', 'Paid / verified')}</option><option value="rejected">{t('Ditolak', 'Rejected')}</option><option value="pending">{t('Menunggu', 'Pending')}</option></select></Field>
          <Field label={t('No. rujukan / resit', 'Reference / receipt no.')}><input {...bind('reference')} /></Field>
          <Field label={t('Catatan', 'Note')} wide><input {...bind('note')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function Pending({ members, payments, reload }) {
  const t = useT();
  const errText = useErrorText();
  const months = useMonths();
  const { client, session } = usePortal();
  const toast = useToast();
  const list = payments.filter((p) => p.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const member = (id) => members.find((m) => m.id === id);

  async function setStatus(p, status) {
    try {
      await q(client.from('payments').update({ status, recorded_by: session.user.id }).eq('id', p.id));
      toast(status === 'paid' ? t('Bayaran disahkan.', 'Payment verified.') : t('Bayaran ditolak.', 'Payment rejected.'));
      reload();
    } catch (e) { toast(errText(e), 'err'); }
  }

  return (
    <>
      <div className="page-head"><h2>{t('Pengesahan bayaran QR', 'QR payment verification')}</h2></div>
      <p className="small muted">{t('Semak penyata atau notifikasi bank untuk rujukan di bawah sebelum mengesahkan.', 'Check the bank statement or notification for each reference before verifying.')}</p>
      {list.length === 0 ? <div className="card"><Empty>{t('Tiada bayaran menunggu pengesahan.', 'No payments waiting for verification.')}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Ahli', 'Member')}</th><th>{t('Bulan', 'Month')}</th><th className="num">{t('Jumlah', 'Amount')}</th><th>{t('Rujukan', 'Reference')}</th><th>{t('Dihantar', 'Submitted')}</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><strong>{member(p.member_id)?.member_no}</strong> {member(p.member_id)?.full_name}</td>
                  <td>{months[p.month - 1]} {p.year}</td>
                  <td className="num">{rm(p.amount)}</td>
                  <td><code>{p.reference}</code></td>
                  <td className="small muted">{fmtDate(p.created_at)}</td>
                  <td className="num"><button className="btn btn-sm btn-primary" onClick={() => setStatus(p, 'paid')}>{t('Sahkan', 'Verify')}</button> <button className="btn btn-sm btn-danger" onClick={() => setStatus(p, 'rejected')}>{t('Tolak', 'Reject')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Account({ amil, members }) {
  const t = useT();
  return (
    <>
      <div className="card narrow">
        <h3>{t('Profil amil', 'Amil profile')}</h3>
        <dl className="dl">
          <dt>{t('Nama', 'Name')}</dt><dd>{amil.full_name}</dd>
          <dt>{t('Nama pengguna', 'Username')}</dt><dd><code>{amil.username}</code></dd>
          <dt>{t('E-mel', 'Email')}</dt><dd>{amil.email || '-'}</dd>
          <dt>{t('Telefon', 'Phone')}</dt><dd>{amil.phone || '-'}</dd>
          <dt>{t('Kawasan jagaan', 'Area covered')}</dt><dd>{amil.area || '-'}</dd>
          <dt>{t('Bilangan ahli', 'Members')}</dt><dd>{members.length}</dd>
        </dl>
        <p className="small muted">{t('Untuk menukar maklumat profil, hubungi pentadbir.', 'To change your profile details, contact the admin.')}</p>
      </div>
      <AccountSecurity />
    </>
  );
}
