import React, { useState } from 'react';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Stat, Empty } from '../../components/ui.jsx';
import { useT, useMonths, useErrorText } from '../../lib/i18n.jsx';
import { rm, thisYear, arrearsFor } from '../../lib/format.js';
import { loadAll, sum } from './data.js';
import { MonthlyBars } from './Dashboard.jsx';

export default function Finance() {
  const t = useT();
  const errText = useErrorText();
  const months = useMonths();
  const { client, settings } = usePortal();
  const [year, setYear] = useState(thisYear());
  const { data, loading, error } = useLoad(() => loadAll(client, ['members', 'amils', 'payments', 'payouts']), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;

  const paid = data.payments.filter((p) => p.status === 'paid');
  const allIn = sum(paid), allOut = sum(data.payouts);
  const yPaid = paid.filter((p) => p.year === year);
  const yOut = data.payouts.filter((p) => p.paid_at?.startsWith(String(year)));
  const mIn = Array.from({ length: 12 }, (_, i) => sum(yPaid.filter((p) => p.month === i + 1)));
  const mOut = Array.from({ length: 12 }, (_, i) => sum(yOut.filter((p) => Number(p.paid_at.slice(5, 7)) === i + 1)));
  const arrears = data.members.map((m) => ({ m, owed: arrearsFor(m, data.payments, year) })).filter((x) => x.owed.length).sort((a, b) => b.owed.length - a.owed.length);
  const fee = Number(settings?.monthly_fee || 0);
  const years = [...new Set([thisYear(), ...data.payments.map((p) => p.year)])].sort((a, b) => b - a);
  const amilName = (id) => data.amils.find((a) => a.id === id)?.full_name || '-';
  const cumulative = mIn.reduce((acc, v, i) => [...acc, (acc[i - 1] ?? 0) + v - mOut[i]], []);

  return (
    <>
      <div className="page-head">
        <h2>{t('Kedudukan kewangan', 'Financial standing')}</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>{years.map((y) => <option key={y}>{y}</option>)}</select>
      </div>
      <div className="stats">
        <Stat label={t('Baki dana keseluruhan', 'Overall fund balance')} value={rm(allIn - allOut)} tone={allIn - allOut >= 0 ? 'good' : 'bad'} />
        <Stat label={t('Jumlah kutipan (semua)', 'Total collected (all time)')} value={rm(allIn)} />
        <Stat label={t('Jumlah khairat dibayar (semua)', 'Total paid out (all time)')} value={rm(allOut)} />
        <Stat label={t(`Kutipan ${year}`, `Collected ${year}`)} value={rm(sum(yPaid))} tone="accent" />
        <Stat label={t(`Khairat ${year}`, `Payouts ${year}`)} value={rm(sum(yOut))} />
        <Stat label={t('Anggaran tunggakan', 'Estimated arrears')} value={rm(arrears.reduce((s, x) => s + x.owed.length, 0) * fee)} tone="bad" sub={t(`${arrears.length} ahli · RM${fee}/bulan`, `${arrears.length} members · RM${fee}/month`)} />
      </div>
      <div className="card"><h3>{t(`Kutipan vs khairat ${year}`, `Collections vs payouts ${year}`)}</h3><MonthlyBars income={mIn} payouts={mOut} /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('Bulan', 'Month')}</th><th className="num">{t('Kutipan', 'Collections')}</th><th className="num">{t('Bil. bayaran', 'No. of payments')}</th><th className="num">{t('Khairat dibayar', 'Payouts')}</th><th className="num">{t('Bersih', 'Net')}</th><th className="num">{t('Kumulatif tahun ini', 'Year to date')}</th></tr></thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={m}><td>{m} {year}</td><td className="num">{rm(mIn[i])}</td><td className="num">{yPaid.filter((p) => p.month === i + 1).length}</td><td className="num">{rm(mOut[i])}</td><td className="num">{rm(mIn[i] - mOut[i])}</td><td className="num">{rm(cumulative[i])}</td></tr>
            ))}
            <tr><td><strong>{t('Jumlah', 'Total')}</strong></td><td className="num"><strong>{rm(sum(yPaid))}</strong></td><td className="num"><strong>{yPaid.length}</strong></td><td className="num"><strong>{rm(sum(yOut))}</strong></td><td className="num"><strong>{rm(sum(yPaid) - sum(yOut))}</strong></td><td /></tr>
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div>
          <h3>{t('Kutipan mengikut amil', 'Collections by amil')}</h3>
          <div className="table-wrap"><table>
            <thead><tr><th>Amil</th><th className="num">{t('Ahli', 'Members')}</th><th className="num">{t('Kutipan', 'Collected')}</th></tr></thead>
            <tbody>{data.amils.map((a) => {
              const ids = new Set(data.members.filter((m) => m.amil_id === a.id).map((m) => m.id));
              return <tr key={a.id}><td>{a.full_name}</td><td className="num">{ids.size}</td><td className="num">{rm(sum(yPaid.filter((p) => ids.has(p.member_id))))}</td></tr>;
            })}</tbody>
          </table></div>
        </div>
        <div>
          <h3>{t('Ahli tertunggak', 'Members in arrears')}</h3>
          {arrears.length === 0 ? <div className="card"><Empty>{t('Tiada tunggakan. Alhamdulillah.', 'No arrears.')}</Empty></div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>{t('Ahli', 'Member')}</th><th>Amil</th><th className="num">{t('Bulan', 'Months')}</th><th className="num">{t('Jumlah', 'Amount')}</th></tr></thead>
              <tbody>{arrears.map(({ m, owed }) => (
                <tr key={m.id}><td><strong>{m.member_no}</strong> {m.full_name}<div className="small muted">{owed.map((x) => months[x - 1]).join(', ')}</div></td><td className="small">{amilName(m.amil_id)}</td><td className="num">{owed.length}</td><td className="num">{rm(owed.length * fee)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
