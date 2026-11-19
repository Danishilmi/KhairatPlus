-- KhairatPlus: Khairat Kematian Kampung Wakaf Mek Zainab
-- Run this whole file once in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ============ TABLES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','amil','ahli')),
  full_name text not null default '',
  username text unique,
  created_at timestamptz not null default now()
);

create table public.amils (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  username text unique,
  full_name text not null,
  ic_no text default '',
  phone text default '',
  email text default '',
  area text default '',
  created_at timestamptz not null default now()
);

create sequence public.member_no_seq;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_no text not null unique default ('KWMZ-' || lpad(nextval('public.member_no_seq')::text, 4, '0')),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  ic_no text default '',
  phone text default '',
  address text default '',      -- lokasi rumah (alamat)
  map_url text default '',      -- optional Google Maps / Waze link
  amil_id uuid references public.amils(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive','deceased')),
  join_date date not null default current_date,
  death_date date,
  created_at timestamptz not null default now()
);

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  full_name text not null,
  ic_no text default '',
  relationship text not null default 'other' check (relationship in ('spouse','child','parent','sibling','other')),
  dob date,
  phone text default '',
  status text not null default 'alive' check (status in ('alive','deceased')),
  death_date date,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  amount numeric(10,2) not null check (amount >= 0),
  method text not null default 'cash' check (method in ('cash','transfer','qr')),
  status text not null default 'paid' check (status in ('paid','pending','rejected')),
  reference text default '',
  note text default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year, month)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  deceased_type text not null check (deceased_type in ('member','dependent')),
  dependent_id uuid references public.dependents(id) on delete set null,
  deceased_name text not null,
  death_date date not null,
  nok_name text not null,         -- waris
  nok_ic text default '',
  nok_relationship text default '',
  nok_phone text default '',
  amount numeric(10,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','transfer','cheque')),
  reference text default '',
  paid_at date not null default current_date,
  notes text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index payouts_one_per_member on public.payouts(member_id) where deceased_type = 'member';
create unique index payouts_one_per_dependent on public.payouts(dependent_id) where deceased_type = 'dependent';

create table public.settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default 'Khairat Kematian Kampung Wakaf Mek Zainab',
  monthly_fee numeric(10,2) not null default 5,
  payout_amount numeric(10,2) not null default 1500,
  bank_name text default '',
  account_name text default '',
  account_no text default '',
  qr_image text default '',      -- data URL of the official DuitNow QR
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

create index on public.members(amil_id);
create index on public.dependents(member_id);
create index on public.payments(member_id, year);

-- ============ HELPERS ============
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.my_amil_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.amils where user_id = auth.uid()
$$;
create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- Members (ahli) may edit their own contact details only.
-- auth.uid() is null for the service role (Edge Function) and the SQL editor, which are trusted.
create or replace function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.member_no is distinct from old.member_no or new.user_id is distinct from old.user_id
       or new.amil_id is distinct from old.amil_id or new.status is distinct from old.status
       or new.join_date is distinct from old.join_date or new.death_date is distinct from old.death_date then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger members_guard before update on public.members for each row execute function public.guard_member_update();

-- Only admin can mark a dependent as deceased (via record_payout).
create or replace function public.guard_dependent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'alive'; new.death_date := null;
    elsif tg_op = 'UPDATE' then
      if new.status is distinct from old.status or new.death_date is distinct from old.death_date or new.member_id is distinct from old.member_id then
        raise exception 'not_allowed' using errcode = '42501';
      end if;
    elsif tg_op = 'DELETE' then
      if old.status = 'deceased' then raise exception 'cannot_delete_deceased' using errcode = '42501'; end if;
      return old;
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger dependents_guard before insert or update or delete on public.dependents for each row execute function public.guard_dependent();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- ============ RPCs ============
-- Ahli submits a QR/DuitNow payment for one or more months; it waits for amil verification.
create or replace function public.submit_qr_payment(p_year int, p_months int[], p_reference text)
returns setof public.payments
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.my_member_id();
  v_fee numeric := (select monthly_fee from public.settings where id = 1);
  m int;
begin
  if v_member is null then raise exception 'not_member' using errcode = '42501'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'missing_reference'; end if;
  if p_months is null or array_length(p_months, 1) is null then raise exception 'invalid_month'; end if;
  foreach m in array p_months loop
    if exists (select 1 from public.payments where member_id = v_member and year = p_year and month = m and status = 'paid') then
      raise exception 'already_paid';
    end if;
    return query
      insert into public.payments (member_id, year, month, amount, method, status, reference, recorded_by)
      values (v_member, p_year, m, v_fee, 'qr', 'pending', left(trim(p_reference), 100), auth.uid())
      on conflict (member_id, year, month) do update
        set amount = excluded.amount, method = 'qr', status = 'pending', reference = excluded.reference, recorded_by = excluded.recorded_by
      returning *;
  end loop;
end $$;

-- Admin records a death and the payout (wang khairat) to the next of kin, in one step.
create or replace function public.record_payout(
  p_member_id uuid, p_deceased_type text, p_dependent_id uuid, p_death_date date,
  p_nok_name text, p_nok_ic text, p_nok_relationship text, p_nok_phone text,
  p_amount numeric, p_method text, p_reference text, p_paid_at date, p_notes text)
returns public.payouts
language plpgsql security definer set search_path = public as $$
declare v_name text; v_row public.payouts;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_deceased_type = 'member' then
    update public.members set status = 'deceased', death_date = p_death_date where id = p_member_id returning full_name into v_name;
  else
    update public.dependents set status = 'deceased', death_date = p_death_date
      where id = p_dependent_id and member_id = p_member_id returning full_name into v_name;
  end if;
  if v_name is null then raise exception 'not_found'; end if;
  insert into public.payouts (member_id, deceased_type, dependent_id, deceased_name, death_date, nok_name, nok_ic,
    nok_relationship, nok_phone, amount, method, reference, paid_at, notes, created_by)
  values (p_member_id, p_deceased_type, case when p_deceased_type = 'dependent' then p_dependent_id end, v_name, p_death_date,
    p_nok_name, coalesce(p_nok_ic,''), coalesce(p_nok_relationship,''), coalesce(p_nok_phone,''), p_amount,
    coalesce(p_method,'cash'), coalesce(p_reference,''), coalesce(p_paid_at, current_date), coalesce(p_notes,''), auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- Make an existing auth user the admin (run once after creating the first user in the dashboard):
--   select public.bootstrap_admin('admin@example.com');
create or replace function public.bootstrap_admin(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'user_not_found'; end if;
  insert into public.profiles (id, role, full_name, username) values (v_id, 'admin', 'Admin', lower(p_email))
  on conflict (id) do update set role = 'admin';
end $$;
revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles   enable row level security;
alter table public.amils      enable row level security;
alter table public.members    enable row level security;
alter table public.dependents enable row level security;
alter table public.payments   enable row level security;
alter table public.payouts    enable row level security;
alter table public.settings   enable row level security;

-- profiles
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- amils
create policy "admin manages amils" on public.amils for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "amil sees self" on public.amils for select to authenticated using (user_id = auth.uid());
create policy "ahli sees assigned amil" on public.amils for select to authenticated
  using (id = (select amil_id from public.members where user_id = auth.uid()));

-- members
create policy "admin manages members" on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "amil sees assigned members" on public.members for select to authenticated using (amil_id = public.my_amil_id());
create policy "ahli sees self" on public.members for select to authenticated using (user_id = auth.uid());
create policy "ahli edits self" on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- dependents
create policy "admin manages dependents" on public.dependents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "amil sees dependents" on public.dependents for select to authenticated
  using (member_id in (select id from public.members where amil_id = public.my_amil_id()));
create policy "ahli manages own dependents" on public.dependents for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- payments
create policy "admin manages payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "amil manages assigned payments" on public.payments for all to authenticated
  using (member_id in (select id from public.members where amil_id = public.my_amil_id()))
  with check (member_id in (select id from public.members where amil_id = public.my_amil_id()));
create policy "ahli sees own payments" on public.payments for select to authenticated using (member_id = public.my_member_id());

-- payouts
create policy "admin manages payouts" on public.payouts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ahli sees own payouts" on public.payouts for select to authenticated using (member_id = public.my_member_id());

-- settings
create policy "anyone signed in reads settings" on public.settings for select to authenticated using (true);
create policy "admin updates settings" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
