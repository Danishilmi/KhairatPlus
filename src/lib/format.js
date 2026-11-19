export const rm = (n) => {
  const v = Number(n || 0);
  return (v < 0 ? '-' : '') + 'RM ' + Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const thisYear = () => new Date().getFullYear();
export const thisMonth = () => new Date().getMonth() + 1;

// Months owed this year up to the current month (only for active members).
export function arrearsFor(member, payments, year = thisYear()) {
  if (member.status !== 'active') return [];
  const paid = new Set(payments.filter((p) => p.member_id === member.id && p.year === year && p.status === 'paid').map((p) => p.month));
  const joined = member.join_date ? new Date(member.join_date) : null;
  const start = joined && joined.getFullYear() === year ? joined.getMonth() + 1 : joined && joined.getFullYear() > year ? 13 : 1;
  const end = year < thisYear() ? 12 : year > thisYear() ? 0 : thisMonth();
  const owed = [];
  for (let m = start; m <= end; m++) if (!paid.has(m)) owed.push(m);
  return owed;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
