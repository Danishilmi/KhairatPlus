import React, { useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Modal, Field, useForm, useToast, Empty, Stat } from '../../components/ui.jsx';
import { useT, useErrorText, useLabel, METHODS, RELATIONSHIPS } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { rm, fmtDate } from '../../lib/format.js';
import { loadAll, sum } from './data.js';

export default function Payouts() {
  const t = useT();
  const errText = useErrorText();
  const label = useLabel();
  const { client } = usePortal();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const { data, loading, error, reload } = useLoad(() => loadAll(client, ['members', 'dependents', 'payouts', 'payments']), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;
  const balance = sum(data.payments.filter((p) => p.status === 'paid')) - sum(data.payouts);
  const memberNo = (id) => data.members.find((m) => m.id === id)?.member_no || '';

  return (
    <>
      <div className="page-head">
        <h2>{t('Bayaran khairat kepada waris', 'Payouts to next of kin')}</h2>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ {t('Rekod kematian & bayaran', 'Record death & payout')}</button>
      </div>
      <div className="stats">
        <Stat label={t('Jumlah dibayar', 'Total paid out')} value={rm(sum(data.payouts))} />
        <Stat label={t('Bilangan kes', 'Cases')} value={data.payouts.length} />
        <Stat label={t('Baki dana semasa', 'Current fund balance')} value={rm(balance)} tone={balance >= 0 ? 'good' : 'bad'} />
      </div>
      {data.payouts.length === 0 ? <div className="card"><Empty>{t('Belum ada bayaran khairat direkodkan.', 'No payouts recorded yet.')}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Tarikh bayar', 'Paid on')}</th><th>{t('Si mati', 'Deceased')}</th><th>{t('Waris penerima', 'Next of kin')}</th><th>{t('Kaedah', 'Method')}</th><th className="num">{t('Jumlah', 'Amount')}</th></tr></thead>
            <tbody>
              {data.payouts.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setView(p)}>
                  <td>{fmtDate(p.paid_at)}</td>
                  <td><strong>{p.deceased_name}</strong><div className="small muted">{p.deceased_type === 'member' ? t('Ahli', 'Member') : t('Tanggungan', 'Dependent')} · {memberNo(p.member_id)} · {t('meninggal', 'died')} {fmtDate(p.death_date)}</div></td>
                  <td>{p.nok_name}<div className="small muted">{p.nok_relationship}{p.nok_phone ? ' · ' + p.nok_phone : ''}</div></td>
                  <td>{label(METHODS, p.method)}</td>
                  <td className="num"><strong>{rm(p.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <PayoutForm data={data} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
      {view && (
        <Modal title={t('Butiran bayaran khairat', 'Payout details')} onClose={() => setView(null)} footer={<><button className="btn" onClick={() => window.print()}>{t('Cetak', 'Print')}</button><button className="btn btn-primary" onClick={() => setView(null)}>{t('Tutup', 'Close')}</button></>}>
          <dl className="dl">
            <dt>{t('Si mati', 'Deceased')}</dt><dd><strong>{view.deceased_name}</strong> ({view.deceased_type === 'member' ? t('Ahli', 'Member') : t('Tanggungan', 'Dependent')})</dd>
            <dt>{t('ID Ahli', 'Member ID')}</dt><dd>{memberNo(view.member_id)}</dd>
            <dt>{t('Tarikh meninggal', 'Date of death')}</dt><dd>{fmtDate(view.death_date)}</dd>
            <dt>{t('Waris', 'Next of kin')}</dt><dd>{view.nok_name}</dd>
            <dt>{t('No. KP waris', 'Next of kin IC')}</dt><dd>{view.nok_ic || '-'}</dd>
            <dt>{t('Hubungan', 'Relationship')}</dt><dd>{view.nok_relationship || '-'}</dd>
            <dt>{t('Telefon', 'Phone')}</dt><dd>{view.nok_phone || '-'}</dd>
            <dt>{t('Jumlah', 'Amount')}</dt><dd><strong>{rm(view.amount)}</strong></dd>
            <dt>{t('Kaedah', 'Method')}</dt><dd>{label(METHODS, view.method)} {view.reference && `· ${view.reference}`}</dd>
            <dt>{t('Tarikh bayar', 'Paid on')}</dt><dd>{fmtDate(view.paid_at)}</dd>
            <dt>{t('Catatan', 'Notes')}</dt><dd>{view.notes || '-'}</dd>
          </dl>
        </Modal>
      )}
    </>
  );
}

function PayoutForm({ data, onClose, onSaved }) {
  const t = useT();
  const errText = useErrorText();
  const label = useLabel();
  const { client, settings } = usePortal();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const { values, bind, setValues } = useForm({ member_id: '', who: 'member', death_date: today, nok_name: '', nok_ic: '', nok_relationship: '', nok_phone: '', amount: settings?.payout_amount ?? '', method: 'cash', reference: '', paid_at: today, notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const paidOut = new Set(data.payouts.map((p) => (p.deceased_type === 'member' ? 'm:' + p.member_id : 'd:' + p.dependent_id)));
  const member = data.members.find((m) => m.id === values.member_id);
  const deps = data.dependents.filter((d) => d.member_id === values.member_id && !paidOut.has('d:' + d.id));

  // Choosing a deceased dependent pre-fills the member as next of kin, and vice versa with a spouse.
  function pickWho(who) {
    const next = { ...values, who };
    if (who !== 'member' && member) Object.assign(next, { nok_name: member.full_name, nok_ic: member.ic_no, nok_phone: member.phone, nok_relationship: '' });
    if (who === 'member') {
      const spouse = data.dependents.find((d) => d.member_id === values.member_id && d.relationship === 'spouse' && d.status === 'alive');
      Object.assign(next, spouse ? { nok_name: spouse.full_name, nok_ic: spouse.ic_no, nok_phone: spouse.phone, nok_relationship: label(RELATIONSHIPS, 'spouse') } : { nok_name: '', nok_ic: '', nok_phone: '', nok_relationship: '' });
    }
    setValues(next);
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const isDep = values.who !== 'member';
      await q(client.rpc('record_payout', {
        p_member_id: values.member_id, p_deceased_type: isDep ? 'dependent' : 'member', p_dependent_id: isDep ? values.who : null,
        p_death_date: values.death_date, p_nok_name: values.nok_name, p_nok_ic: values.nok_ic, p_nok_relationship: values.nok_relationship,
        p_nok_phone: values.nok_phone, p_amount: Number(values.amount), p_method: values.method, p_reference: values.reference,
        p_paid_at: values.paid_at, p_notes: values.notes
      }));
      toast(t('Bayaran khairat direkodkan.', 'Payout recorded.'));
      onSaved();
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  const eligibleMembers = data.members.filter((m) => !paidOut.has('m:' + m.id) || data.dependents.some((d) => d.member_id === m.id && d.status === 'alive'));
  return (
    <Modal size="lg" title={t('Rekod kematian & bayaran khairat', 'Record death & payout')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('Batal', 'Cancel')}</button><button className="btn btn-primary" form="payout-form" disabled={busy || !values.member_id}>{t('Simpan bayaran', 'Save payout')}</button></>}>
      <form id="payout-form" onSubmit={submit}>
        <ErrorBox>{err}</ErrorBox>
        <div className="grid-2">
          <Field label={t('Ahli khairat', 'Fund member')} wide>
            <select value={values.member_id} onChange={(e) => setValues((v) => ({ ...v, member_id: e.target.value, who: '' }))} required>
              <option value="">{t('— Pilih ahli —', '— Choose member —')}</option>
              {eligibleMembers.map((m) => <option key={m.id} value={m.id}>{m.member_no} · {m.full_name}</option>)}
            </select>
          </Field>
          {member && (
            <Field label={t('Siapa yang meninggal dunia?', 'Who passed away?')} wide>
              <select value={values.who} onChange={(e) => pickWho(e.target.value)} required>
                <option value="">{t('— Pilih —', '— Choose —')}</option>
                {!paidOut.has('m:' + member.id) && member.status !== 'deceased' && <option value="member">{member.full_name} ({t('ahli sendiri', 'the member')})</option>}
                {deps.filter((d) => d.status === 'alive').map((d) => <option key={d.id} value={d.id}>{d.full_name} ({label(RELATIONSHIPS, d.relationship)})</option>)}
              </select>
            </Field>
          )}
          <Field label={t('Tarikh meninggal dunia', 'Date of death')}><input type="date" {...bind('death_date')} required max={today} /></Field>
          <Field label={t('Jumlah khairat (RM)', 'Payout amount (RM)')}><input type="number" min="1" step="0.01" {...bind('amount')} required /></Field>
          <h4 className="section-title field wide">{t('Waris penerima', 'Next of kin receiving payout')}</h4>
          <Field label={t('Nama waris', 'Name')}><input {...bind('nok_name')} required /></Field>
          <Field label={t('No. KP waris', 'IC no.')}><input {...bind('nok_ic')} /></Field>
          <Field label={t('Hubungan dengan si mati', 'Relationship to deceased')}><input {...bind('nok_relationship')} placeholder={t('cth. Isteri, Anak', 'e.g. Wife, Son')} /></Field>
          <Field label={t('Telefon', 'Phone')}><input {...bind('nok_phone')} type="tel" /></Field>
          <Field label={t('Kaedah bayaran', 'Payment method')}>
            <select {...bind('method')}>{['cash', 'transfer', 'cheque'].map((m) => <option key={m} value={m}>{label(METHODS, m)}</option>)}</select>
          </Field>
          <Field label={t('No. rujukan / cek', 'Reference / cheque no.')}><input {...bind('reference')} /></Field>
          <Field label={t('Tarikh bayar', 'Paid on')}><input type="date" {...bind('paid_at')} required /></Field>
          <Field label={t('Catatan', 'Notes')} wide><textarea {...bind('notes')} /></Field>
        </div>
      </form>
    </Modal>
  );
}
