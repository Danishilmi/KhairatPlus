// Optional: fills a Supabase project with demo data (1 admin, 2 amil, 3 ahli).
// Run on your own computer only; the service role key must never go in the web app.
//
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
//
// Logins created:  admin@khairatplus.local / admin123   ·   amil1, amil2 / amil123   ·   KWMZ-0001..3 / ahli123
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };
const DOMAIN = 'khairatplus.local';

async function user(email, password) {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user.id;
}

const adminId = await user(`admin@${DOMAIN}`, 'admin123');
must(await sb.from('profiles').insert({ id: adminId, role: 'admin', full_name: 'Pentadbir Khairat', username: `admin@${DOMAIN}` }));

const amils = [];
for (const [i, a] of [
  { full_name: 'Ahmad bin Ismail', ic_no: '700101-03-5011', phone: '012-3456789', area: 'Lorong Masjid' },
  { full_name: 'Rosli bin Hassan', ic_no: '750505-03-5123', phone: '013-9876543', area: 'Jalan Pantai' }
].entries()) {
  const username = `amil${i + 1}`;
  const uid = await user(`${username}@${DOMAIN}`, 'amil123');
  must(await sb.from('profiles').insert({ id: uid, role: 'amil', full_name: a.full_name, username }));
  amils.push(must(await sb.from('amils').insert({ ...a, user_id: uid, username }).select().single()));
}

const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;
const members = [
  { full_name: 'Mohd Zaki bin Abdullah', ic_no: '800212-03-5233', phone: '019-1112233', address: 'Lot 12, Lorong Masjid, Kg Wakaf Mek Zainab, 15100 Kota Bharu, Kelantan', amil: 0 },
  { full_name: 'Siti Aminah binti Yusof', ic_no: '820830-03-5422', phone: '017-2223344', address: 'Lot 45, Lorong Masjid, Kg Wakaf Mek Zainab, 15100 Kota Bharu, Kelantan', amil: 0 },
  { full_name: 'Che Mat bin Che Lah', ic_no: '650915-03-5099', phone: '014-5556677', address: 'Lot 7, Jalan Pantai, Kg Wakaf Mek Zainab, 15100 Kota Bharu, Kelantan', amil: 1 }
];
for (const [i, { amil, ...m }] of members.entries()) {
  const row = must(await sb.from('members').insert({ ...m, amil_id: amils[amil].id, join_date: `${year - 1}-01-01` }).select().single());
  const username = row.member_no.toLowerCase();
  const uid = await user(`${username}@${DOMAIN}`, 'ahli123');
  must(await sb.from('profiles').insert({ id: uid, role: 'ahli', full_name: m.full_name, username }));
  must(await sb.from('members').update({ user_id: uid }).eq('id', row.id));
  const upTo = Math.max(1, month - i);
  must(await sb.from('payments').insert(Array.from({ length: upTo }, (_, k) => ({ member_id: row.id, year, month: k + 1, amount: 5, method: 'cash', status: 'paid', recorded_by: amils[amil].user_id }))));
  if (i === 0) must(await sb.from('dependents').insert([
    { member_id: row.id, full_name: 'Nor Azura binti Ali', ic_no: '830404-03-5566', relationship: 'spouse', dob: '1983-04-04' },
    { member_id: row.id, full_name: 'Muhammad Irfan bin Mohd Zaki', ic_no: '100707-03-5011', relationship: 'child', dob: '2010-07-07' }
  ]));
  if (i === 2) must(await sb.from('dependents').insert({ member_id: row.id, full_name: 'Fatimah binti Daud', ic_no: '670101-03-5122', relationship: 'spouse', dob: '1967-01-01' }));
}
console.log('Demo data created. Admin login: admin@khairatplus.local / admin123');
