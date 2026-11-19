import React from 'react';
import { useT, useLabel, RELATIONSHIPS, METHODS, useMonths } from '../lib/i18n.jsx';
import { rm, fmtDate, thisYear, thisMonth } from '../lib/format.js';
import { Badge, Empty } from './ui.jsx';

export function initials(name) {
  return String(name || '?').split(/\s+/).filter((w) => !/^(bin|binti|bt|b\.|a\/l|a\/p)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// 12-month payment grid. onCell(month, payment) makes cells clickable.
export function MonthGrid({ payments, year, joinDate, onCell, selected = [], status = 'active', legend = true }) {
  const months = useMonths();
  const t = useT();
  const byMonth = Object.fromEntries(payments.filter((p) => p.year === year).map((p) => [p.month, p]));
  const joined = joinDate ? new Date(joinDate) : null;
  return (
    <>
      <div className="months">
        {months.map((label, i) => {
          const m = i + 1;
          const p = byMonth[m];
          const future = year > thisYear() || (year === thisYear() && m > thisMonth());
          const beforeJoin = joined && (year < joined.getFullYear() || (year === joined.getFullYear() && m < joined.getMonth() + 1));
          let cls = 'mcell';
          if (p) cls += ' ' + p.status;
          else if (future) cls += ' future';
          else if (!beforeJoin && status === 'active') cls += ' owed';
          if (selected.includes(m)) cls += ' selected';
          const title = p ? `${label}: ${rm(p.amount)} (${p.status})` : label;
          return onCell
            ? <button type="button" key={m} className={cls} title={title} onClick={() => onCell(m, p)}>{label}</button>
            : <div key={m} className={cls} title={title}>{label}</div>;
        })}
      </div>
      {legend && <Legend />}
    </>
  );
}

export function Legend() {
  const t = useT();
  return (
    <div className="legend">
        <span><i style={{ background: 'var(--ok-soft)', border: '1px solid #b9dfc6' }} />{t('Dibayar', 'Paid')}</span>
        <span><i style={{ background: 'var(--warn-soft)', border: '1px solid #efd798' }} />{t('Menunggu pengesahan', 'Pending')}</span>
        <span><i style={{ border: '1px dashed #e6a7a1' }} />{t('Tertunggak', 'Owed')}</span>
      </div>
  );
}

export function DependentsTable({ dependents, onEdit, onDelete }) {
  const t = useT();
  const label = useLabel();
  if (!dependents.length) return <Empty>{t('Tiada tanggungan didaftarkan.', 'No dependents registered.')}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{t('Nama penuh', 'Full name')}</th><th>{t('No. KP', 'IC no.')}</th><th>{t('Hubungan', 'Relationship')}</th><th>{t('Tarikh lahir', 'Date of birth')}</th><th>{t('Telefon', 'Phone')}</th><th>Status</th>{(onEdit || onDelete) && <th />}</tr></thead>
        <tbody>
          {dependents.map((d) => (
            <tr key={d.id}>
              <td><strong>{d.full_name}</strong></td>
              <td>{d.ic_no || '-'}</td>
              <td>{label(RELATIONSHIPS, d.relationship)}</td>
              <td>{fmtDate(d.dob)}</td>
              <td>{d.phone || '-'}</td>
              <td><Badge status={d.status} />{d.death_date && <div className="small muted">{fmtDate(d.death_date)}</div>}</td>
              {(onEdit || onDelete) && (
                <td className="num">
                  {onEdit && <button className="btn btn-sm" onClick={() => onEdit(d)}>{t('Sunting', 'Edit')}</button>}{' '}
                  {onDelete && d.status !== 'deceased' && <button className="btn btn-sm btn-danger" onClick={() => onDelete(d)}>{t('Padam', 'Delete')}</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsTable({ payments, onEdit }) {
  const t = useT();
  const label = useLabel();
  const months = useMonths();
  if (!payments.length) return <Empty>{t('Tiada rekod bayaran.', 'No payment records.')}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{t('Bulan', 'Month')}</th><th className="num">{t('Jumlah', 'Amount')}</th><th>{t('Kaedah', 'Method')}</th><th>{t('Rujukan', 'Reference')}</th><th>Status</th><th>{t('Dikemas kini', 'Updated')}</th>{onEdit && <th />}</tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{months[p.month - 1]} {p.year}</td>
              <td className="num">{rm(p.amount)}</td>
              <td>{label(METHODS, p.method)}</td>
              <td className="small">{p.reference || '-'}{p.note && <div className="muted">{p.note}</div>}</td>
              <td><Badge status={p.status} /></td>
              <td className="small muted">{fmtDate(p.updated_at)}</td>
              {onEdit && <td className="num"><button className="btn btn-sm" onClick={() => onEdit(p)}>{t('Sunting', 'Edit')}</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MemberProfile({ member, amilName }) {
  const t = useT();
  return (
    <>
      <div className="profile-head">
        <div className="avatar">{initials(member.full_name)}</div>
        <div>
          <h3 style={{ margin: 0 }}>{member.full_name}</h3>
          <div className="row small"><strong>{member.member_no}</strong><Badge status={member.status} /></div>
        </div>
      </div>
      <dl className="dl">
        <dt>{t('ID Ahli', 'Member ID')}</dt><dd>{member.member_no}</dd>
        <dt>{t('No. KP', 'IC no.')}</dt><dd>{member.ic_no || '-'}</dd>
        <dt>{t('Telefon', 'Phone')}</dt><dd>{member.phone ? <a href={'tel:' + member.phone}>{member.phone}</a> : '-'}</dd>
        {member.email && <><dt>{t('E-mel', 'Email')}</dt><dd>{member.email}</dd></>}
        <dt>{t('Lokasi rumah', 'House location')}</dt>
        <dd>{member.address || '-'}{member.map_url && <> · <a href={member.map_url} target="_blank" rel="noreferrer">{t('Buka peta', 'Open map')}</a></>}</dd>
        {amilName !== undefined && <><dt>Amil</dt><dd>{amilName || <span className="muted">{t('Belum ditetapkan', 'Not assigned')}</span>}</dd></>}
        <dt>{t('Tarikh sertai', 'Joined')}</dt><dd>{fmtDate(member.join_date)}</dd>
        {member.death_date && <><dt>{t('Tarikh meninggal', 'Date of death')}</dt><dd>{fmtDate(member.death_date)}</dd></>}
      </dl>
    </>
  );
}
