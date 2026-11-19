import React from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../components/Portal.jsx';
import { useLoad, Spinner, ErrorBox, Stat, Empty } from '../../components/ui.jsx';
import { useT, useMonths, useErrorText } from '../../lib/i18n.jsx';
import { rm, fmtDate, thisYear, arrearsFor } from '../../lib/format.js';
import { loadAll, sum } from './data.js';

export function MonthlyBars({ income, payouts }) {
  const months = useMonths();
  const t = useT();
  const max = Math.max(1, ...income, ...payouts);
  return (
    <>
      <div className="bars">
        {months.map((m, i) => (
          <div className="bar-col" key={m}>
            <div className="bar-pair">
              <div className="bar in" style={{ height: (income[i] / max) * 100 + '%' }} title={`${m}: ${rm(income[i])}`} />
              <div className="bar out" style={{ height: (payouts[i] / max) * 100 + '%' }} title={`${m}: ${rm(payouts[i])}`} />
            </div>
            <span className="bar-lbl">{m}</span>
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--accent)' }} />{t('Kutipan', 'Collections')}</span>
        <span><i style={{ background: 'var(--gold)' }} />{t('Bayaran khairat', 'Payouts')}</span>
      </div>
    </>
  );
}

export default function Dashboard() {
  const t = useT();
  const errText = useErrorText();
  const { client } = usePortal();
  const { data, loading, error } = useLoad(() => loadAll(client), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{errText(error)}</ErrorBox>;

  const y = thisYear();
  const paid = data.payments.filter((p) => p.status === 'paid');
  const income = sum(paid), out = sum(data.payouts);
  const yearPaid = paid.filter((p) => p.year === y);
  const monthlyIn = Array.from({ length: 12 }, (_, i) => sum(yearPaid.filter((p) => p.month === i + 1)));
  const monthlyOut = Array.from({ length: 12 }, (_, i) => sum(data.payouts.filter((p) => p.paid_at?.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`))));
  const active = data.members.filter((m) => m.status === 'active');
  const inArrears = active.filter((m) => arrearsFor(m, data.payments).length > 0).length;
  const pending = data.payments.filter((p) => p.status === 'pending').length;

  return (
    <>
      <div className="page-head"><h2>{t('Papan pemuka', 'Dashboard')}</h2></div>
      <div className="stats">
        <Stat label={t('Baki dana', 'Fund balance')} value={rm(income - out)} tone={income - out >= 0 ? 'good' : 'bad'} sub={t('Kutipan tolak bayaran khairat', 'Collections minus payouts')} />
        <Stat label={t('Kutipan ' + y, 'Collected ' + y)} value={rm(sum(yearPaid))} tone="accent" />
        <Stat label={t('Ahli aktif', 'Active members')} value={active.length} sub={`${data.members.length} ${t('jumlah', 'total')} · ${data.dependents.length} ${t('tanggungan', 'dependents')}`} />
        <Stat label="Amil" value={data.amils.length} />
        <Stat label={t('Ahli tertunggak', 'Members in arrears')} value={inArrears} tone={inArrears ? 'bad' : 'good'} />
        <Stat label={t('Bayaran QR menunggu', 'QR payments pending')} value={pending} sub={t('Menunggu pengesahan amil', 'Awaiting amil check')} />
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <h3>{t('Aliran wang ' + y, 'Cash flow ' + y)}</h3>
          <MonthlyBars income={monthlyIn} payouts={monthlyOut} />
        </div>
        <div className="card">
          <div className="row"><h3>{t('Bayaran khairat terkini', 'Recent payouts')}</h3><span className="spacer" /><Link to="/admin/khairat" className="small">{t('Lihat semua', 'View all')}</Link></div>
          {data.payouts.length === 0 ? <Empty>{t('Belum ada bayaran khairat.', 'No payouts yet.')}</Empty> : (
            <table><tbody>
              {data.payouts.slice(0, 5).map((p) => (
                <tr key={p.id}><td><strong>{p.deceased_name}</strong><div className="small muted">{t('Waris', 'Next of kin')}: {p.nok_name}</div></td><td className="small muted">{fmtDate(p.paid_at)}</td><td className="num">{rm(p.amount)}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
      <div className="card">
        <h3>{t('Amil & ahli di bawah jagaan', 'Amil & assigned members')}</h3>
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table>
            <thead><tr><th>Amil</th><th>{t('Kawasan', 'Area')}</th><th className="num">{t('Ahli', 'Members')}</th><th className="num">{t('Kutipan ' + y, 'Collected ' + y)}</th></tr></thead>
            <tbody>
              {data.amils.map((a) => {
                const ids = new Set(data.members.filter((m) => m.amil_id === a.id).map((m) => m.id));
                return <tr key={a.id}><td>{a.full_name}</td><td>{a.area || '-'}</td><td className="num">{ids.size}</td><td className="num">{rm(sum(yearPaid.filter((p) => ids.has(p.member_id))))}</td></tr>;
              })}
              {(() => { const n = data.members.filter((m) => !m.amil_id).length; return n ? <tr><td colSpan={2} className="muted">{t('Belum ditetapkan amil', 'No amil assigned')}</td><td className="num">{n}</td><td /></tr> : null; })()}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
