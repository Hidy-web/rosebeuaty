-- 2026-11-26 추가 기능 한 번에 적용 (여러 번 실행해도 괜찮아요)
alter table settings add column if not exists confirm_days int not null default 3 check (confirm_days between 0 and 30);
alter table settings add column if not exists retention_months int not null default 12 check (retention_months between 1 and 60);
alter table settings add column if not exists privacy_officer text not null default '';
alter table settings add column if not exists privacy_contact text not null default '';
alter table settings add column if not exists extra_notice text not null default E'주차비는 실비로 받아요. (무료 주차가 되면 0원)\n가발(헤어피스)·속눈썹 비용은 별도로 받아요.';

create or replace function purge_expired_bookings()
returns int
language plpgsql security definer set search_path = public as $$
declare keep_months int; n int;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  select coalesce(retention_months, 12) into keep_months from settings where id = 1;
  update bookings set name = '(파기됨)', phone = '', address = '', event_note = '', memo = ''
   where date < (now() at time zone 'Asia/Seoul')::date - make_interval(months => keep_months)
     and (phone <> '' or address <> '' or name <> '(파기됨)');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function purge_expired_bookings() from public, anon;
grant execute on function purge_expired_bookings() to authenticated;

alter table reviews add column if not exists booking_id uuid unique references bookings(id) on delete set null;
drop policy if exists "reviews public insert" on reviews;
revoke insert on public.reviews from anon;
create or replace function submit_review(p_code text, p_phone text, p_rating int, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  today date := (now() at time zone 'Asia/Seoul')::date;
  label text;
begin
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 5 then raise exception 'invalid_body'; end if;
  select * into b from bookings
   where code = upper(btrim(coalesce(p_code, '')))
     and phone <> ''
     and regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
   for update;
  if not found then raise exception 'review_not_found'; end if;
  if b.status not in ('confirmed', 'done') or b.date > today then raise exception 'review_not_yet'; end if;
  if exists (select 1 from reviews where booking_id = b.id) then raise exception 'already_reviewed'; end if;
  select left(string_agg(i->>'name', ', '), 60) into label from jsonb_array_elements(b.items) i;
  insert into reviews (name, rating, service_label, body, booking_id)
  values (left(btrim(b.name), 1) || '*', p_rating, coalesce(label, ''), left(btrim(p_body), 1000), b.id);
end $$;
grant execute on function submit_review(text, text, int, text) to anon, authenticated;
