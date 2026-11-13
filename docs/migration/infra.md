# 인프라 동등성 가이드 (인증·응답·캐시·설정)
> Python/Go 토큰 상호호환 및 응답 계약 보존을 위한 핵심.

## JWT
- **알고리즘**: HS256
- **claim**: mt_idx (정수, 주 식별자), mt_id (문자열), mt_name (문자열), exp (만료, datetime.utcnow()+TTL → UTC NumericDate), sub (구 토큰 하위호환용 fallback. 신규 발급 시에는 넣지 않음, 검증 시에만 payload.get('mt_idx') or payload.get('sub'))
- **시크릿 env**: JWT_SECRET_KEY
- **access TTL**: ACCESS_TOKEN_EXPIRE_MINUTES=43200분(30일). exp 초 환산값(_access_expires_in_seconds=43200*60)이 응답의 expires_in으로 내려감
- **refresh 정책**: refresh는 JWT가 아니라 불투명 랜덤 문자열. raw=secrets.token_urlsafe(48)(64자). DB(refresh_token 테이블)에는 SHA-256 hex 해시(token_hash)만 저장, raw는 발급 시점에만 존재. rotation은 chain_id(uuid4) 단위: rotate() 시 새 raw 발급+기존 row revoked_at 설정+replaced_by_hash=new_hash. reuse 감지(이미 revoked된 raw 재진입) 시 같은 chain_id의 활성 토큰 전체 revoke 후 None 반환. TTL=REFRESH_TOKEN_EXPIRE_DAYS=30일. issue/rotate 시 user_agent(255자 절단)·ip_hash(SHA-256(client.host)) 저장. /refresh 엔드포인트: v2(body refresh_token→rotation, 새 access+새 refresh 반환) / v1(Bearer access→access만 재발급, 하위호환)
- **비고**: 두 라이브러리 혼용 주의: app/api/v1/endpoints/auth.py와 app/api/deps.py·crud_auth.py는 python-jose(from jose import jwt)를, app/services/member_service.py(소셜 토큰)는 PyJWT(import jwt)를 사용. 둘 다 동일 HS256+동일 SECRET_KEY로 상호 디코드 가능. 소셜 로그인 토큰(create_access_token_for_social)은 claim이 mt_idx+exp만 있고 mt_id/mt_name 없음 → 검증부는 mt_idx만 있어도 통과해야 함. exp는 항상 UTC(naive utcnow) 기준이라 Go에서도 UTC로 계산해야 동일 만료시각.

## 패스워드
- "bcrypt. 해싱: get_hashed_password()는 bcrypt.gensalt(rounds=settings.PASSWORD_BCRYPT_COST=12) → bcrypt.hashpw(...).decode('utf-8'). 스킴은 $2b$ (Python bcrypt 기본). 단 update_user_password()는 정책검증 없이 bcrypt.gensalt() 기본 cost(12)로 별도 해싱 — cost는 같지만 정책 우회 경로 존재. 검증: bcrypt.checkpw(plain.encode, hashed.encode). 해시 없으면(소셜 사용자) False. Go 호환: golang.org/x/crypto/bcrypt는 $2a$를 기본 생성하나 $2b$/$2a$/$2y$ 모두 verify 가능 → 기존 DB 해시($2b$, $2y$ PHP password_hash 포함) 검증은 호환됨. 신규 해시 생성 시 cost=12 고정 필요. PHP PASSWORD_DEFAULT($2y$)로 만들어진 레거시 해시도 같은 컬럼(mt_pwd)에 혼재하므로 verify는 prefix 무관 동작 보장 필요."

## OAuth
- POST /api/v1/auth/kakao-login (auth.py:473, KakaoLoginResponse) — mt_kakao_id로 조회, 없으면 crud_auth.create_kakao_user(mt_type=2), POST /api/v1/auth/google-login (auth.py:1050, GoogleLoginResponse), POST /api/v1/auth/apple-login (auth.py:1121, AppleLoginResponse, mt_apple_id), POST /api/v1/auth/find-user-by-email (auth.py:640) — 구글 연동용 조회, POST /api/v1/auth/find-user-by-phone (auth.py:841) — 전화 기반 조회, 소셜 로그인 토큰 발급은 app/services/member_service.py:create_access_token_for_social(user_id) — claim은 {mt_idx, exp}만 (PyJWT 사용), 전화/비번 로그인: POST /api/v1/auth/login(LoginResponseHome), /login-original(LoginResponse), /register, 비번재설정 /forgot-password·/verify-reset-token·/reset-password·/reset-password-by-phone

## 응답 포맷
- **성공**: "core/response.py: success_response(data, message)→{'success':True,'message':...,'data':...} / error_response→{'success':False,'message':...,'data':...}. 단 실제 로그인/refresh 엔드포인트는 이 헬퍼를 안 쓰고 직접 dict/Pydantic 응답을 구성: /login(LoginResponseHome)은 {success, message, data:{token, refresh_token, expires_in, user:{...}}}. /refresh v2는 {success, token, refresh_token, expires_in, message}(data 래핑 없음, 평면). 레거시 create_response()는 {resultCode, resultMsg, resultData} 별도 포맷(SUCCESS=200/FAILURE=400 상수). 즉 단일 표준이 아니라 엔드포인트별 포맷 혼재 — 클라이언트 호환 위해 경로별로 정확히 복제 필요."
- **에러**: "두 가지 혼재. (1) 인증/검증 실패는 FastAPI HTTPException(status_code, detail='한국어 메시지', headers={'WWW-Authenticate':'Bearer'}) → 응답 본문 {'detail': '...'}. 상태코드 매핑: 401(인증필요/토큰무효/refresh무효/사용자없음), 403(get_required_admin_id: mt_level!=9 관리자권한필요), 404(get_current_user: 사용자없음). (2) 일부 로그인 실패는 200 OK + {success:False, message:'아이디 또는 비밀번호가 올바르지 않습니다.'} 본문(LoginResponseHome) — 즉 인증 실패가 항상 401이 아님. detail 메시지 문자열은 한국어 고정값이라 클라이언트가 메시지 매칭할 수 있어 그대로 복제 권장."

## 캐시(Redis)
- "core/cache.py: Redis(host=127.0.0.1, port=6379, db=0, decode_responses=True, connect/socket timeout 2s). lazy init, 연결 실패 시 None 반환하고 캐싱 비활성(에러 무시·fail-open). 키 패턴: 데코레이터 @cached(prefix, ttl=300, key_func)가 'prefix:...' 형태로 생성. key_func 없으면 'prefix:'+json.dumps(kwargs, sort_keys=True, default=str)(단 db/authorization/request 및 None 값 제외). 값은 json.dumps(default=str)로 직렬화. 기본 TTL 300초(5분), setex로 저장. cache_delete_pattern은 KEYS+DELETE(blocking). 모든 Redis 에러/JSON 에러는 except로 흡수(캐시는 best-effort)."

## 주요 설정 키
- JWT_SECRET_KEY (필수), JWT_ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE_MINUTES=43200, REFRESH_TOKEN_EXPIRE_DAYS=30, REFRESH_TOKEN_BYTES=48, MYSQL_HOST/MYSQL_USER(필수)/MYSQL_PASSWORD(필수)/MYSQL_DB(별칭 MYSQL_DATABASE, 기본 smap2_db)/MYSQL_PORT=3306/MYSQL_CHARSET=utf8mb4, SQLALCHEMY_DATABASE_URI(자동생성: mysql+pymysql://...), DB_POOL_SIZE=20/DB_MAX_OVERFLOW=30/DB_POOL_TIMEOUT=60/DB_POOL_RECYCLE=3600, PASSWORD_MIN_LENGTH=8/PASSWORD_BCRYPT_COST=12/PASSWORD_REQUIRE_UPPERCASE,LOWERCASE,NUMBERS,SPECIAL=True, BACKEND_CORS_ORIGINS(리스트), FRONTEND_URL/PUBLIC_API_BASE_URL, API_V1_STR=/api/v1, MIN_APP_VERSION_ANDROID/IOS=3.1.0, ALIGO_USER_ID/ALIGO_KEY/ALIGO_SENDER, FIREBASE_CREDENTIALS_PATH/FIREBASE_PROJECT_ID/IOS_BUNDLE_ID/IOS_PUSH_RETRY_COUNT=3, KMA_SERVICE_KEY, EMAIL_SENDER/EMAIL_PASSWORD/EMAIL_SMTP_SERVER=smtp.gmail.com/EMAIL_SMTP_PORT=465, DEBUG=False

## Go 이식 핵심 (동등성 유지)
- JWT 서명: HS256 + 동일 JWT_SECRET_KEY env. claim 키 이름을 그대로 유지(mt_idx, mt_id, mt_name, exp). 검증부는 반드시 mt_idx 우선, 없으면 sub fallback (구 토큰 호환). 소셜 토큰은 mt_idx+exp만 있으므로 mt_id/mt_name 누락을 허용해야 함
- exp는 Python datetime.utcnow()(UTC naive) + TTL의 Unix epoch 정수. Go에서도 UTC 기준 time.Now().UTC().Add(...)로 계산해 동일 만료시각 보장. 클럭스큐 미설정(jose/PyJWT 기본)
- access TTL은 분 단위 43200(30일)으로 고정. expires_in 응답은 초 단위(43200*60=2592000)로 내려야 클라이언트 동일 동작
- refresh는 JWT 아님. secrets.token_urlsafe(48) = URL-safe base64 64자. Go에서는 48바이트 crypto/rand → base64.RawURLEncoding(패딩 없음) 인코딩으로 동일 형식 재현. DB 저장 해시는 SHA-256 hex(hashlib.sha256(raw.encode).hexdigest()) — Go도 동일하게 sha256 + hex.EncodeToString. 같은 raw가 같은 hash를 내야 기존 발급된 refresh가 계속 검증됨
- refresh rotation/reuse 로직 동일 복제: rotate 시 기존 row revoked_at+replaced_by_hash 설정, reuse(revoked된 token_hash 재진입) 시 동일 chain_id의 revoked_at IS NULL 전체 revoke. chain_id는 uuid4 문자열
- bcrypt: 신규 해시 cost=12 고정. golang.org/x/crypto/bcrypt는 기본 $2a$ 생성하나 verify는 $2a$/$2b$/$2y$ 호환 → 기존 PHP password_hash($2y$)·Python bcrypt($2b$) 해시 모두 검증 가능. mt_pwd 빈값이면 verify False 반환 유지
- ip_hash는 SHA-256(client_ip)의 hex, user_agent는 255자 절단 후 빈 문자열이면 NULL 저장 — DB 컬럼 제약 동일 유지
- 응답 본문 포맷이 엔드포인트별로 다름(평면 vs data 래핑, 200+success:false vs HTTPException) — 표준화하지 말고 경로별로 그대로 복제. HTTPException detail의 한국어 메시지 문자열도 클라이언트가 매칭할 수 있으니 동일하게
- Redis 캐시는 best-effort(fail-open). 연결 실패해도 500 내지 말고 DB 직접 조회로 폴백. 키 prefix와 json.dumps(sort_keys=True) 직렬화 규칙을 맞춰야 Python/Go 캐시 공유 시 키 충돌·미스 방지(공유 안 할 거면 무시 가능)
- mt_idx fallback에서 sub가 문자열로 들어온 구 토큰이 있을 수 있으니 Go에서 int/string 양쪽 파싱 허용
