# 로즈 출장 헤어·메이크업 예약

돌잔치·하객·촬영 출장 헤어메이크업 손님 예약 웹앱이에요. 휴대폰 화면에 맞춰져 있고, 홈 화면에 추가하면 앱처럼 열려요.

- 손님 화면 `/` : 메뉴·가격, 포트폴리오, 리뷰, 예약하기(메뉴·인원 → 날짜·시간 → 방문 정보 → 예약금 입금 안내), 예약 확인
- 관리자 화면 `/admin` : 예약 확정·취소, 출장 일정, 메뉴·분류 관리, 포트폴리오 사진, 리뷰 답글·숨기기, 계좌·예약금·지역 설정

사용 기술: Next.js, Supabase(데이터·관리자 로그인·사진 저장), Vercel(배포)

## 처음 설정하기 (한 번만)

### 1. Supabase 데이터베이스 만들기
1. supabase.com 에서 프로젝트를 열고 왼쪽 메뉴 **SQL Editor** 로 가요.
2. 이 저장소의 `supabase/schema.sql` 내용을 전부 복사해 붙여넣고 **Run** 을 눌러요.
3. **Authentication > Sign In / Providers** 에서 **Allow new users to sign up** 을 꺼요. (관리자 말고는 가입할 수 없게)

### 2. 관리자 계정 만들기
1. **Authentication > Users > Add user > Create new user** 에서 관리자 이메일과 비밀번호를 넣고 만들어요. (Auto Confirm 체크)
2. **SQL Editor** 에서 아래를 실행해요. 이메일은 방금 만든 주소로 바꿔요.
   ```sql
   insert into admins (user_id) select id from auth.users where email = '관리자이메일@example.com';
   ```

### 3. Vercel 에 배포하기
1. vercel.com 에서 **Add New > Project** 를 누르고 이 GitHub 저장소를 Import 해요.
2. **Environment Variables** 에 두 개를 넣어요. 값은 Supabase **Project Settings > API** 에 있어요.
   - `NEXT_PUBLIC_SUPABASE_URL` : Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : anon public 키
3. **Deploy** 를 눌러요. 끝나면 나오는 주소가 손님용 예약 사이트예요.

### 4. 첫 설정
배포된 주소 뒤에 `/admin` 을 붙여 들어가 로그인한 뒤 **설정** 탭에서 가게 이름, 입금 계좌, 예약금을 꼭 입력해 주세요.

## 카카오톡 예약 알림 (선택)
손님이 예약하면 알림 받는 사람(최대 5명)의 카카오톡 '나와의 채팅'으로 예약 내용이 와요. 카카오 '나에게 보내기' 기능이라 무료예요.

1. Supabase **SQL Editor** 에서 `supabase/update-2026-11-27-kakao.sql` 을 실행해요.
2. developers.kakao.com 에서 앱을 만들고
   - **앱 > 플랫폼 키 > REST API 키** 에서 리다이렉트 URI 에 `https://내사이트주소/api/kakao/callback` 을 넣어요. 이 화면의 REST API 키와 클라이언트 시크릿을 복사해 둬요.
   - **카카오 로그인** 을 켜고, **카카오 로그인 > 동의항목** 에서 '카카오톡 메시지 전송'을 켜요.
   - **앱 > 제품 링크 관리 > 웹 도메인** 에 `https://내사이트주소` 를 넣어요.
3. Vercel **Settings > Environment Variables** 에 `SUPABASE_SECRET_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 를 넣고 다시 배포해요.
4. `/admin` > **설정** 탭 > **카카오톡 예약 알림** 에서 이름을 적고 **이 휴대폰에서 연결** 을 눌러 카카오 로그인해요. 시험 알림이 오면 끝이에요.
5. 다른 사람도 받으려면: 카카오 앱 **팀원(멤버)** 으로 그분 카카오 계정을 초대하고, 설정 탭에서 그분 이름을 적고 **초대 링크 복사** → 그분께 카톡으로 보내요. 그분이 링크를 열어 카카오 로그인하면 끝이에요. (링크는 하루 동안 쓸 수 있어요)

알림이 안 가도 예약은 정상으로 저장돼요. 한 사람에게 실패해도 다른 사람에게는 가요. 카카오 연결은 두 달쯤 쓰지 않으면 만료될 수 있는데, 관리자 설정 탭을 열 때마다 자동으로 연장돼요.

## 휴대폰 홈 화면에 추가
- 아이폰(사파리): 공유 버튼 → **홈 화면에 추가**
- 안드로이드(크롬): 메뉴(⋮) → **홈 화면에 추가** 또는 **앱 설치**

## 개발
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
```

## 알아둘 점
- 손님은 예약 목록을 직접 볼 수 없어요. 빈 시간 계산과 예약 저장은 데이터베이스 함수(`busy_slots`, `create_booking`)가 해요. 같은 시간에 두 예약이 동시에 들어와도 겹치지 않게 막아요.
- 메뉴를 지워도 이미 들어온 예약에는 메뉴 이름과 가격이 그대로 남아요.
- 아직 없는 기능: 예약 확정 문자 자동 발송, 입금 기한이 지난 예약 자동 취소.
