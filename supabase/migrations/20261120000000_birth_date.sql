-- Birth date (tarikh lahir) for members and amils, filled from the IC number.
-- Dependents already have a dob column.
alter table public.members add column if not exists dob date;
alter table public.amils add column if not exists dob date;

-- Birth date from a Malaysian IC (YYMMDD in the first six digits; dashes are ignored).
-- A two-digit year above this year's two digits means 19YY, otherwise 20YY.
-- Returns null for incomplete ICs, impossible dates and future dates.
create or replace function public.dob_from_ic(ic text) returns date
language plpgsql stable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(ic, ''), '\D', '', 'g');
  yy int; v date;
begin
  if length(d) <> 12 then return null; end if;
  yy := substr(d, 1, 2)::int;
  begin
    v := make_date(case when yy > extract(year from current_date)::int % 100 then 1900 else 2000 end + yy,
                   substr(d, 3, 2)::int, substr(d, 5, 2)::int);
  exception when others then return null;
  end;
  return case when v > current_date then null else v end;
end $$;

-- Fill in birth dates for existing records that have a valid IC and no date yet.
update public.members set dob = public.dob_from_ic(ic_no) where dob is null and public.dob_from_ic(ic_no) is not null;
update public.amils set dob = public.dob_from_ic(ic_no) where dob is null and public.dob_from_ic(ic_no) is not null;
update public.dependents set dob = public.dob_from_ic(ic_no) where dob is null and public.dob_from_ic(ic_no) is not null;
