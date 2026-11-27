-- 2026-11-27 카카오톡 예약 알림 (여러 번 실행해도 괜찮아요)
-- KAKAO_START
-- 카카오 연결 정보(토큰)를 보관하는 표. 알림 받는 사람 한 명당 한 줄(최대 5명). 서버(비밀 키)만 읽고 쓸 수 있어요.
create table if not exists kakao_link (
  id int primary key default 1,
  label text not null default '',
  access_token text,
  access_expires_at timestamptz,
  refresh_token text,
  refresh_expires_at timestamptz,
  oauth_state text,
  oauth_state_at timestamptz,
  last_error text not null default '',
  last_sent_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table kakao_link add column if not exists label text not null default '';
alter table kakao_link drop constraint if exists kakao_link_id_check;
alter table kakao_link add constraint kakao_link_id_check check (id between 1 and 5);
alter table kakao_link enable row level security;
revoke all on public.kakao_link from anon, authenticated;
grant select, insert, update, delete on public.kakao_link to service_role;
grant select, update on public.bookings to service_role;
-- 같은 예약으로 알림을 두 번 보내지 않도록 보낸 시각을 적어 둬요.
alter table bookings add column if not exists admin_notified_at timestamptz;
-- KAKAO_END
