// Birth date from a Malaysian IC (No. KP): digits 1-2 are the year, 3-4 the month, 5-6 the day.
// Works whether or not the IC has dashes. Returns 'YYYY-MM-DD', or '' when the IC is incomplete
// or the date is not real (e.g. 31 February) or in the future.
export function dobFromIc(ic, today = new Date()) {
  const d = String(ic ?? '').replace(/\D/g, '');
  if (d.length !== 12) return '';
  const yy = Number(d.slice(0, 2)), mm = Number(d.slice(2, 4)), dd = Number(d.slice(4, 6));
  // Two-digit year: later than this year's two digits means 19YY, otherwise 20YY.
  const year = (yy > today.getFullYear() % 100 ? 1900 : 2000) + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (mm < 1 || mm > 12 || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return '';
  const iso = `${year}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  const now = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso > now ? '' : iso;
}
