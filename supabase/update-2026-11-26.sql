-- 2026-11-26 추가 기능 한 번에 적용 (여러 번 실행해도 괜찮아요)

alter table settings add column if not exists confirm_days int not null default 3 check (confirm_days between 0 and 30);
alter table settings add column if not exists retention_months int not null default 12 check (retention_months between 1 and 60);
alter table settings add column if not exists privacy_officer text not null default '';
alter table settings add column if not exists privacy_contact text not null default '';
alter table settings add column if not exists extra_notice text not null default E'주차비는 실비로 받아요. (무료 주차가 되면 0원)\n가발(헤어피스)·속눈썹 비용은 별도로 받아요.';
alter table settings add column if not exists early_fees jsonb not null default '[{"before":420,"fee":30000},{"before":360,"fee":50000}]';
alter table settings add column if not exists weekday_discount_pct int not null default 10 check (weekday_discount_pct between 0 and 50);
alter table settings add column if not exists group_min int not null default 4 check (group_min between 0 and 20);
alter table settings add column if not exists group_discount int not null default 10000 check (group_discount >= 0);
alter table settings add column if not exists deposit_pct int not null default 20 check (deposit_pct between 0 and 100);
alter table settings add column if not exists refund_policy text not null default E'행사 30일 전까지 취소하면 예약금을 전액 돌려드려요.\n행사 29일~8일 전에 취소하면 예약금에서 총 금액의 10%를 뺀 나머지를 돌려드려요.\n행사 7일 이내에 취소하거나 연락 없이 예약을 지키지 않으면 예약금은 돌려드리지 않아요.\n날짜·시간 변경은 행사 14일 전까지 1회 무료예요. 그 뒤에는 가능한 일정 안에서 1회 2만 원이 들어요.\n가게 사정으로 취소하게 되면 예약금 전액을 돌려드리고 총 금액의 10%를 더 배상해 드려요.\n천재지변·감염병 등으로 진행이 어려우면 위약금 없이 일정을 바꾸거나 전액 돌려드려요.';
alter table settings add column if not exists promise text not null default '행사 시간에 늦지 않도록 전날 꼭 확인 연락을 드려요.';
alter table bookings add column if not exists early_fee int not null default 0;
alter table bookings add column if not exists discount int not null default 0;
alter table bookings add column if not exists review_token text unique default replace(gen_random_uuid()::text, '-', '');

alter table reviews add column if not exists booking_id uuid unique references bookings(id) on delete set null;
drop policy if exists "reviews public insert" on reviews;
revoke insert on public.reviews from anon;

create or replace function purge_expired_bookings()
returns int
language plpgsql security definer set search_path = public as $$
declare
  keep_months int;
  n int;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  select coalesce(retention_months, 12) into keep_months from settings where id = 1;
  update bookings
     set name = '(파기됨)', phone = '', address = '', event_note = '', memo = ''
   where date < (now() at time zone 'Asia/Seoul')::date - make_interval(months => keep_months)
     and (phone <> '' or address <> '' or name <> '(파기됨)');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function purge_expired_bookings() from public, anon;
grant execute on function purge_expired_bookings() to authenticated;

drop function if exists submit_review(text, text, int, text);
create or replace function submit_review(p_token text, p_code text, p_phone text, p_date date, p_rating int, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  today date := (now() at time zone 'Asia/Seoul')::date;
  digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  label text;
  matched boolean := false;
begin
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 5 then raise exception 'invalid_body'; end if;

  if coalesce(btrim(p_token), '') <> '' then
    select * into b from bookings where review_token = btrim(p_token) for update;
    matched := found;
  elsif coalesce(btrim(p_code), '') <> '' then
    select * into b from bookings
     where code = upper(btrim(p_code)) and phone <> '' and regexp_replace(phone, '[^0-9]', '', 'g') = digits
     for update;
    matched := found;
  elsif p_date is not null and char_length(digits) >= 10 then
    -- 같은 날 같은 번호로 예약이 여러 개면 아직 리뷰가 없는 확정·완료 예약을 먼저 골라요.
    select * into b from bookings x
     where x.date = p_date and x.phone <> '' and regexp_replace(x.phone, '[^0-9]', '', 'g') = digits
     order by (x.status in ('confirmed', 'done')) desc, exists (select 1 from reviews r where r.booking_id = x.id), x.created_at
     limit 1
     for update;
    matched := found;
  end if;

  if not matched then raise exception 'review_not_found'; end if;
  if b.status not in ('confirmed', 'done') or b.date > today then raise exception 'review_not_yet'; end if;
  if exists (select 1 from reviews where booking_id = b.id) then raise exception 'already_reviewed'; end if;
  select left(string_agg(i->>'name', ', '), 60) into label from jsonb_array_elements(b.items) i;
  insert into reviews (name, rating, service_label, body, booking_id)
  values (left(btrim(b.name), 1) || '*', p_rating, coalesce(label, ''), left(btrim(p_body), 1000), b.id);
end $$;
grant execute on function submit_review(text, text, text, date, int, text) to anon, authenticated;

create or replace function create_booking(
  p_name text, p_phone text, p_items jsonb, p_region text, p_address text,
  p_event_note text, p_date date, p_start int, p_memo text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  it jsonb;
  svc services;
  n int;
  dur int := 0;
  sub int := 0;
  fee int;
  region_name text;
  items_out jsonb := '[]'::jsonb;
  now_seoul timestamp := now() at time zone 'Asia/Seoul';
  new_code text;
  people int := 0;
  early int := 0;
  disc int := 0;
  tot int;
  dep int;
begin
  select * into s from settings where id = 1;

  p_name := btrim(coalesce(p_name, ''));
  p_phone := btrim(coalesce(p_phone, ''));
  p_address := btrim(coalesce(p_address, ''));
  if char_length(p_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if p_phone !~ '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$' then raise exception 'invalid_phone'; end if;
  if char_length(p_address) not between 2 and 200 then raise exception 'invalid_address'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'invalid_items'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    n := (it->>'n')::int;
    if n is null or n not between 1 and 10 then raise exception 'invalid_items'; end if;
    select * into svc from services where id = (it->>'id')::uuid and not deleted;
    if not found then raise exception 'menu_not_found'; end if;
    dur := dur + svc.duration_min * n;
    sub := sub + svc.price * n;
    people := people + n;
    items_out := items_out || jsonb_build_object('id', svc.id, 'name', svc.name, 'price', svc.price, 'n', n);
  end loop;

  select (x->>'fee')::int, x->>'name' into fee, region_name
  from jsonb_array_elements(s.regions) x where x->>'id' = p_region;
  if region_name is null then raise exception 'invalid_region'; end if;

  if p_date < now_seoul::date or p_date > now_seoul::date + 180 then raise exception 'invalid_date'; end if;
  if p_date = any (s.closed_dates) then raise exception 'closed_day'; end if;
  if p_start % 30 <> 0 or p_start < s.open_min or p_start + dur > s.close_min then raise exception 'invalid_time'; end if;
  if p_date = now_seoul::date and p_start <= extract(hour from now_seoul) * 60 + extract(minute from now_seoul) + 120 then
    raise exception 'invalid_time';
  end if;

  -- 같은 날짜 예약이 동시에 들어와도 겹치지 않도록 잠금
  perform pg_advisory_xact_lock(hashtext('booking-' || p_date::text));
  if exists (
    select 1 from bookings b
    where b.date = p_date and b.status in ('pending','confirmed')
      and p_start < b.start_min + b.duration_min + s.buffer_min
      and p_start + dur + s.buffer_min > b.start_min
  ) then
    raise exception 'slot_taken';
  end if;

  -- 금액 계산 (lib/pricing.ts 와 같은 규칙)
  select coalesce(max((t->>'fee')::int), 0) into early
    from jsonb_array_elements(coalesce(s.early_fees, '[]'::jsonb)) t where p_start < (t->>'before')::int;
  if s.weekday_discount_pct > 0 and extract(isodow from p_date) between 1 and 5 then
    disc := disc + floor(sub * s.weekday_discount_pct / 100.0 / 1000) * 1000;
  end if;
  if s.group_min > 0 and people >= s.group_min then disc := disc + s.group_discount * people; end if;
  disc := least(disc, sub);
  tot := sub - disc + coalesce(fee, 0) + early;
  dep := case when s.deposit_pct > 0 then greatest(s.deposit, (floor(tot * s.deposit_pct / 100.0 / 1000) * 1000)::int) else s.deposit end;

  new_code := 'R' || to_char(now_seoul, 'MMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  insert into bookings (code, name, phone, items, region, region_name, address, event_note, date, start_min,
                        duration_min, subtotal, travel_fee, total, deposit, memo, early_fee, discount)
  values (new_code, p_name, p_phone, items_out, p_region, region_name, p_address, left(coalesce(p_event_note, ''), 100),
          p_date, p_start, dur, sub, fee, tot, dep, left(coalesce(p_memo, ''), 500), early, disc);

  return json_build_object('code', new_code, 'items', items_out, 'subtotal', sub, 'travel_fee', fee,
                           'total', tot, 'deposit', dep, 'duration', dur, 'early_fee', early, 'discount', disc,
                           'region_name', region_name);
end;
$$;
grant execute on function create_booking(text, text, jsonb, text, text, text, date, int, text) to anon, authenticated;

-- 이른 시간 예약을 받도록 가장 이른 방문을 05:00 으로 (관리자 설정에서 바꿀 수 있어요)
update settings set open_min = 300 where id = 1 and open_min = 420;
