import React, { useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { Field, useForm, useToast, ErrorBox } from '../../components/ui.jsx';
import { useT, useErrorText } from '../../lib/i18n.jsx';
import { q } from '../../lib/supabase.js';
import { readFileAsDataUrl } from '../../lib/format.js';

export default function Settings() {
  const t = useT();
  const errText = useErrorText();
  const { client, settings, setSettings } = usePortal();
  const toast = useToast();
  const { values, bind, setValues } = useForm({ ...settings });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onQr(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1.5e6) return setErr(t('Gambar terlalu besar (maks 1.5MB).', 'Image too large (max 1.5MB).'));
    setValues((v) => ({ ...v, qr_image: '' }));
    const url = await readFileAsDataUrl(f);
    setValues((v) => ({ ...v, qr_image: url }));
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const row = await q(client.from('settings').update({
        org_name: values.org_name, monthly_fee: Number(values.monthly_fee), payout_amount: Number(values.payout_amount),
        bank_name: values.bank_name, account_name: values.account_name, account_no: values.account_no, qr_image: values.qr_image || '', updated_at: new Date().toISOString()
      }).eq('id', 1).select().single());
      setSettings(row);
      toast(t('Tetapan disimpan.', 'Settings saved.'));
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{t('Tetapan khairat', 'Fund settings')}</h2>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid-2">
        <Field label={t('Nama organisasi', 'Organisation name')} wide><input {...bind('org_name')} required /></Field>
        <Field label={t('Yuran bulanan (RM)', 'Monthly fee (RM)')}><input type="number" min="0" step="0.01" {...bind('monthly_fee')} required /></Field>
        <Field label={t('Jumlah khairat lazim (RM)', 'Default payout (RM)')}><input type="number" min="0" step="0.01" {...bind('payout_amount')} required /></Field>
        <Field label={t('Nama bank', 'Bank name')}><input {...bind('bank_name')} placeholder="Bank Islam" /></Field>
        <Field label={t('No. akaun', 'Account no.')}><input {...bind('account_no')} /></Field>
        <Field label={t('Nama pemegang akaun', 'Account holder')} wide><input {...bind('account_name')} /></Field>
        <Field label={t('Kod QR DuitNow rasmi', 'Official DuitNow QR code')} hint={t('Muat naik gambar QR akaun khairat. Jika tiada, sistem menjana QR dengan butiran akaun & rujukan.', 'Upload the fund account\'s QR image. Without it, the app generates a QR with the account details and reference.')} wide>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onQr} />
        </Field>
        {values.qr_image && (
          <div className="field wide"><div className="qr-box" style={{ alignItems: 'flex-start' }}>
            <img src={values.qr_image} alt="QR" className="official" style={{ width: 160 }} />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setValues((v) => ({ ...v, qr_image: '' }))}>{t('Buang QR', 'Remove QR')}</button>
          </div></div>
        )}
      </div>
      <button className="btn btn-primary" disabled={busy}>{t('Simpan tetapan', 'Save settings')}</button>
    </form>
  );
}
