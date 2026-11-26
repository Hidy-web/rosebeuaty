-- 로즈 출장 헤어·메이크업 예약 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 괜찮아요. (데이터는 지워지지 않아요)

create extension if not exists pgcrypto;

-- ───────── 관리자 ─────────
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function is_admin() to anon, authenticated;

drop policy if exists "admins read self" on admins;
create policy "admins read self" on admins for select using (user_id = auth.uid());

-- ───────── 설정 (한 줄) ─────────
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default '로즈 출장 헤어·메이크업',
  tagline text not null default '행사 날 아침, 계신 곳으로 찾아갑니다',
  bank text not null default '',
  account text not null default '',
  holder text not null default '',
  deposit int not null default 30000 check (deposit >= 0),
  deadline_hours int not null default 3 check (deadline_hours between 1 and 72),
  open_min int not null default 420,
  close_min int not null default 1200,
  buffer_min int not null default 60 check (buffer_min >= 0),
  closed_dates date[] not null default '{}',
  regions jsonb not null default '[{"id":"seoul","name":"서울","fee":0},{"id":"etc","name":"그 외 지역 (상담 후 안내)","fee":null}]'
);
insert into settings (id) values (1) on conflict do nothing;
-- 행사일 며칠 전까지 예약금을 입금해야 확정되는지 (나중에 추가된 칸)
alter table settings add column if not exists confirm_days int not null default 3 check (confirm_days between 0 and 30);
-- 개인정보 보관 기간(개월)과 보호책임자 (나중에 추가된 칸)
alter table settings add column if not exists retention_months int not null default 12 check (retention_months between 1 and 60);
alter table settings add column if not exists privacy_officer text not null default '';
alter table settings add column if not exists privacy_contact text not null default '';
-- 별도 비용 안내 (주차비, 가발·속눈썹 등)
alter table settings add column if not exists extra_notice text not null default E'주차비는 실비로 받아요. (무료 주차가 되면 0원)\n가발(헤어피스)·속눈썹 비용은 별도로 받아요.';
-- 할증·할인·예약금 비율·환불 규정·약속 문구 (나중에 추가된 칸)
alter table settings add column if not exists early_fees jsonb not null default '[{"before":420,"fee":30000},{"before":360,"fee":50000}]';
alter table settings add column if not exists weekday_discount_pct int not null default 10 check (weekday_discount_pct between 0 and 50);
alter table settings add column if not exists group_min int not null default 4 check (group_min between 0 and 20);
alter table settings add column if not exists group_discount int not null default 10000 check (group_discount >= 0);
alter table settings add column if not exists deposit_pct int not null default 20 check (deposit_pct between 0 and 100);
alter table settings add column if not exists refund_policy text not null default E'행사 30일 전까지 취소하면 예약금을 전액 돌려드려요.\n행사 29일~8일 전에 취소하면 예약금에서 총 금액의 10%를 뺀 나머지를 돌려드려요.\n행사 7일 이내에 취소하거나 연락 없이 예약을 지키지 않으면 예약금은 돌려드리지 않아요.\n날짜·시간 변경은 행사 14일 전까지 1회 무료예요. 그 뒤에는 가능한 일정 안에서 1회 2만 원이 들어요.\n가게 사정으로 취소하게 되면 예약금 전액을 돌려드리고 총 금액의 10%를 더 배상해 드려요.\n천재지변·감염병 등으로 진행이 어려우면 위약금 없이 일정을 바꾸거나 전액 돌려드려요.';
alter table settings add column if not exists promise text not null default '행사 시간에 늦지 않도록 전날 꼭 확인 연락을 드려요.';
alter table settings enable row level security;
drop policy if exists "settings public read" on settings;
create policy "settings public read" on settings for select using (true);
drop policy if exists "settings admin update" on settings;
create policy "settings admin update" on settings for update using (is_admin()) with check (is_admin());

-- ───────── 메뉴 ─────────
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30),
  sort int not null default 0
);
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  duration_min int not null default 60 check (duration_min between 30 and 600),
  price int not null check (price >= 0),
  sort int not null default 0,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table service_categories enable row level security;
alter table services enable row level security;
drop policy if exists "svc cat public read" on service_categories;
create policy "svc cat public read" on service_categories for select using (true);
drop policy if exists "svc cat admin write" on service_categories;
create policy "svc cat admin write" on service_categories for all using (is_admin()) with check (is_admin());
drop policy if exists "svc public read" on services;
create policy "svc public read" on services for select using (true);
drop policy if exists "svc admin write" on services;
create policy "svc admin write" on services for all using (is_admin()) with check (is_admin());

-- ───────── 포트폴리오 ─────────
create table if not exists portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30),
  sort int not null default 0
);
create table if not exists portfolio_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references portfolio_categories on delete cascade,
  title text not null default '',
  image_path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table portfolio_categories enable row level security;
alter table portfolio_items enable row level security;
drop policy if exists "pf cat public read" on portfolio_categories;
create policy "pf cat public read" on portfolio_categories for select using (true);
drop policy if exists "pf cat admin write" on portfolio_categories;
create policy "pf cat admin write" on portfolio_categories for all using (is_admin()) with check (is_admin());
drop policy if exists "pf public read" on portfolio_items;
create policy "pf public read" on portfolio_items for select using (true);
drop policy if exists "pf admin write" on portfolio_items;
create policy "pf admin write" on portfolio_items for all using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict do nothing;
drop policy if exists "portfolio admin upload" on storage.objects;
create policy "portfolio admin upload" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and is_admin());
drop policy if exists "portfolio admin delete" on storage.objects;
create policy "portfolio admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and is_admin());

-- ───────── 리뷰 ─────────
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  rating int not null check (rating between 1 and 5),
  service_label text not null default '' check (char_length(service_label) <= 60),
  body text not null check (char_length(body) between 1 and 1000),
  hidden boolean not null default false,
  reply text not null default '',
  created_at timestamptz not null default now()
);
alter table reviews enable row level security;
drop policy if exists "reviews public read visible" on reviews;
create policy "reviews public read visible" on reviews for select using (not hidden or is_admin());
-- 리뷰는 아래 submit_review 함수로만 써요. (예약번호·연락처가 맞는 실제 손님만, 예약당 한 번)
drop policy if exists "reviews public insert" on reviews;
drop policy if exists "reviews admin update" on reviews;
create policy "reviews admin update" on reviews for update using (is_admin()) with check (is_admin());
drop policy if exists "reviews admin delete" on reviews;
create policy "reviews admin delete" on reviews for delete using (is_admin());

-- ───────── 예약 ─────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text not null,
  items jsonb not null,
  region text not null,
  region_name text not null default '',
  address text not null,
  event_note text not null default '',
  date date not null,
  start_min int not null,
  duration_min int not null,
  subtotal int not null,
  travel_fee int,
  total int not null,
  deposit int not null,
  status text not null default 'pending' check (status in ('pending','confirmed','done','canceled')),
  memo text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on bookings (date);
-- 어느 예약의 리뷰인지 (예약당 리뷰 한 개)
alter table bookings add column if not exists early_fee int not null default 0;
alter table bookings add column if not exists discount int not null default 0;
-- 관리자가 손님에게 보내는 리뷰 링크용 비밀 값
alter table bookings add column if not exists review_token text unique default replace(gen_random_uuid()::text, '-', '');
alter table reviews add column if not exists booking_id uuid unique references bookings(id) on delete set null;
alter table bookings enable row level security;
-- 손님은 예약 목록을 직접 볼 수 없어요. 예약은 아래 함수로만 만들어요.
drop policy if exists "bookings admin all" on bookings;
create policy "bookings admin all" on bookings for all using (is_admin()) with check (is_admin());

-- 손님 화면이 빈 시간을 계산할 때 쓰는 함수 (이름·연락처는 돌려주지 않음)
create or replace function busy_slots(d_from date, d_to date)
returns table (date date, start_min int, end_min int)
language sql stable security definer set search_path = public as $$
  select b.date, b.start_min, b.start_min + b.duration_min
  from bookings b
  where b.status in ('pending','confirmed') and b.date between d_from and d_to;
$$;
grant execute on function busy_slots(date, date) to anon, authenticated;

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

-- 손님이 예약번호 + 연락처로 상태를 확인하는 함수
create or replace function lookup_booking(p_code text, p_phone text)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('code', code, 'status', status, 'date', date, 'start_min', start_min,
                           'items', items, 'total', total, 'deposit', deposit, 'address', address)
  from bookings
  where code = upper(btrim(p_code))
    and regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  limit 1;
$$;
grant execute on function lookup_booking(text, text) to anon, authenticated;

-- 실제 손님만 리뷰를 써요. 아래 셋 중 하나로 본인 확인:
--   1) 관리자가 보내 준 리뷰 링크(review_token)  2) 예약번호 + 연락처  3) 연락처 + 행사 날짜
-- 확정·완료된 예약이고 방문일이 지났으며, 예약당 한 번만 쓸 수 있어요.
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

-- 보관 기간이 지난 예약의 개인정보를 지워요. 관리자 화면을 열 때마다 자동으로 실행돼요.
-- 날짜·메뉴·금액은 매출 확인용으로 남기고 이름·연락처·주소·행사 정보·요청사항만 지워요.
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

-- ───────── 기본 메뉴 (관리자 화면에서 고칠 수 있어요) ─────────
do $$
declare c_hair uuid; c_mk uuid; c_pk uuid; c_add uuid;
begin
  if not exists (select 1 from service_categories) then
    insert into service_categories (name, sort) values ('헤어', 1) returning id into c_hair;
    insert into service_categories (name, sort) values ('메이크업', 2) returning id into c_mk;
    insert into service_categories (name, sort) values ('헤어+메이크업', 3) returning id into c_pk;
    insert into service_categories (name, sort) values ('추가', 4) returning id into c_add;
    insert into services (category_id, name, description, duration_min, price, sort) values
      (c_hair, '하객 헤어', '', 60, 70000, 1),
      (c_hair, '돌잔치 엄마 헤어', '', 60, 90000, 2),
      (c_mk, '하객 메이크업', '오래 가는 베이스', 60, 100000, 1),
      (c_mk, '돌잔치 엄마 메이크업', '사진에 잘 받는 화사한 톤', 60, 100000, 2),
      (c_pk, '하객 헤어+메이크업', '', 90, 150000, 1),
      (c_pk, '돌잔치 엄마 헤어+메이크업', '가장 많이 찾으세요', 120, 190000, 2),
      (c_pk, '가족사진·촬영 헤어+메이크업', '스튜디오 동행 가능', 120, 200000, 3),
      (c_add, '아이 헤어', '돌잔치 주인공·형제자매', 30, 30000, 1),
      (c_add, '어머님 메이크업', '양가 어머님 등 동반 가족', 60, 90000, 2);
  end if;
  if not exists (select 1 from portfolio_categories) then
    insert into portfolio_categories (name, sort) values ('돌잔치', 1), ('하객', 2), ('촬영', 3);
  end if;
end $$;

-- ── 권한 (새 Supabase 프로젝트는 테이블 권한이 자동으로 주어지지 않아요) ──
-- 실제로 무엇을 보고 바꿀 수 있는지는 위의 RLS 규칙이 막아요.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
revoke insert on public.reviews from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
