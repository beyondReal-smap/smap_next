# SMAP 백엔드 엔드포인트 인벤토리 (Python → Go 이식용)
> 자동 생성 — 워크플로 `py-backend-inventory` 결과. 추정 없이 실제 코드 분석 기반.
> 총 **206개 엔드포인트** / 9개 도메인. `/health`(Phase1 완료)·dead 라우터 제외.

## misc-read · /weather /notices /app /admin
- **엔드포인트**: 14개 · **설계서 Phase**: 2 · **risk**: medium · **견적**: 4.5일
- **서비스 의존**: weather_service (KMA API — endpoints에서는 미사용, daily_jobs 배치에서만 호출), app.core.cache (cached/cache_delete/cache_delete_pattern)
- **이식 난점**:
  - /app/version-check가 DB·외부의존 없는 순수 로직이라 Phase 2 PoC 최우선 후보 (버전 파싱 _parse_version 동등 구현만 필요, 0.5일)
  - /admin/groups의 4-서브쿼리 집계 조인(active_member_sq 재사용 포함)을 GORM 또는 raw SQL로 동등 재현 — 도메인 내 최고 난이도(very_high에 근접한 high)
  - weather_service.py(KMA Lambert 격자변환+단기예보 API+재시도)는 weather 엔드포인트가 아니라 daily_jobs 배치에서만 호출됨 — HTTP 엔드포인트 이식 범위에서 분리. 단 배치 포팅 시 latlong_to_grid/parse_kma_forecast/base_datetime 로직 정밀 이식 필요(외부 KMA API 의존)
  - 캐시 정합성: @cached/cache_delete/cache_delete_pattern(Redis SCAN 패턴)을 Go 캐시 계층에 동등 구현. weather:member 캐시 키 포맷과 notices:* 패턴 삭제, hide/show의 캐시 무효화 누락 비대칭 처리
  - PUT /weather/member, GET /notices/{id}(increment_hit)는 GET/쓰기 혼재·untyped dict body — Go에서 구조체화 및 원자적 카운터 UPDATE 필요. PUT 날씨 무인증 수정은 보안 검토 대상
  - 에러 흡수 패턴(success:false 폴백)을 Go에서 명시적 에러 구분으로 전환할지 동작 보존할지 정책 결정 필요

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/weather/current` | optional | low | read-only · 전체 try/except로 예외를 success:false로 흡수 — Go에서는 에러 구분 권장. get_current_user_id를 Depends가 아닌 함수 직접 호출(authorization Header 수동 파싱). temp_min 폴백 tmx-5, pop 폴백 '20' 등 매직값 다수. weather_service 미연동(임시 기본값 하드코딩). |
| 2 | GET | `/weather/member/{member_id}` | none | low | read-only · @cached('weather:member', ttl=180) 데코레이터 — Go 이식 시 캐시 키 포맷 'weather:member:{"member_id": N}' 동일하게 맞춰야 PUT의 cache_delete와 정합. 인증 없음(공개). |
| 3 | PUT | `/weather/member/{member_id}` | none | low | **DB 쓰기(member_t UPDATE), 캐시 무효화(cache_delete weather:member:{member_id})** · 인증 없이 임의 회원 날씨 수정 가능 — 보안 이슈(Go 이식 시 검토 권장). body가 Pydantic 스키마 아닌 raw dict — Go에서는 구조체 정의 필요. sky는 'isdigit()'면 int 변환, 아니면 None. mt_weather_date=utcnow() 자동 갱신. |
| 4 | GET | `/notices/` | none | low | read-only · @cached('notices:list', ttl=300). CRUD 클래스(NoticeCRUD) 경유 — count 1쿼리 + list 1쿼리. nt_show enum(Y/N) 필터. order by nt_wdate desc. |
| 5 | GET | `/notices/search` | none | low | read-only · nt_title.contains(kw) OR nt_content.contains(kw) → LIKE '%kw%'. Go(GORM)에서 동일 OR LIKE 조건 구성. 캐시 없음. |
| 6 | GET | `/notices/{notice_id}` | none | low | **increment_hit=true(기본)일 때 DB 쓰기(nt_hit +1 UPDATE+commit). 그 외 read-only** · GET이지만 기본값으로 조회수 증가 — read-with-side-effect. 동시성 시 nt_hit 경합 가능(읽고-증가 비원자적), Go 이식 시 UPDATE ... nt_hit=nt_hit+1 원자적 처리 권장. |
| 7 | POST | `/notices/` | admin | low | **DB 쓰기(notice_t INSERT), 캐시 무효화 cache_delete_pattern('notices:*')** · get_required_admin_id → mt_level==9 아니면 403, 미인증 401, member_t 조회(mt_status=1) 추가. cache_delete_pattern은 Redis SCAN 패턴 삭제 — Go 캐시 구현 시 패턴 삭제 지원 필요. |
| 8 | PUT | `/notices/{notice_id}` | admin | low | **DB 쓰기(notice_t UPDATE), 캐시 무효화 cache_delete_pattern('notices:*')** · model_dump(exclude_unset=True)로 전달된 필드만 setattr — Go에서 partial update(포인터 필드/맵) 처리 필요. admin 권한 검사. |
| 9 | DELETE | `/notices/{notice_id}` | admin | trivial | **DB 쓰기(notice_t DELETE 하드삭제), 캐시 무효화 cache_delete_pattern('notices:*')** · 하드 삭제(soft delete 아님). admin 권한 검사. |
| 10 | PATCH | `/notices/{notice_id}/hide` | admin | trivial | **DB 쓰기(notice_t nt_show=N UPDATE)** · hide/show는 캐시 무효화 누락(cache_delete_pattern 호출 없음) — POST/PUT/DELETE와 비대칭. Go 이식 시 캐시 정합성 위해 무효화 추가 검토. admin 권한. |
| 11 | PATCH | `/notices/{notice_id}/show` | admin | trivial | **DB 쓰기(notice_t nt_show=Y UPDATE)** · hide와 동일하게 캐시 무효화 누락. admin 권한. |
| 12 | GET | `/app/version-check` | none | trivial | read-only · DB 미사용. settings.MIN_APP_VERSION_IOS/ANDROID(env)와 _parse_version(점 구분 튜플 비교, 비숫자→숫자추출/0) 로직만. ios가 아니면 전부 android 취급. Phase 2 PoC 후보로 가장 단순 — Go 포팅 시 버전 파싱 함수만 동등 구현. |
| 13 | GET | `/admin/stats` | admin | low | read-only · count 쿼리 3개(member mt_level>=2, group 전체, 오늘 가입 func.date(mt_wdate)==today). func.date()는 MySQL DATE() — Go(GORM)에서 raw 또는 DATE() 표현 주의. pending_inquiries는 문의 테이블 없어 0 고정. 예외를 success:false로 흡수. |
| 14 | GET | `/admin/groups` | admin | high | read-only · N+1 회피 위해 4개 서브쿼리(member_count, active_member, schedule_count, location_count) outerjoin + coalesce. active_member_sq를 schedule/location 서브쿼리에서 재사용해 활성 멤버 기준 집계. Go(GORM)에서 동등한 서브쿼리 조인 구성이 핵심 난이도. 활성 조건: sgdt_exit='N' AND sgdt_show='Y', sst_show='Y', slt_show='Y'. show_hidden=false면 sgt_show='Y' 필터. owner_name 폴백: mt_name→mt_nickname→'사용자 {mt_idx}'. 예외는 raise(삼키지 않음). |

## auth · /auth /users
- **엔드포인트**: 25개 · **설계서 Phase**: 4 · **risk**: high · **견적**: 7일
- **서비스 의존**: member_service(google_login/apple_login), sms_service(send_password_reset_sms), email_service(send_password_reset_email), sms.py 인메모리 인증상태, crud_auth, crud_refresh_token, crud_member(get_by_phone/get_random_avatar)
- **이식 난점**:
  - JWT 시크릿 공유 검증 — Python은 SECRET_KEY(=JWT_SECRET_KEY property 별칭)/HS256으로 발급·검증. Go(golang-jwt)도 동일 JWT_SECRET_KEY 환경변수+HS256 사용해야 기존 발급 토큰 호환. access exp=43200분(30일)
  - refresh 회전 동등 구현 — chain_id(UUID) 기준 rotation, raw는 secrets.token_urlsafe(48), DB엔 SHA-256 해시만 저장. revoked raw 재유입 시 chain 전체 revoke(reuse detection)를 트랜잭션으로 정확히 복제. replaced_by_hash 체이닝 포함
  - 토큰 페이로드 불일치 — /login·/register·/kakao는 {mt_idx,mt_id,mt_name}, /login-original·/me는 UserIdentity(mt_level 포함). 검증 측은 mt_idx or sub 폴백. 동일 claim 구조 유지 필요
  - 에러 계약 차이 — 대부분 라우터가 try/except로 실패 시 HTTP 200+success=false 반환(401 안 씀). /login-original·/refresh·/me·일부 reset만 401/4xx raise. Go에서 status code 계약 그대로 보존 필요
  - raw SQL 4개(find-user-by-email/phone의 그룹 집계·스케줄 조회) — GORM Raw로 파라미터 바인딩 유지하며 이식
  - SMS 인증 상태가 sms.py 모듈 인메모리 — Go 멀티 인스턴스에서 동작 안 함, Redis 등 외부 저장소로 전환 필요
  - bcrypt cost 불일치 — register는 PASSWORD_BCRYPT_COST 정책, reset-password의 update_user_password는 gensalt() 기본 cost. Go bcrypt로 PHP/Python 해시 상호 검증 보장 필요
  - users.py 7개 라우터 전부 무인증(목록/생성/수정/물리삭제 포함) + Member 모델 클래스메서드 SQL 별도 확인 필요

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | POST | `/auth/login` | none | medium | **DB쓰기(mt_ldate/mt_adate/기기정보 update), refresh 체인 발급, access 토큰 발급** · deps=JWT(jose/HS256), bcrypt · 전 구간 try/except로 감싸 실패 시 항상 200+success=false 반환(401 안 씀) — Go 이식 시 동일 계약 유지 필요. user dict 필드 30여개 디폴트값(mt_lat=37.5642 등) 정확히 복제. mt_id에 '@' 포함 여부로 이메일/전화 분기, 전화는 하이픈 제거 |
| 2 | POST | `/auth/logout` | none | trivial | **DB쓰기(refresh_token.revoked_at set via revoke_by_raw, raw의 SHA-256 해시 매칭)** · raw는 평문 저장 안 함 → 해시 일치로만 revoke. body 없거나 토큰 없어도 항상 success=true |
| 3 | POST | `/auth/refresh` | optional | high | **v2: refresh 회전(기존 row revoke+replaced_by_hash, 새 row insert), reuse 감지 시 chain 전체 revoke, access 발급** · deps=JWT(jose/HS256) · rotation은 crud_refresh_token.rotate에 위임 — chain_id 기준 회전, revoked된 raw 재유입 시 chain 전체 폐기(reuse detection). v1 경로는 만료된 access여도 서명만 검증. mt_idx=payload.mt_idx or sub 폴백. Phase D에서 v1 차단 예정 |
| 4 | POST | `/auth/login-original` | none | low | **DB쓰기(mt_ldate update). FCM 자동 업데이트는 주석 처리됨** · deps=JWT(jose/HS256), bcrypt · access 페이로드=UserIdentity.model_dump()(mt_idx/mt_id/mt_name/mt_level). /login과 토큰 페이로드 구조가 다름(mt_level 포함). 실패 시 200 아니라 401 raise — 계약 차이 주의 |
| 5 | POST | `/auth/register` | none | medium | **DB쓰기(member_t insert via crud_auth.create_user), access 발급** · deps=JWT(jose/HS256), bcrypt · request.json() 수동 파싱 후 RegisterRequest(**body) — FastAPI 자동 검증 우회. create_user에서 비밀번호 정책 검증 + mt_file1 50자 초과 시 랜덤 아바타 대체 + 전화형식이면 mt_hp 세팅. bcrypt cost=settings.PASSWORD_BCRYPT_COST. /login과 달리 refresh 미발급 |
| 6 | GET | `/auth/me` | required | low | read-only · deps=JWT(jose/HS256) · 토큰 payload의 mt_id(전화번호)로 get_user_by_phone 재조회 — mt_idx 아닌 mt_id 사용. 소셜 가입자(mt_id=kakao_xxx)는 조회 실패 가능성. SECRET_KEY(=JWT_SECRET_KEY)로 직접 jwt.decode |
| 7 | POST | `/auth/kakao-login` | none | high | **DB쓰기(이메일계정에 mt_kakao_id 연결+mt_type=2, mt_ldate/mt_adate/기기정보 update), refresh 발급, access 발급** · deps=JWT(jose/HS256) · 카카오 API 직접 호출 없음(클라가 검증한 kakao_id/email 신뢰). 신규 사용자 자동 생성 안 함(회원가입 유도). mt_level==1 탈퇴, mt_status!=1 또는 mt_show!='Y' 비활성 차단. 전 구간 try/except로 실패 시 200+success=false |
| 8 | POST | `/auth/find-user-by-email` | none | high | **DB쓰기(google_id 없던 계정에 mt_google_id 연결+mt_type=4+mt_ldate). 토큰 발급 없음** · raw SQL text() 2개(그룹 집계 JOIN+GROUP BY, 스케줄 7일전후 서브쿼리). 파라미터 바인딩(:mt_idx 등) 사용 — Go에서 동일 SQL/GORM Raw로 이식. 토큰 미발급(조회 전용). 탈퇴(mt_level==1) 시 success=false+is_withdrawn |
| 9 | POST | `/auth/find-user-by-phone` | none | high | **DB쓰기(mt_google_id 연결+mt_type=4+mt_ldate). 토큰 발급 없음** · crud_member.get_by_phone(mt_id/mt_hp 둘 다 매칭)으로 조회. raw SQL text() 2개. find-user-by-email과 user_data 필드 구성이 다름. 토큰 미발급 |
| 10 | POST | `/auth/google-login` | none | medium | **member_service.google_login에 위임(DB쓰기/토큰발급은 서비스 내부)** · deps=JWT(jose/HS256, 서비스 내부) · 라우터 자체는 파싱/검증만. 실제 로직은 member_service.google_login. google_id와 email 모두 없으면 실패. Pydantic 검증 우회. Go 이식 시 member_service 분석 필요 |
| 11 | POST | `/auth/apple-login` | none | low | **member_service.apple_login에 위임(DB쓰기/토큰발급 서비스 내부)** · deps=JWT(jose/HS256, 서비스 내부) · 라우터는 위임만. 실제 로직 member_service.apple_login. 스키마는 schemas.member.AppleLoginRequest/Response |
| 12 | POST | `/auth/forgot-password` | none | medium | **DB쓰기(mt_reset_token=uuid[:8], mt_token_edate=now+1분), 외부호출(sms_service/email_service)** · deps=uuid, SMS API(sms_service), Email(email_service) · 토큰 만료 1분 하드코딩. reset_url=https://nextstep.smap.site/r?t=<token>. 토큰을 평문 그대로 로그 출력(보안 우려). 발송 실패해도 success=true 유지 |
| 13 | POST | `/auth/verify-reset-token` | none | trivial | read-only · len(token)!=8이면 즉시 거부. mt_reset_token 일치 + mt_token_edate>now 조건. data.type은 항상 'phone' 하드코딩 |
| 14 | POST | `/auth/reset-password` | none | medium | **DB쓰기(mt_pwd 해시 업데이트 via update_user_password, mt_reset_token/mt_token_edate=null)** · deps=bcrypt · 비번 검증은 라우터 인라인 정규식. update_user_password는 bcrypt.gensalt() 기본 cost(PASSWORD_BCRYPT_COST 미사용). 사용 후 토큰 즉시 무효화 |
| 15 | POST | `/auth/reset-password-by-phone` | none | medium | **DB쓰기(mt_pwd 업데이트), SMS 인증상태 정리** · deps=bcrypt, SMS 인증 상태저장소(sms.py 인메모리) · _is_verified 우선, 없으면 verification_code를 secrets.compare_digest로 직접 비교(타이밍 공격 방지). 인증코드/완료상태는 sms.py 모듈 인메모리 — Go 이식 시 별도 저장소(Redis 등)로 외부화 필요 |
| 16 | GET | `/users/` | none | trivial | read-only · 인증 없음(보안 우려: 전체 회원 노출). Go 이식 시 인증 게이트 검토 권장 |
| 17 | POST | `/users/` | none | trivial | **DB쓰기(Member(**user.dict()) insert)** · 인증 없음. 비밀번호 해싱/검증 없이 raw dict 그대로 저장 — 보안 우려. 이식 시 사용처 확인 후 노출 여부 결정 권장 |
| 18 | GET | `/users/{user_id}` | none | trivial | read-only · 인증 없음 |
| 19 | PUT | `/users/{user_id}` | none | trivial | **DB쓰기(setattr 후 commit)** · 인증 없음(임의 회원 수정 가능 — 보안 우려). exclude_unset=True 부분 갱신 |
| 20 | DELETE | `/users/{user_id}` | none | trivial | **DB쓰기(db.delete 물리 삭제)** · 인증 없음 + soft delete 아닌 물리 삭제(mt_level=1 탈퇴 정책과 불일치) — 보안/데이터 정합성 우려. 이식 시 정책 재검토 권장 |
| 21 | GET | `/users/email/{email}` | none | trivial | read-only · Member 모델 클래스메서드 find_by_email 사용. except 시 500+str(e)로 내부 에러 노출(보안 우려) |
| 22 | GET | `/users/token/{token}` | none | trivial | read-only · 여기 token은 JWT 아닌 mt_token_id(FCM) 추정. Member.find_by_token 모델 메서드 의존. except 500 노출 |
| 23 | GET | `/users/recent/signin/3h` | none | trivial | read-only · Member 모델 클래스메서드 get_sign_in_3에 쿼리 캡슐화 — Go 이식 시 해당 메서드 SQL 확인 필요 |
| 24 | GET | `/users/recent/signin/24h` | none | trivial | read-only · Member.get_sign_in_24 모델 메서드 의존. SQL 확인 필요 |
| 25 | GET | `/users/not-joined/11days` | none | low | read-only · Member.get_not_join_group_11 모델 메서드(그룹 JOIN 추정). 푸시/리마인드 배치 연계 가능성. SQL 확인 필요 |

## member · /members /member-fcm-token /fcm-token
- **엔드포인트**: 40개 · **설계서 Phase**: 4 · **risk**: high · **견적**: 9일
- **서비스 의존**: member_service.MemberService, firebase_service.firebase_service
- **이식 난점**:
  - FCM 토큰 관리 엔드포인트(member-fcm-token 7개 핵심)의 시간기반 분기 로직이 매우 복잡(2시간/5분/1시간/30일/85일/90일 만료 등) — 상태표로 명세화 후 이식 필요
  - firebase-admin Python → firebase-admin-go 마이그레이션: validate_ios_token, _validate_fcm_token, _handle_token_invalidation, send_silent_push_notification, _send_token_refresh_notification 등 private 메서드 의존 + messaging.UnregisteredError/ThirdPartyAuthError/SenderIdMismatchError 에러 타입 매핑
  - 인증 일관성 부재: members.py의 다수 쓰기 엔드포인트(POST/PUT/DELETE /{member_id}, location, get_members 전체목록)가 인증 없음 → 수평 인가 부재(보안 P1). 토큰 엔드포인트 중 register/status/check-and-update만 _check_horizontal_authorization 호출, validate-and-refresh/background-check/notify-token-refresh는 미호출(불일치). Go 이식 시 일괄 정책 결정 필요
  - 응답 포맷 3종 혼재: (1)members 동의/약관은 Pydantic 모델, (2)비밀번호/프로필/me는 {result,message,success} 비표준 래핑(인증실패도 200), (3)fcm-token은 create_response(SUCCESS/FAILURE) — Go 표준 응답으로 통일 시 프론트 호환 확인 필요
  - 프로필 이미지 파일IO: upload-profile-image(multipart, 5MB, public/images/{mt_idx}.jpg)+delete-profile-image(os.remove) — Go multipart 핸들링 및 디스크 경로 일관성
  - google-login의 raw SQL(text())로 그룹/스케줄 조회(smap_group_detail_t/smap_group_t/smap_schedule_t 조인+서브쿼리) — GORM Raw 또는 명시 조인 이식, JWT(SECRET_KEY vs JWT_SECRET_KEY 혼용)+refresh_token 발급 로직 정합성
  - fcm_token.py가 firebase_service를 import하지 않음(잠재 NameError) — 이식 전 의존성 확정 필요
  - DEBUG 전용 테스트 엔드포인트 5개(test-ios-push/full-token/update-logs/trigger-update 등) 및 no-op 관리 엔드포인트(cleanup-expired-tokens/reset-invalid-tokens)는 이식 범위에서 제외 또는 축소 검토
  - 라우트 등록 순서: /members/me, /members/terms, /members/group/{} 등 정적·특수 경로가 /{member_id} 동적 경로보다 먼저 선언 — Gin에서 등록 순서/충돌 주의

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | POST | `/members/verify-password` | required | low | **read-only (bcrypt 검증만)** · deps.get_current_user_id를 Header(None) 인자로 직접 호출(Depends 아님). 인증 실패도 200+{success:false}로 반환 → Go 이식 시 401로 바꿀지 호환 유지할지 결정 필요. crud_auth.verify_user_password 사용. |
| 2 | POST | `/members/change-password` | required | low | **DB 쓰기(member_t.mt_pwd, mt_udate)** · get_user_by_idx → verify_user_password → change_user_password 순. 인증/검증 실패도 200 반환. ValueError(비번 정책)는 별도 캐치. bcrypt 비용 settings.PASSWORD_BCRYPT_COST. |
| 3 | POST | `/members/register` | none | medium | **DB 쓰기(member_t insert)** · member_service.register_member. 닉네임 중복 미사용. 비번 bcrypt 해싱. 프로필 이미지 없으면 랜덤 아바타(/images/avatar{1-7}.png). mt_birth는 'YYYY-MM-DD' 문자열 파싱. mt_id에 '@' 포함 시 mt_hp=None. 예외를 success=false로 흡수(에러 뭉개기) → Go 이식 시 검증 실패와 서버오류 구분 권장. |
| 4 | POST | `/members/login` | none | medium | **DB 쓰기(mt_ldate,mt_adate 업데이트)** · authenticate(bcrypt) → is_active(mt_status==1 and mt_level>1) → update_login_time. JWT 토큰 발급 안함(주의: 로그인인데 토큰 미반환, 별도 auth 엔드포인트와 분리됨). user_data에 기본값 다수 하드코딩(mt_lat 37.5642 등). |
| 5 | POST | `/members/google-login` | none | high | **DB 쓰기(google_id 연결,mt_type=4,mt_file1,로그인시간,refresh_token 발급)+raw SQL 조회** · 이메일 우선→google_id 매칭. 기존 사용자는 JWT(create_access_token_for_social, settings.SECRET_KEY)+refresh_token(crud_refresh_token.issue) 발급. 신규는 DB 저장 없이 isNewUser=true. _get_user_additional_data가 raw SQL text()로 그룹/스케줄 조회(파라미터 바인딩 사용, GROUP BY/서브쿼리). N+1 아님. is_new_user 변수 미사용 데드. SECRET_KEY와 JWT_SECRET_KEY 혼용 주의. |
| 6 | GET | `/members/check/phone/{phone}` | none | trivial | read-only · get_by_phone는 하이픈 제거 후 mt_id OR mt_hp 조회. |
| 7 | GET | `/members/check/email/{email}` | none | trivial | read-only · path에 이메일(점/@) 포함 → Gin 라우팅 시 URL 인코딩/와일드카드 주의. |
| 8 | GET | `/members/check/nickname/{nickname}` | none | trivial | read-only · service.check_nickname_availability가 db.query 직접 수행. |
| 9 | GET | `/members/` | none | low | read-only · 인증 없이 전체 회원 목록 노출(limit 기본 10000) — 보안 검토 필요. _member_to_dict가 None 안전변환+날짜 isoformat. id 있으면 단건도 리스트로 래핑 반환. |
| 10 | GET | `/members/me` | required | low | read-only · 라우트 순서 중요: /me가 /{member_id}보다 위에 선언됨 → Go(Gin)에서도 정적 경로를 동적 경로보다 먼저 등록해야 충돌 없음. 인증 실패도 200 반환. |
| 11 | GET | `/members/{member_id}` | none | low | read-only · 인증 없음. 위치/날씨 기본값 하드코딩(37.5642 등). 누락 시 404. response_model=MemberResponse지만 dict 반환. |
| 12 | GET | `/members/group/{group_id}` | none | medium | read-only · Member JOIN GroupDetail (sgdt_show='Y',sgdt_exit='N',sgdt_discharge='N' 필터). Go에서는 GORM Joins 또는 명시적 조인 구조체로 매핑. 인증 없음 주의. |
| 13 | POST | `/members/` | none | low | **DB 쓰기(member_t insert)** · 인증 없이 Member(**member_in.dict())로 직접 생성 — 비번 해싱 없음, register와 별개. 보안 검토 필요. 관리/내부용 추정. |
| 14 | PUT | `/members/{member_id}` | none | medium | **DB 쓰기(member_t update)** · 인증 없음+임의 member_id 수정 가능 → 수평 인가 부재(보안 P1). setattr 동적 업데이트. 404 if not found. |
| 15 | DELETE | `/members/{member_id}` | none | low | **DB 쓰기(mt_status=0)** · 인증 없이 누구나 삭제 가능 — 보안 검토 필요. 실제 삭제 아닌 status 변경. |
| 16 | PATCH | `/members/{member_id}/location` | none | low | **DB 쓰기(mt_lat,mt_long 문자열 저장)** · lat/lng를 str(lat)로 변환 저장. 인증 없음. query 파라미터로 좌표 전달. |
| 17 | POST | `/members/update-profile` | required | low | **DB 쓰기(member_t update)** · 닉네임 중복(check_nickname_duplicate, 본인 제외) 검증 후 crud_auth.update_user_profile. 인증 실패도 200 반환. |
| 18 | POST | `/members/update-contact` | required | low | **DB 쓰기(member_t update)** · 전화/이메일 중복(본인 제외) 검증 후 update_user_contact. 인증 실패도 200 반환. |
| 19 | POST | `/members/withdraw` | required | medium | **DB 쓰기(mt_retire_level,mt_level=1,mt_retire_chk/etc,mt_rdate,mt_id_retire,mt_udate)** · 엔드포인트 내부에서 직접 Member 필드 다수 수정(서비스/crud 미경유). 이미 mt_level==1이면 거부. 인증 실패도 200 반환. |
| 20 | GET | `/members/consent/{member_id}` | required | low | read-only · 본인만 조회(current_user_id != member_id → 403). 미인증 401, 없으면 404. crud_member.get_consent_info. 다른 동의 엔드포인트와 달리 HTTPException으로 상태코드 정확히 반환. |
| 21 | POST | `/members/consent` | required | low | **DB 쓰기(member_t.mt_agreeN)** · 미인증 401. crud_member.update_consent가 field whitelist(mt_agree1~5)+값(Y/N) 검증, 위반 시 ValueError. 본인 토큰 user_id 사용. |
| 22 | POST | `/members/consent/all` | required | low | **DB 쓰기(member_t.mt_agree1~5)** · 미인증 401. update_all_consent가 whitelist 필드만 Y/N 적용. |
| 23 | GET | `/members/terms` | none | trivial | **read-only (DB 미접근)** · 서비스/개인정보/위치/제3자/마케팅 5개 약관을 코드에 하드코딩. DB 미사용. Go에서 상수/설정으로 이식. 라우트 순서상 /{member_id}보다 뒤에 있으나 'terms'는 int 변환 실패로 충돌은 없음 — 단 Gin에서는 명시적 라우팅 순서 주의. |
| 24 | POST | `/members/upload-profile-image` | required | medium | **파일IO(public/images/{mt_idx}.jpg 쓰기)+DB 쓰기(mt_file1)** · 파일IO 핵심. content_type이 image/로 시작 검증, 5MB 제한, 파일명=mt_idx.jpg 고정. UPLOAD_DIR=public/images(앱 시작 시 mkdir). async def(await file.read()). 여기서는 get_current_user_id를 Depends로 사용(타입은 Optional이라 미인증 시 None→401 코드내 처리). Go 이식 시 multipart 핸들링+디스크 경로 일관성 필요. |
| 25 | DELETE | `/members/delete-profile-image` | required | low | **파일IO(os.remove)+DB 쓰기(mt_file1=None)** · mt_file1에서 '/images/' 제거 후 UPLOAD_DIR 기준 파일 삭제. 미인증 401. Go 이식 시 os.Remove + 경로 결합. |
| 26 | POST | `/member-fcm-token/register` | required | high | **DB 쓰기(mt_token_id,mt_token_updated_at,mt_token_expiry_date+90d,mt_udate)+Firebase 검증호출** · deps=FCM/Firebase · 수평인가 _check_horizontal_authorization(본인 or mt_level==9, 아니면 403). 회원존재/탈퇴(mt_level==1)/상태(mt_status!=1) 검증. validate_fcm_token_format(정규식,길이20-500,콜론형식). 동일토큰 2시간 이내 중복 시 DB skip. firebase_service.is_available()/validate_ios_token/_validate_fcm_token 호출(실패해도 등록 허용). 토큰 변경 시에만 시간값 갱신. 로깅 매우 방대 — Go 이식 시 핵심 로직만 추리고 로그 간소화 권장. mask_token 유틸 필요. |
| 27 | GET | `/member-fcm-token/status/{mt_idx}` | required | low | read-only · 수평인가 검증(본인/관리자). 만료 7일 전 near_expiry 계산. Member.find_by_idx 사용(모델 메서드). |
| 28 | POST | `/member-fcm-token/check-and-update` | required | high | **DB 쓰기(조건부 토큰 갱신)+Firebase 형식검증** · deps=FCM/Firebase · 수평인가. 토큰 없음→등록, 다름→1시간 이내 기존 보호/이상이면 갱신, 동일→5분 중복방지. needs_update 분기 다수. Go 이식 시 시간기반 분기(3600/300/7200초) 명세화 필요. |
| 29 | POST | `/member-fcm-token/validate-and-refresh` | required | very_high | **DB 쓰기(조건부 갱신)+Firebase messaging 검증/무효화 처리** · deps=FCM/Firebase · 수평인가 없음(여기는 _check_horizontal_authorization 미호출 — 다른 토큰 엔드포인트와 불일치, 검토 필요). 만료/변경/30일 미갱신 등 needs_refresh 다중 분기. firebase messaging.Message dry-run, UnregisteredError/ThirdPartyAuthError 캐치, _handle_token_invalidation 호출. Go 이식 시 firebase-admin-go 메시징 에러 타입 매핑 필요. |
| 30 | POST | `/member-fcm-token/background-check` | required | very_high | **DB 쓰기(조건부 갱신)** · deps=FCM/Firebase · 수평인가 미호출(검토 필요). is_preview_token(길이<100 or '...' 끝 or 형식불일치) 판단 후 DB 실제토큰과 비교 분기. 2시간 중복방지, 85일 미갱신 갱신. 미리보기 토큰이면 DB 토큰 미갱신. 분기 복잡 — Go 이식 시 상태표로 정리 권장. |
| 31 | POST | `/member-fcm-token/cleanup-expired-tokens` | none | medium | **DB 읽기 전체 스캔(+조건부 commit, 실제 토큰 초기화는 주석처리됨)** · 주석상 '관리자용'이지만 인증 Depends 없음(보안 검토 필요). 만료 토큰 전체 조회 후 실제 초기화 로직은 주석처리되어 no-op(cleaned_count 증가만). mt_push1=='Y' 알림은 로그만. Go 이식 시 현 동작(no-op) 유지할지 실제 정리할지 결정 필요. |
| 32 | POST | `/member-fcm-token/reset-invalid-tokens` | required | medium | **DB 읽기 전체 스캔(실제 삭제는 주석처리, no-op)** · mt_token_id NOT NULL 전체 조회 후 validate_fcm_token_format 검사. 잘못된 토큰 자동삭제 주석처리됨(cleaned_count 항상 0). 관리자 권한 체크 없이 일반 required만 — 관리 작업인데 admin 아님(검토). Go 이식 시 전체 스캔 성능 고려. |
| 33 | POST | `/member-fcm-token/notify-token-refresh` | required | low | **외부호출(firebase_service._send_token_refresh_notification) — 실제로는 로그 기록** · deps=FCM/Firebase · 수평인가 없음. mt_idx를 query로 받음(타 회원 지정 가능, 검토). firebase_service._send_token_refresh_notification 호출(내부 private 메서드 의존). 실제 알림은 미구현(로그만). |
| 34 | POST | `/member-fcm-token/test-ios-push` | required | high | **외부호출(firebase_service.send_push_notification 또는 messaging.send 실제 전송)** · deps=FCM/Firebase · settings.DEBUG False면 404. test_type(simple/direct/complex)별 전송 방식 분기. iOS 토큰(':' 포함) 검증. 실제 푸시 전송. Go 이식 우선순위 낮음(테스트용). DEBUG 가드 유지 필수. |
| 35 | GET | `/member-fcm-token/full-token/{mt_idx}` | required | low | read-only · settings.DEBUG False면 404. 전체 토큰 평문 노출(보안 민감) — DEBUG 가드 필수 유지. 수평인가 없음. |
| 36 | GET | `/member-fcm-token/update-logs/{mt_idx}` | required | high | **외부호출(subprocess: docker ps/logs 실행)+파일/프로세스 IO** · deps=Docker CLI · settings.DEBUG False면 404. subprocess.run(shell=False, 리스트 인자)로 docker ps/logs 호출 후 Python 정규식 필터. Go 이식 시 docker SDK 또는 exec.Command 필요 — 이식 가치 낮음(운영 디버그용), 제외 후보. DB 미접근. |
| 37 | POST | `/member-fcm-token/trigger-update/{mt_idx}` | required | medium | **DB 쓰기(임시 토큰 변경 후 복원)+register 함수 내부 호출** · deps=FCM/Firebase · settings.DEBUG False면 404. 기존 토큰에 '_TEST_TRIGGER' 붙여 register_member_fcm_token 직접 호출 후 복원. Go 이식 가치 낮음(테스트용), 제외 후보. |
| 38 | POST | `/fcm-token/update` | required | high | **DB 쓰기(mt_token_id)+외부호출(Silent Push 최대 3회+추가1회)** · deps=FCM/Firebase · get_current_member(JWT→Member, 401 if invalid)로 인증. firebase_service 참조하나 이 파일에 import 없음 — 런타임 NameError 가능성(잠재 버그, Go 이식 시 의존성 명시 필요). 토큰 변경+기존토큰 존재 시 Silent Push 재시도 루프(time.sleep(1) 블로킹). create_response 표준 래퍼 사용. 예외를 FAILURE 응답으로 흡수(에러 뭉개기). |
| 39 | GET | `/fcm-token/status` | required | trivial | read-only · token_preview는 앞 20자+'...'. create_response 래퍼. member-fcm-token/status/{mt_idx}와 기능 중복(현재 회원 기준). |
| 40 | POST | `/fcm-token/notify-token-change` | required | medium | **외부호출(firebase_service.send_silent_push_notification)** · deps=FCM/Firebase · 토큰 없으면 FAILURE. firebase_service 미import(잠재 NameError). Silent Push 전송 후 응답 래핑. 예외 FAILURE 흡수. |

## group · /groups /group-details /group-members
- **엔드포인트**: 31개 · **설계서 Phase**: 4 · **risk**: high · **견적**: 7일
- **서비스 의존**: chat_service (app.services.chat_service)
- **이식 난점**:
  - group_members/member/{group_id}의 원시 SQL 3종(self-join + MAX 서브쿼리 + fallback)을 GORM으로 이식하면서 SQL 인젝션(placeholders f-string 직접 결합) 제거 및 파라미터 바인딩 적용 필수
  - groups/{group_id}/stats의 멤버별 루프 N+1 쿼리(멤버수×4)를 group_by 일괄집계로 재설계 필요
  - 거의 모든 쓰기 엔드포인트가 무인증/무권한(리더·소유자 체크 없이 가입/탈퇴/역할변경 가능) — Go 이식 시 권한 정책을 새로 정의할지 현행 유지할지 사전 합의 필요
  - GroupDetailBase 스키마 필드(sgdt_*_chk 다수)와 ORM/실DB 컬럼(sgdt_discharge/sgdt_exit) 불일치 — 실제 smap_group_detail_t 스키마 대조 후 매핑 확정
  - join/join-by-code/join-new-member 3개 엔드포인트의 재가입 조건·채팅연동 차이를 정확히 구분 재현(body mt_idx 토큰 강제 여부, chat_service 호출 유무)
  - chat_service(create_group_chat_room/add_member_to_group_chat) 의존 — 채팅 도메인 이식 순서/인터페이스 조율 필요, 현재는 실패해도 삼키는 비트랜잭션 동작
  - sgt_code 생성 로직(G+MD5(random)[:5] 유니크 루프, PHP get_sgt_code 호환) 동일 재현
  - List[dict] 수동 직렬화 응답들의 키 이름·null 폴백값·datetime ISO/빈문자열 규칙을 프론트 호환 위해 1:1 재현
  - 정적/동적 라우트 등록 순서(/hidden·/current-user·/code 등 vs /{group_id}) Gin에서 충돌 방지
  - emergency-restore(mt_idx=1186 하드코딩) 등 운영 임시 엔드포인트의 이식 포함 여부 결정

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/groups/hidden` | none | trivial | read-only · 단순 필터 쿼리. 라우트 순서 주의: Gin에서 /hidden, /current-user, /code/* 등 정적 경로를 /{group_id} 동적 경로보다 먼저 등록해야 충돌 없음 |
| 2 | GET | `/groups/current-user/summary` | required | medium | read-only · subquery(IN) + JOIN + COUNT(DISTINCT) 사용. GORM에서 subquery/Distinct 표현 필요. get_required_user_id로 401 보장 |
| 3 | GET | `/groups/current-user` | required | high | read-only · Group+GroupDetail JOIN 후 멤버수는 group_by IN 절로 일괄 집계(N+1 방지 의도). null 기본값(sgt_title 등 \|\| 폴백), datetime ISO 변환, Python 측 정렬. Go 이식 시 응답 키/폴백값 동일 유지 필요 |
| 4 | POST | `/groups/join` | required | high | **DB write(GroupDetail insert/update), chat_service.add_member_to_group_chat 호출(채팅방 멤버 추가)** · deps=chat_service · sgt_code.upper()로 조회. 기존 멤버십(sgdt_exit='N') 있으면 show='Y'시 400, 아니면 재가입. 신규 insert 후 채팅 추가는 try/except로 실패해도 가입 성공 유지. body의 mt_idx를 토큰 user_id로 강제하지 않음(보안 주의: 임의 mt_idx 가입 가능). 트랜잭션 1개 commit |
| 5 | GET | `/groups/{group_id}` | none | trivial | read-only · sgt_show 필터 없이 PK 조회 |
| 6 | GET | `/groups/` | none | low | read-only · limit 기본 10000로 사실상 전체 반환. offset/limit 페이징. show_hidden 분기로 sgt_show='Y' 필터 조건부 |
| 7 | GET | `/groups/member/{member_id}` | none | low | read-only · Group.find_by_member: Group JOIN GroupDetail(sgdt_exit='N', sgt_show='Y'). 권한체크 없음(임의 member_id 조회 가능) |
| 8 | GET | `/groups/code/{code}` | none | trivial | read-only · find_by_code: sgt_code 일치 + sgt_show='Y'. 여기선 .upper() 미적용(join 엔드포인트와 차이) |
| 9 | POST | `/groups/` | required | high | **DB write(Group insert, GroupDetail insert), chat_service.create_group_chat_room 호출** · deps=chat_service · body mt_idx를 토큰 user_id로 강제 덮어씀(보안). sgt_code는 generate_sgt_code()로 'G'+MD5(random)[:5] 유니크 생성(while 중복체크 루프, MD5는 PHP get_sgt_code 호환). commit 2회 분리(그룹 후 멤버), 멤버/채팅 실패는 except로 삼킴(에러뭉개기-Go이식 시 트랜잭션 일관성 검토 필요) |
| 10 | PUT | `/groups/{group_id}` | none | medium | **DB write(Group update 또는 soft_delete)** · sgt_show==N이면 group.soft_delete() 호출(실DB삭제 아님). 그 외 필드별 None 체크 후 부분 업데이트. 인증 없음(누구나 수정/삭제 가능-권한 미흡). try/except로 500 래핑. 동적 부분업데이트 로직 Go 이식 주의 |
| 11 | PUT | `/groups/{group_id}/restore` | none | trivial | **DB write(Group update sgt_show='Y', sgt_udate)** · 인증 없음. soft_delete 역동작 |
| 12 | POST | `/groups/emergency-restore` | none | low | **DB write(Group insert, GroupDetail insert)** · mt_idx=1186 하드코딩된 운영 임시/디버그 엔드포인트. 인증 없음. Go 이식 대상에서 제외 검토 권장(데드/위험 코드-언급만) |
| 13 | GET | `/groups/{group_id}/stats` | none | very_high | read-only · 멤버 ID별 루프 안에서 멤버조회+일정COUNT+전체위치COUNT+주간위치COUNT 각각 쿼리(명백한 N+1, 멤버수×4 쿼리). Go 이식 시 group_by 일괄집계로 최적화 권장. 7일 기간 계산, is_owner/is_leader는 메모리상 any() 판정 |
| 14 | POST | `/groups/{group_id}/join` | required | high | **DB write(GroupDetail insert/update), chat_service.add_member_to_group_chat 호출** · deps=chat_service · /join(코드기반)과 거의 동일 로직이나 group_id path 기반. sgt_show!='Y'면 404. 기존 멤버십 show='Y'면 400. body mt_idx 토큰 강제 안함(보안). 채팅추가 실패 삼킴 |
| 15 | POST | `/groups/{group_id}/join-new-member` | none | medium | **DB write(GroupDetail insert/update)** · 회원가입 직후 호출용 의도로 무인증. /join과 달리 재가입 조건이 (show='Y' AND exit='N'), 재가입 시 sgdt_discharge='N'도 초기화. 채팅 추가 호출 없음(차이점). 무인증 mt_idx 임의 가입 가능 |
| 16 | GET | `/groups/{group_id}/public` | none | low | read-only · sgt_show!='Y'면 404. 멤버수 COUNT(show='Y', exit='N'). 응답에 sgt_content 참조(Group 모델에 컬럼 없음-속성 미정의 주의, ORM lazy/AttributeError 가능성 Go 이식 시 확인 필요) |
| 17 | PUT | `/groups/{group_id}/members/{member_id}/remove` | none | medium | **DB write(GroupDetail update show='N', exit='Y', udate)** · 인증 없음(임의 탈퇴 가능-권한 미흡). body 값 무시하고 'N'/'Y' 하드코딩. 그룹/멤버십(show='Y') 존재 확인 후 처리. 로그에 외부 URL 하드코딩(정리 대상-언급만) |
| 18 | GET | `/group-details/` | none | trivial | read-only · 필터 없이 전체 offset/limit. 무인증 전체 노출 주의 |
| 19 | GET | `/group-details/{group_detail_id}` | none | trivial | read-only · PK 조회. 라우트 충돌 주의: /member/*, /group/* 정적 경로를 /{group_detail_id}보다 먼저 등록 |
| 20 | GET | `/group-details/member/{member_id}` | none | medium | read-only · 필터: mt_idx + show='Y' + exit='N' + discharge='N'. 응답 dict 키/폴백 규칙(null→'N'/'Y', date→ISO 또는 '') 동일 재현 필요. 무인증 |
| 21 | GET | `/group-details/group/{group_id}` | none | low | read-only · 필터: sgt_idx + show='Y' + exit='N' + discharge='N' |
| 22 | POST | `/group-details/` | none | low | **DB write(GroupDetail insert)** · **스키마 컬럼 불일치 주의**: GroupDetailBase는 sgdt_discharge_chk/sgdt_exit_chk/sgdt_in_chk/sgdt_schedule_chk/sgdt_read_chk/sgdt_enter_alarm/sgdt_enter_chk 등을 정의하나 ORM 모델은 sgdt_discharge/sgdt_exit만 존재. dict() 그대로 GroupDetail(**)에 넣으면 매핑 안되는 필드 발생 가능. Go 이식 전 실제 DB 스키마 대조 필수. 무인증 |
| 23 | PUT | `/group-details/{group_detail_id}` | none | low | **DB write(GroupDetail update)** · exclude_unset=True로 전달된 필드만 setattr. 스키마/모델 컬럼명 불일치 위험 동일. 무인증 |
| 24 | PUT | `/group-details/{group_detail_id}/role` | none | low | **DB write(GroupDetail update sgdt_leader_chk, udate)** · 'Y'면 LeaderCheckEnum.Y 아니면 N. 무인증(누구나 리더 임명 가능-권한 미흡, 보안 검토 필요) |
| 25 | PUT | `/group-details/{group_detail_id}/remove` | none | low | **DB write(GroupDetail update)** · body 무시, Enum.N/Y 하드코딩. 무인증 |
| 26 | DELETE | `/group-details/{group_detail_id}` | none | trivial | **DB write(GroupDetail update exit='Y', show='N')** · DELETE 메서드지만 실제는 소프트 삭제. udate 미갱신(다른 remove와 차이). 무인증 |
| 27 | GET | `/group-members/member/{group_id}` | none | very_high | read-only · **원시 SQL(text) 다수**: ①멤버기본(JOIN member_t, owner/leader 정렬), ②최신위치(member_location_log_t self-join + MAX(mlt_gps_time) 서브쿼리), ③위치없는 멤버 fallback(member_t.mt_lat/long). **SQL 인젝션 주의**: member_ids를 placeholders로 문자열 직접 결합(f-string, 파라미터 바인딩 아님)—Go 이식 시 반드시 파라미터 바인딩/안전한 IN 절로 변경. float/int 캐스팅, 정렬 CASE문 재현 필요 |
| 28 | POST | `/group-members/add` | none | low | **DB write(GroupDetail insert 또는 show='Y' 복원)** · group_id/member_id가 query 파라미터로 전달됨(POST지만 body 미사용). 이미 show='Y' 존재 시 success:false 반환(200 유지). 신규 생성 시 sgdt_show만 세팅(다른 chk 필드 미설정). 무인증 |
| 29 | DELETE | `/group-members/remove` | none | trivial | **DB write(GroupDetail update show='N')** · query 파라미터. show='N'만 변경(exit 미변경-다른 remove와 차이). 무인증 |
| 30 | DELETE | `/group-members/{group_id}/member/{member_id}` | none | trivial | **DB write(GroupDetail update show='N', exit='Y')** · /remove와 달리 exit='Y'도 설정. 무인증(권한체크 없음-멤버 강제 추방 가능) |
| 31 | PUT | `/group-members/{group_id}/role` | none | medium | **DB write(GroupDetail update sgdt_leader_chk)** · **느슨한 계약**: body가 raw dict로 member_id/mt_idx, is_leader/sgdt_leader_chk 다중 키 폴백 + bool/str 타입 분기 처리. Go 이식 시 명시적 구조체+검증으로 변환 권장(400 if no member_id). 무인증(누구나 리더 변경-보안 검토) |

## location · /locations /logs
- **엔드포인트**: 25개 · **설계서 Phase**: 4 · **risk**: high · **견적**: 9일
- **이식 난점**:
  - /logs/member-location-logs POST의 15개 act 멀티플렉서를 Go에서 개별 핸들러로 분해 — 가장 큰 작업량. JWT 검증을 핸들러 내부 직접 디코딩에서 공통 미들웨어로 전환 결정 필요
  - stay-times의 다중 CTE+윈도우함수(LAG/ROW_NUMBER/SUM OVER)+Haversine+상관서브쿼리 raw SQL을 GORM Raw로 무손실 이식하고 MariaDB 방언/타임존/ONLY_FULL_GROUP_BY 호환 검증
  - map-markers의 비표준 GROUP BY CASE + HAVING COUNT%10 로직과 Python 측 200건 균일 샘플링 동작 보존 — 의미 재검토 필요
  - 쓰기 빈도 매우 높은 create_location_log: 배치(mlt_gps_data)와 단건, member_t 위치 동기 UPDATE를 단일 트랜잭션/배치 INSERT로 최적화(현재 항목마다 commit). 필드명 호환매핑(mlt_timestamp→mlt_gps_time, mlt_accuracy→오타컬럼 mlt_accuacy) 유지
  - 전 엔드포인트 인증 부재 + 광범위한 IDOR(임의 mt_idx/slt_idx 조회·수정·삭제)와 mt_idx=282, sgdt_idx=641 하드코딩 폴백 — Go 이식 시 인증/소유권 정책 확정이 선행되어야 함(스코프 변경은 합의 필요)
  - locations.py의 raw SQL INSERT/동적 UPDATE를 GORM으로 이식하면서 hard delete vs soft delete(slt_ddate), 좌표 검증 실패 기본값 흡수, PUT의 404→500 변환 버그, /path 중복(shadowed) 라우트 등 기존 결함을 보존할지 수정할지 결정
  - 응답 포맷 불일치(일부 {result,data} 래핑 / 일부 raw 배열·객체) 및 LAST_INSERT_ID 의존을 Go LastInsertId로 이식하면서 클라이언트 호환 유지

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/locations/` | none | low | read-only · 인증 전혀 없음(공개). slt_ddate(삭제) 필터 없이 전체 반환 — Go 이식 시 소유권/노출 정책 재검토 필요. Row 매핑 방식이 다른 엔드포인트와 미묘하게 다름 |
| 2 | GET | `/locations/{location_id}` | none | trivial | read-only · 소유권 검증 없음 — 누구나 임의 slt_idx 조회 가능(IDOR). Go 이식 시 권한 추가 검토 |
| 3 | GET | `/locations/member/{member_id}` | none | trivial | read-only · slt_ddate 필터 없이 slt_show=Y만 필터. IDOR 가능 |
| 4 | GET | `/locations/group-detail/{group_detail_id}` | none | trivial | read-only · IDOR 가능. slt_ddate 미필터 |
| 5 | GET | `/locations/myplays/in` | none | medium | read-only · raw SQL + member_t JOIN. 전체 회원 대상(WHERE에 회원 한정 없음) — 배치/알림용 내부 쿼리지만 공개 엔드포인트. dict(row) 매핑(SQLAlchemy 1.x 스타일)이라 2.x에선 row._mapping 필요할 수 있음. Go에선 GORM Raw로 이식, mt_lang 컬럼 매핑 주의 |
| 6 | GET | `/locations/myplays/out` | none | medium | read-only · raw SQL, DATE(slt_udate)=CURDATE() 사용 — DB 서버 타임존 의존. Go 이식 시 CURDATE()/타임존 처리 명시 필요. dict(row) 매핑 1.x 스타일 |
| 7 | POST | `/locations/` | none | medium | **DB 쓰기 (smap_location_t INSERT)** · 인증 없는 쓰기 + mt_idx 하드코딩 기본값 282(보안/데이터 무결성 위험). Pydantic 스키마 미사용, dict 직접 파싱 후 text() INSERT. 좌표 검증 실패를 기본값으로 흡수(에러 뭉개기). slt_title 100자/slt_add 200자 절단. Go 이식 시 구조화된 요청 스키마+인증+소유자 검증 도입 권장 |
| 8 | PUT | `/locations/{location_id}/notification` | none | low | **DB 쓰기 (smap_location_t UPDATE slt_enter_alarm, slt_udate)** · raw UPDATE. 소유권 검증 없음(IDOR로 타인 알림 변경 가능). 라우트 순서상 /{location_id}/notification가 /{location_id} 앞에 있어야 매칭됨(파일 내 순서 OK). Go 이식 시 라우트 우선순위 주의 |
| 9 | PUT | `/locations/{location_id}` | none | medium | **DB 쓰기 (smap_location_t 동적 UPDATE + slt_udate)** · 동적 SET 절을 f-string으로 조립(컬럼명은 코드 화이트리스트라 인젝션 없음, 값은 파라미터 바인딩). 소유권 검증 없음(IDOR). title 50자/add 100자 절단(POST와 절단 길이 불일치). 예외 처리에 HTTPException 재발생 누락 — 404가 500으로 변환되는 버그(except Exception이 HTTPException도 잡음). Go 이식 시 동적 쿼리 빌더+소유자 검증 필요 |
| 10 | DELETE | `/locations/{location_id}` | none | low | **DB 쓰기 (smap_location_t 물리 DELETE)** · 물리 삭제(hard delete) — 모델의 Location.delete()는 논리삭제(slt_ddate)지만 이 엔드포인트는 ORM db.delete()로 실제 행 삭제. 소유권 검증 없음(IDOR로 임의 삭제 가능 — 고위험). Go 이식 시 정책 결정 필요(soft vs hard) |
| 11 | GET | `/locations/other-members/{member_id}` | none | trivial | read-only · /member/{id}와 완전 동일 구현 — 중복 엔드포인트. Go 이식 시 통합 검토 가능(언급만) |
| 12 | POST | `/locations/members/{member_id}/locations` | none | medium | **DB 쓰기 (smap_location_t INSERT) + 멤버존재 SELECT + 그룹 SELECT + 생성행 재조회 SELECT** · 다중 raw SQL(멤버검증→그룹조회→INSERT→LAST_INSERT_ID→재조회). 인증 없는 쓰기. sgdt_idx/sgt_idx 폴백 641 하드코딩(데이터 무결성 위험). 그룹 자동선택은 sgdt_show=Y 첫 행. Go 이식 시 단일 트랜잭션+RETURNING/LastInsertId, 하드코딩 폴백 제거 권장 |
| 13 | POST | `/logs/member-location-logs` | optional | very_high | **act에 따라 read-only 또는 DB 쓰기(생성/수정/삭제). create_location_log는 member_location_log_t INSERT + member_t 위치 UPDATE(mt_lat/mt_long/mt_udate)** · deps=JWT(PyJWT) · 단일 POST에 15개 act 멀티플렉싱 — Go 이식 시 개별 핸들러로 분해 권장. JWT 검증을 핸들러 내부에서 jwt.decode(SECRET_KEY, ALGORITHM)로 직접 수행(공통 미들웨어 아님). create는 토큰 mt_idx 우선, 없으면 body mt_idx 폴백(인증 약함). location_consent='N'이면 403. 배치(mlt_gps_data) 시 항목별 try/except로 부분성공+errors 수집. 필드명 호환매핑 다수(mlt_timestamp→mlt_gps_time, mlt_accuracy→mlt_accuacy[오타 컬럼]). 쓰기 빈도 매우 높음(GPS 배치). create_location_log CRUD는 매 호출 commit — 배치 시 N commit(성능). act 분기: get_location_logs/summary/path, create/update/delete_location_log, get_members_with_logs, get_daily_location_logs/summary/path, get_daily_summary[_by_range], get_stay_times(복잡 CTE), get_map_markers(샘플링), get_location_log_summary |
| 14 | GET | `/logs/member-location-logs/{mt_idx}` | none | low | read-only · ORM 쿼리, end_date는 +1일 미만 처리. IDOR(임의 mt_idx 조회). to_dict 직렬화 |
| 15 | GET | `/logs/member-location-logs/{mt_idx}/summary` | none | high | read-only · date 분기 시 get_location_log_summary→get_schedule_count(개인+그룹 일정 raw SQL, GROUP_CONCAT을 IN절에 문자열삽입)+get_gps_distance_and_time(윈도우함수 CTE+Haversine raw SQL). GROUP_CONCAT→.format() IN절 삽입은 값이 DB내부 sgdt_idx라 인젝션 위험 낮으나 Go 이식 시 파라미터화 권장. 기간 분기는 메모리에서 Haversine 누적 계산(최대 10000건 로드) |
| 16 | GET | `/logs/member-location-logs/{mt_idx}/path` | none | medium | read-only · 최대 10000건 로드 후 메모리에서 points 생성+요약 계산. 중요: 같은 경로 GET /member-location-logs/{mt_idx}/path가 파일 내 2번 등록됨(이 함수 line 563, 그리고 get_daily_location_path line 602 date필수). FastAPI는 먼저 등록된 이 함수(기간버전)가 우선 — line 602 daily 버전은 사실상 도달 불가(shadowed/dead route). Go 이식 시 한쪽만 채택, daily는 별도 경로 부여 필요 |
| 17 | GET | `/logs/member-location-logs/{mt_idx}/daily` | none | low | read-only · 응답이 {result,data} 래핑 없이 raw 배열 — 다른 GET들과 응답 포맷 불일치. 00:00:00~23:59:59 범위 ORM 조회 |
| 18 | GET | `/logs/member-location-logs/{mt_idx}/path` | none | low | read-only · 데드 라우트 — line 563의 동일경로 GET이 먼저 등록되어 이 핸들러(line 602)는 실행되지 않음. 기능은 act=get_daily_location_path(디스패처)로 접근 가능. Go 이식 시 경로 분리 또는 제거 결정 필요 |
| 19 | GET | `/logs/members-with-logs` | none | low | read-only · group_id 파라미터를 받지만 CRUD(get_members_with_logs_by_date)는 date만 사용 — group_id 무시(전체 회원 대상). Go 이식 시 group 필터 누락 버그 여부 확인 필요 |
| 20 | GET | `/logs/member-location-logs/{mt_idx}/daily-summary` | none | medium | read-only · SQLAlchemy 집계(min/max + cast Date group_by). 정확도/속도/좌표>0 필터. Go 이식 시 GORM group by DATE() 또는 Raw |
| 21 | GET | `/logs/member-location-logs/{mt_idx}/stay-times` | none | very_high | read-only · 대규모 raw SQL: 다중 CTE + LAG/SUM/ROW_NUMBER 윈도우함수 + Haversine(ACOS/RADIANS) + GREATEST/LEAST 클램프 + TIMESTAMPDIFF + 상관 서브쿼리. MariaDB/MySQL 8 윈도우함수 의존. Go 이식 시 가장 까다로운 쿼리 — GORM Raw로 그대로 이식하되 DB 방언/타임존 호환 검증 필수. stay 라벨+min_duration 필터 |
| 22 | GET | `/logs/member-location-logs/{mt_idx}/map-markers` | none | high | read-only · raw SQL에 SELECT * + GROUP BY CASE + HAVING COUNT(*)%10=1 (비표준/의심스러운 GROUP BY 로직, MySQL ONLY_FULL_GROUP_BY 비활성 전제). 추가로 Python에서 200건 균일 샘플링. 200건 초과 경고 로그(주석엔 600건 언급으로 불일치). Go 이식 시 GROUP BY 의미 재검토+ONLY_FULL_GROUP_BY 호환 필요 |
| 23 | GET | `/logs/daily-counts` | none | high | read-only · 그룹멤버 ORM JOIN 조회 후 raw SQL로 DATE별 COUNT(DISTINCT) 집계(IN :member_ids 튜플 바인딩). Python에서 날짜 매트릭스 재구성. getattr 폴백으로 mt_nickname/mt_file1/mt_gender 접근. Go 이식 시 IN절 슬라이스 바인딩+날짜 채우기 로직 필요 |
| 24 | GET | `/logs/daily-counts-simple` | none | medium | read-only · daily-counts의 경량 버전. raw SQL에 HAVING COUNT>0 추가. 멤버 ORM JOIN + IN절 튜플 바인딩 |
| 25 | GET | `/logs/member-activity` | none | medium | read-only · 멤버 ORM JOIN + 2개 raw SQL(COUNT, MIN/MAX 시각)을 IN절로 일괄조회(N+1 방지 최적화됨). 날짜 파싱 실패 시 400. Go 이식 시 IN절 바인딩+2쿼리 병합 가능 |

## schedule · /schedules /schedule
- **엔드포인트**: 18개 · **설계서 Phase**: 4 · **risk**: very_high · **견적**: 9일
- **서비스 의존**: firebase_service (FirebaseService.send_push_notification), GroupScheduleManager (in-file class), create_recurring_schedules / create_new_schedule / update_single_schedule (in-file helpers)
- **이식 난점**:
  - 반복일정 생성 로직(create_recurring_schedules): r1 주기/r2 요일 분기, 매주 다중요일 특수처리, Python weekday↔1~7 매핑, 3년치/최대500건 raw INSERT를 Go time/요일 로직으로 정확 재현
  - 수정 시 editOption(this/future/all) + 반복패턴 변경 감지에 따른 일괄 soft-delete 후 재생성 vs 일괄 업데이트 분기, update_single_schedule의 '날짜 유지·시간만 교체' 로직
  - body가 Pydantic 아닌 raw Dict[str,Any]로 들어와 검증 없음 — Go에서 명시적 struct/검증 정의 필요(필드 기본값: location_alarm='4', update_chk='3', slt_idx_t=location_add 등 PHP 호환 매핑 보존)
  - 전반적으로 current_user_id를 query param으로 받아 인증 미들웨어 부재 — Go에서 JWT 기반 get_required_user_id로 승격 시 계약 변경 주의(프론트 호환)
  - owner-groups/all-schedules의 Haversine 거리계산을 SQL f-string 인라인으로 주입 + group_ids f-string IN절 — Go에서 파라미터 바인딩으로 안전 재작성
  - send_schedule_notification 내 target_member 미정의 NameError 잠재버그: 실제 FCM 전송 경로가 항상 예외→무음 실패. Go 이식 시 target_member 조회 추가하여 정상 동작화 필요
  - 트랜잭션 경계 혼재(헬퍼 내부 commit과 라우트 commit) — Go에서 단일 트랜잭션으로 정리
  - schedules.py DELETE(물리삭제) vs group_schedule_manage DELETE(soft-delete) 동작 불일치 정리
  - FCM/push_log_t 부수효과를 schedule 도메인에서 직접 호출 — 알림 서비스 경계 분리 검토
  - response_model 선언(ScheduleResponse)과 실제 반환(dict/래핑 {success,data}) 불일치 다수 — Go DTO 설계 시 실제 응답 형태 기준

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/api/v1/schedules/` | none | trivial | read-only · sst_show 필터 없이 모든 행 조회(soft-delete 무시). Go: GORM Offset/Limit. ScheduleResponse 직렬화 필드 매핑 필요 |
| 2 | GET | `/api/v1/schedules/{schedule_id}` | none | trivial | read-only · Schedule.find_by_idx = sst_idx 단순 first(). 라우트가 /now, /before-30min 등 정적 경로보다 먼저 선언되지 않아야 충돌 없음(FastAPI는 정의 순서대로 매칭, 정적 경로가 뒤에 있어 주의) |
| 3 | GET | `/api/v1/schedules/member/{member_id}` | none | trivial | read-only · Schedule.find_by_member: mt_idx==member_id AND sst_show='Y' ORDER BY sst_sdate |
| 4 | GET | `/api/v1/schedules/group/{group_id}` | none | medium | read-only · GroupDetail subquery로 멤버 ID 모은 뒤 OR(sgt_idx=group OR mt_idx IN(...)). sst_show 필터 없음. 개별 변환 시 try/except continue로 에러 일정 스킵. Go: subquery+IN, datetime isoformat 처리, Decimal→float 변환 주의 |
| 5 | GET | `/api/v1/schedules/now/in-members` | none | medium | read-only · 모델 raw SQL: NOW() BETWEEN LEAST(DATE_SUB(sdate,30min), IFNULL(adate,sdate)) AND edate, sst_location_alarm IN(1,4), sst_in_chk='N', sst_entry_cnt=0. response_model=ScheduleResponse지만 dict 리스트 반환되어 추가 컬럼 무시됨. Go: raw SQL 그대로 이식 권장 |
| 6 | GET | `/api/v1/schedules/now/out-members` | none | medium | read-only · raw SQL: NOW() BETWEEN sdate AND edate, location_alarm IN(2,4), sst_in_chk='Y', sst_exit_cnt=0. Go: raw SQL 이식 |
| 7 | GET | `/api/v1/schedules/now/push` | none | low | read-only · sst_schedule_alarm BETWEEN now(초절삭) ~ +59초, alarm_chk=Y, schedule_chk=N, show=Y. ORM 쿼리. Go: 분 단위 윈도우 계산 주의 |
| 8 | GET | `/api/v1/schedules/before-30min` | none | trivial | read-only · sst_sdate == (now+30분, 초=00 포맷) 문자열 동등비교. 분 단위 정확 매칭이라 스케줄러 주기와 결합. Go: 시간 포맷 동일 보장 필요 |
| 9 | POST | `/api/v1/schedules/` | none | low | **DB 쓰기(smap_schedule_t insert + commit)** · Schedule(**dict()) 단순 생성. 권한/그룹 검증 없음. 반복일정/알림계산/푸시 없음(group_schedule_manage 쪽과 별개). Go: GORM Create |
| 10 | PUT | `/api/v1/schedules/{schedule_id}` | none | low | **DB 쓰기(update + commit)** · dict(exclude_unset=True) 동적 patch. Go: 부분 업데이트(map 또는 Select) 처리 필요, 권한 검증 없음 |
| 11 | DELETE | `/api/v1/schedules/{schedule_id}` | none | trivial | **DB 쓰기(물리 DELETE + commit)** · group_schedule_manage의 soft-delete(sst_show='N')와 달리 물리 삭제 — 동작 불일치 존재. Go 이식 시 의도 확인 필요 |
| 12 | GET | `/api/v1/schedule/test-all-columns` | none | trivial | read-only · 테스트/디버그용. 기본값 1186 하드코딩. Go 이식 대상 제외 권장(또는 내부용으로만) |
| 13 | GET | `/api/v1/schedule/owner-groups/all-schedules` | none | high | read-only · 거리계산을 SQL 안에 acos/cos/radians로 인라인(동적 f-string으로 user_lat/lng 주입 — SQL 인젝션 위험은 낮으나 파라미터 바인딩 아님). group_ids도 f-string join으로 IN절 구성. LIMIT 100. userPermission은 항상 isOwner=true로 하드코딩(실제 owner 검증 안함). Go: 동적 SQL 빌더+바인딩으로 재작성, Haversine 함수화 권장 |
| 14 | GET | `/api/v1/schedule/group/{group_id}/schedules` | required | high | read-only · 권한: check_group_permission(raw SQL JOIN 3테이블) 실패 시 403. where_conditions 동적 배열로 SQL 구성(값은 바인딩 사용 — 안전). LIMIT 1000. 행마다 sst_pidx 로깅(N+1 아님). days→날짜범위 변환. Go: 동적 WHERE 빌더, 권한 헬퍼 분리 |
| 15 | POST | `/api/v1/schedule/group/{group_id}/schedules` | required | very_high | **DB 쓰기(raw INSERT + 반복일정 최대 500건 INSERT), 푸시 알림(FCM), push_log_t 쓰기** · deps=FCM(firebase_service) · 핵심 비즈니스 로직. body가 Pydantic 아닌 raw Dict[str,Any](스키마 검증 없음 — Go에서 struct로 명시 필요). targetMemberId 지정 시 owner/leader 권한 없으면 403. 날짜 T→공백/시간보정. 알림시간=시작-pick(minute/hour/day). 반복: create_recurring_schedules가 r1(주기)/r2(요일)별 분기, 매주 다중요일 특수처리, 3년치/최대500건 raw INSERT. sst_location_alarm 기본 '4', slt_idx_t=location_add 버그성 매핑. 푸시: send_schedule_notification에 target_member 미정의 NameError 잠재버그(FCM 실제전송 경로에서 예외→False, 외부 try/except로 무시됨). Go 이식 난이도 최상 |
| 16 | PUT | `/api/v1/schedule/group/{group_id}/schedules/{schedule_id}` | required | very_high | **DB 쓰기(다건 UPDATE, soft-delete sst_show='N', 신규 INSERT 가능), 푸시 알림, push_log_t** · deps=FCM(firebase_service) · 권한: 본인 일정이거나 owner/leader. parent_id=sst_pidx>0?pidx:schedule_id. editOption='all'+패턴변경 시 (sst_pidx=parent OR sst_idx=parent) 전체 soft-delete→create_new_schedule→create_recurring_schedules 재생성. 'all'/'future' 내용변경 시 대상 조회 후 각 행 update_single_schedule(시간만 교체, 날짜 유지하는 복잡 로직). 'this'는 단일 수정. update_single_schedule은 None 아닌 필드만 동적 UPDATE. 트랜잭션: 함수내 commit과 라우트 commit 혼재 — Go에서 단일 트랜잭션 경계로 재설계 권장. 다건 루프 update N건 발생 |
| 17 | DELETE | `/api/v1/schedule/group/{group_id}/schedules/{schedule_id}` | required | high | **DB 쓰기(soft-delete UPDATE sst_show='N', sst_ddate=NOW()), 푸시 알림, push_log_t** · deps=FCM(firebase_service) · 물리삭제 아닌 sst_show='N' soft-delete(schedules.py DELETE와 동작 다름). 권한: 본인 또는 owner/leader. 반복+option='all': (pidx=parent OR idx=parent) 전체; 'future': sst_sdate>=현재 시작일; 'this': 단일. rowcount로 deleted_count. 푸시 send_schedule_notification 호출(잠재 NameError 버그 동일). Go: rowcount 반환, soft-delete 통일 |
| 18 | GET | `/api/v1/schedule/debug/schedule/{schedule_id}` | none | low | read-only · 디버그용. related_query에 :parent_id 바인딩이 NULL 비교(:parent_id IS NOT NULL) 포함. current_user_id 사용 안함(미사용 파라미터). Go 이식 대상 제외 권장 |

## push · /push-logs /push-fcms /fcm_sendone
- **엔드포인트**: 28개 · **설계서 Phase**: 4 (워커는 3) · **risk**: high · **견적**: 6일
- **서비스 의존**: firebase_service, push_service, ai_message_service, email_service, services/notifications/catalog, services/notifications/composer, services/notifications/dispatcher, services/notifications/events
- **이식 난점**:
  - FCM(Firebase Admin SDK) Go 포팅: firebase.google.com/go/v4/messaging 사용. 단건 send + 배치 send_each(500/청크) 모두 필요. APNs(iOS)/Android 페이로드, content_available, apns-push-type(alert/background), 90일 만료 등 firebase_service.py의 상세 메시지 빌더를 정밀 이식해야 함
  - fcm_sendone의 전체발송(mt_idx==0)·silent-batch가 사용자별 순차 send(N+1) — Go에서 messaging.SendEach 배치로 전환 시 성능 개선되나 토큰별 에러 핸들링(UnregisteredError/ThirdPartyAuthError→토큰 무효화) 매핑을 BatchResponse 단위로 재구현해야 함
  - 응답 계약 비표준: FCMSendResponse.success가 boolean이 아닌 문자열 'true'/'false', 에러도 HTTP 200 + success='false'로 반환. 모든 예외를 catch해 200 반환하는 패턴 — Gin 핸들러에서 동일 계약 유지 필요(클라이언트 호환성)
  - 라우트 순서 함정: /push-fcms/{push_fcm_id}(int)가 /now·/code/{code}보다 먼저 선언되어 정적 경로가 가려짐. Gin은 매칭 규칙이 달라 동작이 바뀔 수 있음 — 기존(버그성) 동작 재현 여부를 의도적으로 결정
  - plt_status 상태코드(2~7) 및 plt_type 'admin'→'1' 변환, plt_memo='API3_FCM_service'/plt_condition='system_auto' 중복로그 차단 등 비즈니스 규칙을 정확히 이식
  - PUT 엔드포인트의 partial-update(exclude_unset) 시맨틱을 GORM에서 zero-value 함정 없이 구현(Select/맵 기반 Updates)
  - 전 엔드포인트 인증 없음(공개)·mt_idx로 타인 데이터 접근 가능. silent-batch/test-send 등 운영성 엔드포인트가 공개 — 이식 시 인증/권한 정책 재설계 필요(현행 동작 유지 vs 보안 강화 합의 필요)
  - 폴백(이메일/SMS) 체인: firebase_service가 전송 실패 시 EmailService(네이버웍스/Gmail) 비동기 폴백 호출 — push 도메인 단독 이식 시 email/sms 도메인 의존성 순서 고려

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/push-logs/` | none | trivial | read-only · 단순 offset/limit. mt_idx 필터 없는 전역 조회 — Go 이식 시 GORM Offset().Limit().Order("plt_idx desc"). 인증 없음 주의(전체 사용자 로그 노출). 응답 enum 필드는 Y/N 문자열. |
| 2 | GET | `/push-logs/{push_log_id}` | none | trivial | read-only · 라우트 순서 주의: /push-logs/{push_log_id} 가 /push-logs/member/.. 등 정적 경로보다 먼저 매칭되지 않도록 Gin 등록 순서 관리(FastAPI는 선언 순서대로). plt_idx PK 단건. |
| 3 | GET | `/push-logs/member/{member_id}` | none | low | read-only · datetime.now()-7일 필터. plt_status==2(전송성공)만. Go에서 time.Now().AddDate(0,0,-7) 사용. 인증 없이 member_id로 타인 로그 조회 가능 — 이식 시 권한 검토 필요. |
| 4 | GET | `/push-logs/recent/{member_id}` | none | trivial | read-only · 내부에서 get_member_push_logs(member_id, db) 직접 호출 → 완전 중복. Go에서는 동일 핸들러 함수 공유 또는 동일 쿼리 재사용. 라우트 /recent/{id} 가 /{push_log_id}보다 먼저 등록되어야 함. |
| 5 | GET | `/push-logs/schedule/{schedule_id}` | none | trivial | read-only · PushLog.find_by_schedule: sst_idx==schedule_id AND plt_show=Y. 라우트 순서 주의. |
| 6 | GET | `/push-logs/member/{member_id}/unread` | none | trivial | read-only · PushLog.find_unread. /member/{member_id}/unread 가 /member/{member_id} 와 prefix 충돌 — Gin에서 더 구체적 경로를 명시 등록. enum N 비교. |
| 7 | POST | `/push-logs/` | none | low | **조건부 DB 쓰기(push_log_t INSERT). 특정 조건이면 read-only로 동작** · 중복 로그 차단 분기(API3_FCM_service/system_auto) Go에서 그대로 이식 필수 — 누락 시 스케줄러 중복 로그 발생. 더미 응답 시 plt_idx=0 반환 계약 유지. |
| 8 | PUT | `/push-logs/{push_log_id}` | none | low | **DB 쓰기(push_log_t UPDATE)** · exclude_unset=True 의 partial-update 시맨틱 — Go에서 GORM Updates(map) 또는 명시 필드 매핑으로 '전달된 필드만' 갱신 구현 필요(Select 사용). zero-value 함정 주의. |
| 9 | DELETE | `/push-logs/{push_log_id}` | none | trivial | **DB 쓰기(push_log_t DELETE 물리삭제)** · 실제 row 삭제(soft delete 아님). delete-all과 동작이 다름 주의. |
| 10 | PATCH | `/push-logs/{push_log_id}/read` | none | trivial | **DB 쓰기(push_log_t UPDATE)** · try/except로 rollback 후 500. PATCH 메서드 — Gin에서 router.PATCH 등록. /{id}/read 라우트 순서. |
| 11 | POST | `/push-logs/delete-all` | none | low | **DB 쓰기(push_log_t 대량 UPDATE)** · mt_idx는 query 파라미터(body 아님). bulk update WHERE mt_idx AND plt_show=Y. Go에서 db.Model().Where().Updates(). DELETE 메서드 아닌 POST 임에 주의. /delete-all 정적 라우트 우선 등록. |
| 12 | POST | `/push-logs/read-all` | none | low | **DB 쓰기(push_log_t 대량 UPDATE)** · mt_idx는 query 파라미터. bulk update WHERE mt_idx AND plt_read_chk=N AND plt_show=Y. |
| 13 | GET | `/push-fcms/` | none | trivial | read-only · 정렬 없음(order_by 미지정). Go에서 동일하게 무순서 또는 PK 정렬 결정 필요. |
| 14 | GET | `/push-fcms/{push_fcm_id}` | none | trivial | read-only · 치명적 라우트 순서 버그: 이 /{push_fcm_id} 가 파일 내 /now, /code/{code} 보다 먼저 선언됨. FastAPI에서 GET /push-fcms/now 는 {push_fcm_id}로 잡혀 int 변환 실패(422). Go(Gin) 이식 시 정적 경로(/now)를 동적 경로보다 먼저 등록하면 오히려 동작이 달라지므로, 기존 동작(now가 422) 재현 여부를 의도적으로 결정해야 함. |
| 15 | GET | `/push-fcms/member/{member_id}` | none | trivial | read-only · PushFCM.find_by_member: pft_send_mt_idx==member_id AND pft_show=Y. |
| 16 | GET | `/push-fcms/code/{code}` | none | trivial | read-only · /code/{code} 가 /{push_fcm_id}(int)보다 뒤에 선언됨. code는 문자열이라 int 캐스팅 실패로 도달 불가 가능성 — FastAPI는 /{push_fcm_id}를 int로 시도→실패시 다음 라우트로? 실제론 선언 순서상 {push_fcm_id}가 우선이라 422 위험. Go 이식 시 정적 prefix /code/ 우선 등록 권장. |
| 17 | GET | `/push-fcms/now` | none | low | read-only · PushFCM.find_push_list: pft_rdate == now.strftime('%Y-%m-%d %H:00:00') 문자열 비교. 시각을 시 단위로 절삭해 정확 일치. Go에서 시 절삭 포맷 동일 구현 필요. 라우트 순서상 /{push_fcm_id}에 가려질 위험(위 항목 참고). |
| 18 | GET | `/push-fcms/pending/{mt_idx}` | none | medium | read-only · find_pending_messages_for_member: pft_send_mt_idx, pft_show=Y, pft_status=1, (since_timestamp 있으면 pft_rdate>=since), pft_rdate>=now(미래 예약만), order pft_rdate asc. 동적 쿼리 빌드(조건부 filter). Go에서 *gorm.DB 체이닝으로 조건부 Where. unix ts→datetime 변환 주의. |
| 19 | POST | `/push-fcms/mark-delivered/{push_fcm_id}` | none | low | **DB 쓰기 가능(hasattr(delivered_at)일 때만 — 현재 모델엔 delivered_at 컬럼 없음 → 사실상 commit만)** · PushFCM 모델에 delivered_at 컬럼 미존재 → hasattr False → 실제 변경 없이 commit. 데드 로직에 가까움. Go 이식 시 'delivered 상태 컬럼이 없다'는 사실 확인 후 no-op 또는 신규 컬럼 도입 결정 필요. |
| 20 | POST | `/push-fcms/` | none | trivial | **DB 쓰기(push_fcm_t INSERT)** · 단순 모델 매핑 INSERT. |
| 21 | PUT | `/push-fcms/{push_fcm_id}` | none | low | **DB 쓰기(push_fcm_t UPDATE)** · partial-update 시맨틱 — push-logs PUT와 동일 패턴. Go에서 전달 필드만 갱신 구현. |
| 22 | DELETE | `/push-fcms/{push_fcm_id}` | none | trivial | **DB 쓰기(push_fcm_t DELETE 물리삭제)** · 물리 삭제. |
| 23 | POST | `/fcm_sendone/` | none | high | **외부호출(Firebase FCM messaging.send) + DB 쓰기(push_log_t INSERT) + 실패 시 토큰 무효화(DB), 폴백(이메일/SMS) 가능** · deps=FCM(Firebase Admin), SMTP/네이버웍스(폴백 이메일) · mt_idx==0 분기: Member.get_token_list() 후 한 명씩 순차 send(N건 개별 호출, 배치 아님 → N+1/성능 이슈). plt_type=='admin'이면 로그 저장 시 '1'로 변환(Integer 컬럼 대응). 응답 성공 플래그가 boolean이 아닌 문자열 'true'/'false'. firebase_service.send_push_notification 내부에서 UnregisteredError/ThirdPartyAuthError별 _handle_token_invalidation 호출. Go 이식 시: 전체 발송은 send_each 배치(500/청크)로 전환 권장, 문자열 success 계약 유지, 에러를 200+success=false로 반환하는 비표준 계약 유지 여부 결정. |
| 24 | POST | `/fcm_sendone/background` | none | high | **외부호출(Firebase send_background_push_notification) + DB 쓰기(push_log_t INSERT, 분기마다 status 다름)** · deps=FCM(Firebase Admin) · 엔드포인트 로컬 BaseModel(BackgroundPushRequest)로 스키마 정의 — schemas/ 외부 아님. status 코드 매핑(2~7) 비즈니스 규칙 정확 이식 필수. apns content_available, 90일 만료 등 페이로드 세부는 firebase_service에 위임. priority 인자는 무시되고 항상 'high'로 호출됨(주의). |
| 25 | POST | `/fcm_sendone/silent-batch` | none | high | **외부호출(Firebase send_silent_push_notification N회) — DB 쓰기 없음(이력 미저장)** · deps=FCM(Firebase Admin) · Member.get_token_list() 후 사용자별 순차 send(배치 미사용 → N+1). 운영상 관리/스케줄러 트리거 성격인데 인증 없음(공개) — Go 이식 시 admin 권한 부여 검토 강력 권장. send_each 배치 전환 권장. |
| 26 | POST | `/fcm_sendone/silent` | none | medium | **외부호출(Firebase send_silent_push_notification) — DB 이력 미저장** · deps=FCM(Firebase Admin) · 로컬 BaseModel(SilentPushRequest). priority 인자 전달되지만 내부에서 'high'로 강제. UnregisteredError/InvalidArgumentError별 토큰 무효화 분기. |
| 27 | POST | `/fcm_sendone/test` | none | trivial | read-only · 순수 에코. DB/외부호출 없음. |
| 28 | POST | `/fcm_sendone/test-send/{mt_idx}` | none | low | **외부호출(Firebase send_push_notification) — DB 이력 미저장** · deps=FCM(Firebase Admin) · Member.find_by_idx 후 토큰/Firebase 가용성 체크 → 단건 send. 운영에 노출된 테스트 엔드포인트(공개) — Go 이식 시 보호/제거 검토. |

## misc-write · /orders /sms /log-management /hwgi
- **엔드포인트**: 22개 · **설계서 Phase**: 4 · **risk**: high · **견적**: 7일
- **서비스 의존**: sms_service (app.services.sms_service.SMSService 싱글톤), log_manager (app.core.log_manager.LogManager 전역 인스턴스)
- **이식 난점**:
  - hwgi 도메인 전체가 raw SQL text() 기반이고 ORM 모델(hwgi_inspection_t/item_t/photo_t)이 없어 Go struct 및 쿼리 신규 정의 필요. all-data는 WHERE 없는 전건 SELECT 후 메모리 조립, bulk-save/upload-photo는 SELECT 후 UPDATE/INSERT 수동 upsert(N+1) + 명시 트랜잭션
  - upload-photo 파일 IO 정밀 이식: base64(data URI prefix) 디코딩, 디렉토리 자동 생성, ts+uuid 파일명, ip_sort_order MAX+1 경합, DB실패시 고아 파일 보상 로직 부재. item_id/bt_idx 경로 직접 사용 → 경로 traversal 새니타이즈 추가 필요
  - log-management: 파이썬 daemon thread를 HTTP 요청으로 기동하는 start-auto-cleanup 안티패턴 — Go에서는 ticker/cron 스케줄러로 재설계. 파일 로테이션/gzip 압축 파일명 규칙(stem_YYYYMMDD_HHMMSS.log/.gz) 호환 유지
  - sms 인증 플로우: Redis(setex/incr/expire) + 인메모리 fallback 이중 경로, CSPRNG(secrets.randbelow), constant-time 비교(compare_digest), 레이트리밋. Aligo form-data API + Fixie 프록시(http.Transport.Proxy) 정확 이식
  - 인증 패턴 불일치: orders는 핸들러 내부 수동 토큰 추출(deps.get_current_user_id 직접 호출 + 401/403 분기), sms/send·log-management는 표준 Depends. PUT /orders/status는 소유자/관리자 검증 누락(P1 잠재 취약). hwgi 5개 전부 인증 없음(공개) — 점검데이터 노출/임의수정/OpenAI 비용 — 이식 시 권한 정책 검토 필요
  - generate-report: config.py에 OPENAI_API_KEY/OPENAI_MODEL 필드 미정의(extra=ignore)로 settings 접근 시 AttributeError 가능성, 요청마다 httpx 클라이언트 생성 — Go에서 env 직접 로드 + 공용 http.Client로 정정
  - orders/summary의 count 8회 분리 쿼리는 단일 집계(GROUP BY + SUM CASE)로 최적화, 동적 라우팅 충돌(/detail·/code·/recent·/summary vs /{member_id})은 Gin 정적 라우트 우선 등록 순서로 해결

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/orders/summary/{member_id}` | required | medium | read-only · Go 이식: crud_order.get_order_summary는 동일 base_query에 count()를 6회+ sum() 2회 호출 → 8개 별도 쿼리(N+1 유사). Go에서는 단일 집계 쿼리(GROUP BY ot_status + SUM CASE WHEN)로 합치는 것이 바람직. ot_show='Y' 필터, ot_status 매직넘버(1/2/99), 이번달 경계는 datetime(year,month,1). 인증이 표준 Depends가 아니라 핸들러 내부 수동 추출 패턴이므로 미들웨어 일관성 주의 |
| 2 | GET | `/orders/{member_id}` | required | medium | read-only · Go 이식: 동적 WHERE(status/pay_type/start_date/end_date 조건부) + ot_show='Y' 고정 + count() 후 offset/limit. GORM에서 조건부 체이닝으로 구현. start_date/end_date는 핸들러에서 미사용(OrderFilter 기본 None)이나 CRUD는 지원. ot_wdate desc 정렬. OrderResponse가 OrderBase 전체 필드(40+컬럼) 노출 — 응답 스키마 충실 매핑 필요 |
| 3 | GET | `/orders/detail/{order_id}` | required | low | read-only · Go 이식: 단순. crud_order.get은 ot_idx로 first(). 권한 체크 순서(404 먼저 → 403) 유지. 경로 /detail/{id}가 /{member_id}와 충돌 가능성 있으나 FastAPI는 정적 prefix(/detail) 우선 — Gin 라우팅에서 /:member_id 와 /detail 순서 주의(/detail 라우트를 먼저 등록) |
| 4 | GET | `/orders/code/{order_code}` | required | low | read-only · Go 이식: ot_code WHERE first(). /code/{order_code} 정적 prefix 라우팅 순서 주의(/{member_id}보다 먼저 등록) |
| 5 | PUT | `/orders/status/{order_id}` | required | low | **DB 쓰기(order_t UPDATE: ot_status, ot_udate=now. update_date 인자 미전달이라 ot_pdate/ot_ccdate는 갱신 안됨)** · Go 이식 보안 주의: 인증만 통과하면 임의 order_id의 상태를 누구나 변경 가능(소유자/관리자 검증 없음) — 이식 시 권한 누락 그대로 옮기지 말고 검토 필요(P1 잠재 취약). status는 query string 파라미터. response_model 미지정이라 응답에 order_t 전체 필드 노출 |
| 6 | POST | `/orders/cancel/{order_id}` | required | medium | **DB 쓰기(order_t UPDATE: ot_status=99, ct_cancel_reson, ct_cancel_amount, ot_refund_info, ot_ccdate=now, ot_udate=now)** · Go 이식: 파라미터가 query인 점 주의(POST지만 body 미사용). 중복취소(99) 사전 체크 400. 환불 외부 PG(포트원) 연동은 없음 — 단순 DB 상태 변경만. cancel_amount/refund_info None이면 해당 컬럼 미갱신(조건부 set). 실제 환불 트랜잭션/PG 호출 없음에 유의 |
| 7 | GET | `/orders/recent/{member_id}` | required | trivial | read-only · Go 이식: ot_show='Y' + ot_wdate desc + limit. 단순 |
| 8 | POST | `/sms/send-verification-code` | none | high | **외부호출(Aligo SMS API, Fixie 프록시 경유) + Redis 쓰기(sms:code:{phone} setex 180s, sms:rate:{phone} incr/expire). Redis 불가 시 모듈 전역 dict 인메모리 fallback** · deps=Aligo SMS (apis.aligo.in), Fixie 프록시(FIXIE_URL, 선택), Redis · Go 이식 핵심: (1) secrets.randbelow → crypto/rand. (2) Redis setex/incr/expire 정확 이식, 키 포맷 sms:code:{phone}/sms:rate:{phone}/sms:verified:{phone}. (3) 인메모리 fallback dict는 Go에서 sync.Mutex+map+만료 검사로 구현(단일 인스턴스 한정 — 멀티 인스턴스시 Redis 필수). (4) phone 정규화: replace('-','').replace(' ',''). (5) try/except로 모든 예외를 success=False로 흡수(에러 뭉개기 패턴 — 이식 시 로깅 유지). (6) Aligo는 form-data POST, result_code=='1' 성공. Fixie 프록시는 aiohttp proxy 인자 → Go http.Transport.Proxy |
| 9 | POST | `/sms/verify-code` | none | medium | **Redis 쓰기/삭제(검증 성공시 sms:code 삭제 + sms:verified:{phone} setex 300s). 인메모리 fallback 동일** · deps=Redis · Go 이식: secrets.compare_digest → crypto/subtle.ConstantTimeCompare(타이밍 공격 방지 — 단순 == 금지). 코드 미요청시 '먼저 요청' 에러. 검증 성공 후 코드 즉시 삭제 + verified 마킹(reset-password 등 후속 플로우 연계, 단 이 도메인에는 reset-password 엔드포인트 없음 — auth 도메인 소관) |
| 10 | POST | `/sms/send` | required | medium | **외부호출(Aligo SMS, Fixie 프록시). Redis 미사용(레이트리밋 없음)** · deps=Aligo SMS, Fixie 프록시(선택) · Go 이식: 표준 Depends 인증(get_required_user_id) 사용 — orders와 달리 정상 미들웨어 패턴. 예외시 500 raise(send-verification과 달리 fail-fast). 레이트리밋 없음 주의(인증 사용자는 무제한 발송 가능). sms_service.send_sms 재사용 |
| 11 | POST | `/log-management/rotate` | admin | medium | **파일IO(app.log/push_msg.log 백업 이동 shutil.move, 초과 백업 unlink, 빈 파일 touch)** · Go 이식: LogManager.rotate_logs 이식. 100MB 초과시만 로테이션, glob으로 기존 백업 정렬 후 max_files(10) 초과분 unlink. timestamp 응답이 실제론 get_log_stats() dict의 str() — 의도와 다른 듯하나 그대로 유지. admin 권한 검증은 DB Member 조회(mt_level/mt_status) 필요. Go에선 lumberjack 등 로테이션 라이브러리 검토 가능하나 파일명 규칙(stem_YYYYMMDD_HHMMSS.log) 호환 필요 |
| 12 | POST | `/log-management/compress` | admin | medium | **파일IO(days_old 초과 백업 .log를 .log.gz로 gzip 압축 후 원본 unlink)** · Go 이식: compress/gzip 표준 라이브러리. mtime < cutoff 백업 파일 대상, 이미 .gz면 skip. with_suffix('.log.gz') 파일명 규칙 유지 |
| 13 | POST | `/log-management/cleanup` | admin | low | **파일IO(days_old 초과 *.log.gz unlink 삭제)** · Go 이식: glob 패턴 {base}_*.log.gz, mtime 비교 후 os.Remove. 삭제 작업이므로 권한/경로 검증 신중(임의 경로 삭제 방지 — log_dir 내부로 한정됨) |
| 14 | POST | `/log-management/full-cleanup` | admin | medium | **파일IO(rotate_logs + compress_old_logs(7) + cleanup_old_compressed_logs(30) 순차)** · Go 이식: 위 3개 작업 합성. 하드코딩 days(7/30) 유지 |
| 15 | GET | `/log-management/stats` | admin | low | **read-only(파일 stat만)** · Go 이식: os.Stat로 크기/mtime. 응답이 동적 키 map[string]any 구조 — Go struct 대신 map 사용 또는 명시 struct 설계. last_modified는 datetime 객체(JSON 직렬화시 ISO). 백업 glob {base}_*.log* 집계 |
| 16 | POST | `/log-management/start-auto-cleanup` | admin | high | **백그라운드 스레드 생성(daemon threading.Thread, 무한루프 while True + time.sleep(interval*3600))** · Go 이식 주의: Python daemon thread를 HTTP 요청으로 시작하는 안티패턴 — 매 호출마다 새 goroutine/타이머 생성되어 중복 실행 위험(idempotency/중복방지 없음). Go에선 요청 트리거 스레드 대신 앱 수명주기의 cron/ticker(별도 스케줄러)로 이전 권장. thread_info(name/daemon/alive)는 Go에 직접 대응 개념 없음 — 응답 구조 재설계 필요. 무한루프+sleep 패턴은 context 취소 가능한 ticker로 |
| 17 | GET | `/log-management/health` | admin | low | **read-only(파일 stat)** · Go 이식: get_log_stats 결과를 순회하며 size_mb>50 또는 미존재시 issues 추가. 예외시 500 raise가 아니라 success=False dict 반환(다른 엔드포인트와 에러 처리 불일치 — 200으로 에러 응답). stats의 backups 키는 제외하고 검사 |
| 18 | GET | `/hwgi/all-data` | none | high | **read-only(raw SELECT 3건)** · Go 이식 핵심: (1) raw SQL text()로 3테이블 전체 SELECT(WHERE 없음 — 전건 로드, 데이터 증가시 성능 위험) 후 Python 메모리에서 지점별 dict 조립. GORM raw 또는 명시 SQL. (2) ORM 모델 없음 — Go struct 신규 정의 필요. (3) 응답이 인덱스 기반 튜플 접근(insp[1] 등) — 컬럼 순서 의존. (4) _absolutize_photo_url: 상대 URL에 settings.PUBLIC_API_BASE_URL prefix(http로 시작하거나 base 비면 원본). (5) 인증 없음 — 점검 데이터 전체 공개 노출(검토 필요). (6) 조립 로직(setdefault 중첩)을 Go map[string]map[string]... 으로 충실 이식 |
| 19 | POST | `/hwgi/bulk-save` | none | high | **DB 쓰기(raw SQL: hwgi_inspection_t SELECT후 UPDATE/INSERT 분기, items 루프마다 SELECT후 UPDATE/INSERT). 단일 트랜잭션 db.commit, 실패시 db.rollback** · Go 이식 핵심: (1) 명시적 트랜잭션(commit/rollback) — GORM tx.Begin/Commit/Rollback. (2) upsert를 SELECT 후 UPDATE/INSERT 분기로 수동 구현 — N+1(items 개수만큼 SELECT+쓰기). Go에선 INSERT ... ON DUPLICATE KEY UPDATE로 단순화 검토(단 유니크키 확인 필요). (3) result.lastrowid 사용 — GORM은 RowsAffected/LastInsertId. (4) date.today() it_date 기록. (5) raw SQL 파라미터 바인딩(:name) — Go는 ? 또는 named. (6) 인증 없음(임의 bt_idx 데이터 작성 가능 — 검토) |
| 20 | POST | `/hwgi/upload-photo` | none | very_high | **파일IO(base64 디코딩→storage/uploads/hwgi/{bt_idx}/{item_id}/{ts}_{uuid8}.jpg 디렉토리 생성+write_bytes) + DB 쓰기(inspection/item 없으면 INSERT, photo INSERT, ip_sort_order=MAX+1). commit/rollback** · Go 이식 핵심: (1) base64 디코딩 — data URI prefix('data:...,') 있으면 split. Go base64.StdEncoding. (2) 파일명 ts(ms)+uuid4 hex 8자, 디렉토리 자동 생성(os.MkdirAll). UPLOAD_BASE=backend/storage/uploads/hwgi (경로는 __file__ 기준 5단계 parent — Go에선 절대경로 설정으로). (3) 검증 부재: 파일 크기/MIME/확장자/이미지 유효성 미검증, item_id가 경로에 직접 사용(경로 traversal 위험 — bt_idx/item_id 새니타이즈 필요). (4) 트랜잭션 + 파일쓰기 혼합 — 파일 쓰기 성공 후 DB 실패시 고아 파일 잔존(보상 로직 없음). (5) 인증 없음. (6) ip_sort_order=COALESCE(MAX,-1)+1 동시성 경합 가능. (7) .jpg 하드코딩(실제 PNG여도) |
| 21 | DELETE | `/hwgi/delete-photo/{photo_id}` | none | medium | **파일IO(ip_file_path의 파일 unlink, 존재시만) + DB 쓰기(hwgi_inspection_photo_t DELETE). commit/rollback** · Go 이식: (1) DB에서 ip_file_path 조회 후 BACKEND_DIR/storage/{path.lstrip('/')} 경로 파일 삭제. lstrip('/')로 선행 슬래시 제거 후 join — Go에선 filepath.Join 경로 traversal 검증 필요(DB 경로를 신뢰). (2) HTTPException 404는 except에서 re-raise(삼키지 않음). (3) 인증 없음 — 임의 photo_id 삭제 가능(검토). (4) 파일 없어도 DB는 삭제 진행 |
| 22 | POST | `/hwgi/generate-report` | none | high | **외부호출(OpenAI api.openai.com/v1/chat/completions, httpx 60s timeout, temperature 0.7, max_tokens 4000)** · deps=OpenAI API · Go 이식 핵심: (1) settings.OPENAI_API_KEY/OPENAI_MODEL 참조하나 config.py에 해당 필드 정의 없음(extra='ignore') — 현재 settings 속성 접근시 AttributeError 가능성(잠재 버그). Go 이식 시 환경변수 OPENAI_API_KEY/OPENAI_MODEL 직접 로드. (2) httpx AsyncClient를 요청마다 생성(리소스 수명주기 위반 — Go에선 공용 http.Client 재사용). (3) 시스템 프롬프트에 한화손해보험 표기 규칙 하드코딩 — 그대로 이식. (4) HTTPStatusError→502, 그 외→500. (5) data['choices'][0]['message']['content'] 파싱 — 응답 구조 검증 없이 인덱스 접근(빈 choices시 예외). (6) 인증 없음 — OpenAI 비용 유발 가능한 공개 엔드포인트(레이트리밋/인증 검토 권장). ai_message_service.py는 별도 OpenAI 경로(os.getenv) — 본 엔드포인트는 service 미사용, 핸들러 내 직접 호출 |

## chat · /chats /ws
- **엔드포인트**: 3개 · **설계서 Phase**: 5 · **risk**: very_high · **견적**: 6일
- **서비스 의존**: ChatService (app/services/chat_service.py: get_rooms_for_member, get_messages, send_message, create_dm_room, create_group_chat_room, add_member_to_group_chat, remove_member_from_group_chat), push_service.send_push (FCM, lazy import in chat_ws._send_push_to_offline)
- **이식 난점**:
  - Socket.IO 실시간 계층이 최고 위험: python-socketio 5.11.0(Engine.IO v4 / Socket.IO protocol v5) 사용. Go에는 동등한 공식 라이브러리 부재 → googollee/go-socket.io는 protocol v4(EIO v3)까지만 안정 지원하여 클라이언트(웹/앱)와 프로토콜 비호환 발생 가능. 옵션: (a)native WebSocket+자체 프로토콜로 클라이언트까지 재작성, (b)Python WS 게이트웨이 별도 유지, (c)검증된 go socket.io 호환 라이브러리 확보. 호환성 사전 PoC 필수
  - Socket.IO 이벤트 6개 정밀 이식: connect(auth.token Bearer JWT 검증, 실패시 False 거부), disconnect, join_room(멤버십 검증→enter_room(room_{scr_idx})→최신 메시지로 last_read 갱신), leave_room, send_message(DB 저장+room broadcast 'new_message'+오프라인 멤버 FCM), read_update('read_receipt' broadcast). 네임스페이스는 기본 '/', 룸명 규칙 room_{scr_idx}, 클라이언트→서버 이벤트명/페이로드 키 1:1 유지 필요
  - 인메모리 상태(connected_users{sid:mt_idx}, active_rooms{sid:scr_idx})가 단일 프로세스 전제 → 다중 인스턴스/수평 확장 시 룸 broadcast·온라인 판정 붕괴. Go 이식 시 Redis pub/sub 어댑터+presence 스토어로 외부화 필요(현 Python엔 어댑터 없음)
  - send_message가 async 핸들러 내부에서 동기 chat_service.send_message(블로킹 DB)+동기 _send_push_to_offline(멤버별 Member 조회 N+1 후 FCM 동기 호출) 실행 → Go에서 goroutine/비동기 워커로 분리, 푸시는 큐잉 권장
  - HTTP/WS 양쪽 모두 표준 deps.get_current_user_id가 아닌 로컬 인라인 JWT 디코드(payload.mt_idx) 사용 — Go에서 통일된 미들웨어로 mt_idx 추출 표준화 필요. 토큰 만료/서명 검증 except Exception 광범위 캐치(원인 구분 없이 401/None) 개선 여지
  - DM 생성 등 다단계 INSERT가 명시적 트랜잭션 미적용(flush+commit 분리) → Go GORM tx로 원자성 보장. find_dm의 group_by+having(count==2) 집계 서브쿼리, get_messages 커서 역순 등 비자명 쿼리 충실 재현
  - 도메인 전반 read 경로 N+1 심각(rooms/messages) → 이식 시 단순 포팅 금지, JOIN·배치로딩으로 재설계 동반 필요. last_message 한글 50자 슬라이싱은 []rune 처리

| # | Method | Path | Auth | Cx | Side-effects / 외부의존 / 이식 노트 |
|---|--------|------|------|----|----------------------------------|
| 1 | GET | `/api/v1/chats/rooms` | required | high | read-only · deps=JWT(jose) · 심각한 N+1: 방마다 find_membership, unread count(query.count), get_latest, get_room_members(중복 2회 호출), DM이면 추가로 멤버 목록+target Member 조회. 방 N개 × 멤버/메시지 쿼리 다수 → Go 이식 시 JOIN/집계 쿼리 1~2개로 재설계 필요. last_message[:50]은 파이썬 슬라이스(멀티바이트 한글 50자 기준) → Go에서 []rune 슬라이싱 주의. scr_show/scm_show/scmsg_show = 'Y' 필터 일관 적용 필수 |
| 2 | POST | `/api/v1/chats/rooms/dm` | required | medium | **DB 쓰기: 신규시 smap_chat_room_t 1 INSERT + smap_chat_member_t 2 INSERT(본인+상대), db.commit()** · deps=JWT(jose) · find_dm: ChatMember subquery group_by(scr_idx) having count==2 + scr_type='dm' — Go GORM에서 동일 having 집계 서브쿼리 재현 필요(이 로직은 정확히 2명 멤버십 매칭). 생성이 트랜잭션 미보호(flush 후 commit, room/member 부분 실패 시 정합성 위험) → Go에서 명시적 tx로 묶어야 함. create_dm_room 실패(None) 시 라우터가 500 반환 |
| 3 | GET | `/api/v1/chats/rooms/{scr_idx}/messages` | required | high | read-only · deps=JWT(jose) · N+1: 메시지마다 sender Member 조회 + count_unread(방 멤버 total/read 2회 count 쿼리) → 메시지 50개면 100+ 쿼리. Go에서 sender batch-load + unread는 last_read_idx 집계로 일괄 계산 권장. 커서 페이징 before_idx<scmsg_idx, order desc limit 후 reverse — Go에서 동일 reverse 처리. membership None → 403(권한). 입력 검증: scr_idx 양수/limit 음수 방어 없음 |
