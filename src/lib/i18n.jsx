import React, { createContext, useContext, useEffect, useState } from 'react';

// Every UI string is written inline in both languages: t('Bahasa Melayu', 'English').
// Bahasa Melayu is the default.
const LangCtx = createContext({ lang: 'ms', setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('khairatplus-lang') || 'ms'; } catch { return 'ms'; }
  });
  useEffect(() => {
    try { localStorage.setItem('khairatplus-lang', lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() { return useContext(LangCtx); }
export function useT() {
  const { lang } = useContext(LangCtx);
  return (ms, en) => (lang === 'en' ? en : ms);
}

export const MONTHS = {
  ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
export function useMonths() { return MONTHS[useContext(LangCtx).lang]; }

export const RELATIONSHIPS = {
  spouse: ['Pasangan', 'Spouse'], child: ['Anak', 'Child'], parent: ['Ibu/Bapa', 'Parent'],
  sibling: ['Adik-beradik', 'Sibling'], other: ['Lain-lain', 'Other']
};
export const STATUS = {
  active: ['Aktif', 'Active'], inactive: ['Tidak aktif', 'Inactive'], deceased: ['Meninggal dunia', 'Deceased'],
  alive: ['Hidup', 'Alive'], paid: ['Dibayar', 'Paid'], pending: ['Menunggu pengesahan', 'Pending'], rejected: ['Ditolak', 'Rejected']
};
export const METHODS = {
  cash: ['Tunai', 'Cash'], transfer: ['Pindahan bank', 'Bank transfer'], qr: ['QR / DuitNow', 'QR / DuitNow'], cheque: ['Cek', 'Cheque']
};
export function useLabel() {
  const t = useT();
  return (table, key) => (table[key] ? t(table[key][0], table[key][1]) : key || '-');
}

// Friendly messages for errors raised by the database, RPCs and edge function.
export function useErrorText() {
  const t = useT();
  return (err) => {
    const msg = String(err?.message || err || '');
    const map = [
      [/Invalid login credentials|invalid_login/i, t('ID atau kata laluan salah.', 'Wrong ID or password.')],
      [/wrong_role/, t('Akaun ini bukan untuk portal ini.', 'This account does not belong to this portal.')],
      [/email_taken|already been registered/i, t('E-mel ini sudah digunakan oleh akaun lain.', 'That email is already used by another account.')],
      [/invalid_email|Unable to validate email/i, t('Alamat e-mel tidak sah.', 'Invalid email address.')],
      [/NotAllowedError|ERROR_CEREMONY_ABORTED|cancel|timed out/i, t('Pengesahan cap jari dibatalkan atau tamat masa.', 'Fingerprint check was cancelled or timed out.')],
      [/passkey_disabled|Passkeys are disabled/i, t('Log masuk cap jari belum diaktifkan oleh pentadbir.', 'Fingerprint login has not been enabled by the admin.')],
      [/webauthn_challenge_expired/i, t('Masa tamat. Sila cuba lagi.', 'Timed out. Please try again.')],
      [/passkey_not_found|credential.*not found|webauthn_credential/i, t('Cap jari ini belum didaftarkan untuk mana-mana akaun.', 'This fingerprint is not registered to any account.')],
      [/username_taken|already/i, t('Nama pengguna sudah digunakan.', 'That username is already taken.')],
      [/invalid_username/, t('Nama pengguna 3-30 aksara: huruf kecil, nombor, titik, sengkang.', 'Username must be 3-30 characters: lowercase letters, numbers, dots, dashes.')],
      [/password_too_short|Password should be/i, t('Kata laluan sekurang-kurangnya 6 aksara.', 'Password must be at least 6 characters.')],
      [/already_paid/, t('Bulan ini sudah dibayar.', 'That month is already paid.')],
      [/missing_reference/, t('Sila masukkan no. rujukan transaksi.', 'Please enter the transaction reference.')],
      [/cannot_delete_deceased/, t('Tanggungan yang telah meninggal tidak boleh dipadam.', 'A deceased dependent cannot be deleted.')],
      [/payouts_one_per|duplicate key/, t('Rekod ini sudah wujud.', 'This record already exists.')],
      [/not_allowed|forbidden|42501|row-level security/i, t('Anda tidak dibenarkan melakukan ini.', 'You are not allowed to do this.')],
      [/Failed to fetch|NetworkError/i, t('Tiada sambungan internet.', 'No internet connection.')],
      [/amil_has_members/, t('Amil ini masih mempunyai ahli.', 'This amil still has members.')]
    ];
    for (const [re, text] of map) if (re.test(msg)) return text;
    return msg || t('Ralat tidak dijangka.', 'Unexpected error.');
  };
}
