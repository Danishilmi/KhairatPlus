-- Optional real email for members, used as their login email (they can still log in with their Member ID).
alter table public.members add column if not exists email text default '';

-- Members may not change their own login email directly; the admin sets it through the admin-users function.
create or replace function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.member_no is distinct from old.member_no or new.user_id is distinct from old.user_id
       or new.amil_id is distinct from old.amil_id or new.status is distinct from old.status
       or new.join_date is distinct from old.join_date or new.death_date is distinct from old.death_date
       or new.email is distinct from old.email then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
