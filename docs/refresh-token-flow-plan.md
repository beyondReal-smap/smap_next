# Refresh Token 플로우 — 설계 초안(별도 티켓용)

> 이 문서는 **즉시 구현용**이 아니라 합의용 초안입니다. 백엔드/앱 양쪽 변경과 보안 검토가 필요하므로 대표님 승인 후 별도 티켓으로 진행합니다.

## 1. 배경

### 현재 구조의 한계
- `/api/v1/auth/refresh` (`backend/app/api/v1/endpoints/auth.py:185`)는 **기존 access token이 JWT 디코딩 가능할 때만** 새 토큰 발급. 실질적으로 "토큰 회전" 기능 only.
- `settings.ACCESS_TOKEN_EXPIRE_MINUTES = 43200` (30일) — access token 유효기간이 매우 김.
- **진짜 refresh token이 없음**: 서명 키 로테이션·revocation·이상 탐지 시 토큰을 강제 만료시키는 수단 부재.
- access token이 네트워크에 30일 노출 → 탈취 시 복구 방법이 로그아웃(클라이언트 prefs clear)뿐. 서버는 토큰을 무효화할 방법 없음.

### 이번 이슈와의 관계
이번에 적용한 `TokenAuthenticator`는 **만료되지 않은 access token을 회전하는 경로**까지만 커버. 실제 만료(30일 이후) 또는 서버가 키 로테이션으로 무효화한 경우엔 재로그인이 필요. 사용 UX 회귀 위험이 있어 진짜 refresh 도입 권장.

## 2. 목표

1. 짧은 수명의 **access token**(예: 1시간) + 긴 수명의 **refresh token**(예: 30일)로 분리.
2. refresh token은 서버 DB에 저장·관리. 탈취 시 **서버 단에서 무효화** 가능.
3. 클라이언트는 refresh token을 **Android EncryptedSharedPreferences**(또는 Keystore 기반 저장소)에 보관.
4. 기존 30일짜리 access token 이용자 마이그레이션 경로 확보.

## 3. 백엔드 변경

### 3.1 DB 스키마
```sql
CREATE TABLE refresh_tokens (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    mt_idx        INT NOT NULL,
    token_hash    CHAR(64) NOT NULL UNIQUE,        -- SHA-256(raw token)
    issued_at     TIMESTAMP NOT NULL,
    expires_at    TIMESTAMP NOT NULL,
    revoked_at    TIMESTAMP NULL,
    user_agent    VARCHAR(255) NULL,
    ip_hash       CHAR(64) NULL,
    INDEX idx_mt_idx (mt_idx),
    INDEX idx_expires (expires_at)
);
```
- raw refresh token은 **서버에 저장하지 않음** — 해시만.
- `user_agent`/`ip_hash`는 이상 탐지용(선택).

### 3.2 설정 (`backend/app/core/config.py`)
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60           # 1시간
REFRESH_TOKEN_EXPIRE_DAYS: int = 30             # 30일
REFRESH_TOKEN_BYTES: int = 64                   # secrets.token_urlsafe(64)
```

### 3.3 엔드포인트 변경

#### `POST /auth/login` 응답 스키마
```jsonc
{
  "success": true,
  "data": {
    "token": "<access_token_jwt>",          // 1h
    "refresh_token": "<opaque_token>",      // 30d, 불투명 랜덤
    "expires_in": 3600,
    "user": { ... }
  }
}
```

#### `POST /auth/refresh` 재설계
- 요청 바디: `{ "refresh_token": "..." }` (Authorization 헤더 사용 안 함).
- 서버 로직:
  1. `sha256(refresh_token)` 계산 → `refresh_tokens` 조회.
  2. `revoked_at IS NULL AND expires_at > NOW()` 확인.
  3. **rotation**: 기존 row `revoked_at = NOW()`, 새 refresh token 발급 & 저장.
  4. 새 access token + 새 refresh token 반환.
- 응답 성공 200 / 실패 401.

#### `POST /auth/logout` 재설계
- 요청 바디: `{ "refresh_token": "..." }`.
- 서버 로직: 해당 refresh token의 `revoked_at = NOW()`.
- 동일 mt_idx의 **전 세션 종료**가 필요할 때는 `logout-all` 별도.

### 3.4 하위 호환
- 구 클라이언트(v3.0.x 이하)는 refresh 필드를 파싱하지 않음. 응답에 `refresh_token` 추가만 해도 무해.
- 구 클라이언트는 계속 30일 access token을 쓰다가 만료되면 로그인. 수명은 서버 설정으로 짧게 바꾸면 구버전 사용자가 더 자주 재로그인하게 되므로 **버전 분기**가 필요:
  - 헤더 `User-Agent` 또는 `X-App-Version`로 분기, v3.1+만 1h access 발급.
  - 또는 구 버전은 `/auth/login-original`로 유도.

## 4. Android 변경

### 4.1 저장소
- 신규 `TokenStore` 추상화. 구현은 `EncryptedSharedPreferences`(AndroidX Security).
- access token은 메모리 + SharedPreferences(기존), refresh token은 **EncryptedSharedPreferences만**.
- 앱 삭제/로그아웃 시 전부 clear.

### 4.2 TokenAuthenticator 보강
- 401 수신 시 현재 로직: `POST /auth/refresh` with Bearer(access). 새 경로:
  - 저장된 refresh token으로 `{ refresh_token: ... }` body 전송.
  - 응답으로 받은 **새 access + 새 refresh 양쪽** 저장.
  - refresh 요청 실패(401)면 `AuthService.logout()` 호출 후 LoginActivity로 리디렉션.
- rotation으로 refresh가 매번 바뀌므로 동시 호출 race 주의. 현재는 `Authenticator`가 per-connection 직렬화되므로 단일 refresh는 안전하지만, 다른 `OkHttpClient`에서 동시 호출되면 두 번째가 실패할 수 있음 → 단일 프로세스 Mutex 또는 최근 refresh cache(30초) 도입.

### 4.3 호출부 변경
- `AuthService.login/googleLogin/kakaoLogin` 성공 경로에서 `refresh_token` 저장 추가.
- `AuthService.logout` 시 서버 `/auth/logout`도 호출(refresh token 무효화) 후 로컬 clear.

### 4.4 마이그레이션
- 앱 업그레이드 후 첫 실행 시 refresh token이 없으면 기존 access token으로 한 번만 **전용 부트스트랩 API** 호출 → 서버가 refresh token 발급.
- 또는 access token이 401을 맞은 순간 LoginActivity 유도(UX 후퇴).

## 5. 보안 체크리스트

- [ ] refresh token 발급은 HTTPS 위에서만.
- [ ] DB에는 해시만 저장(raw 없음).
- [ ] rotation 적용 — 재사용 감지 시 해당 체인 전부 revoke(reuse detection).
- [ ] `EncryptedSharedPreferences` 키는 Android Keystore로 관리.
- [ ] 로그에 token raw를 남기지 않음(현재 `AuthService.saveToken`의 `take(10)` 프리뷰 로그도 재검토).
- [ ] refresh 응답 캐싱 금지(OkHttp).
- [ ] 관리자/CS 목적의 "전 세션 로그아웃" 기능 — `DELETE /auth/sessions`.

## 6. 구현 단계(별도 티켓)

1. **백엔드 DB + refresh 엔드포인트 신설** — 기존 `/auth/refresh`는 하위 호환 유지하며 v2 `/auth/refresh-v2` 추가. 또는 같은 엔드포인트 요청 바디로 분기.
2. **Android TokenStore + EncryptedSharedPreferences** 도입.
3. **TokenAuthenticator refresh 경로 교체**(기존 경로는 fallback).
4. **로그인 응답 스키마 확장 → 클라이언트 저장 경로 추가**.
5. **마이그레이션 UX 확정**(강제 재로그인 vs 부트스트랩 API).
6. QA: 만료·revoke·rotation 시나리오 테스트, 서버 DB 부하 측정.
7. 롤아웃: 서버 먼저 + 버전 분기 → 앱 업데이트 배포.

## 7. 리스크

- **DB 부하**: 모든 사용자 × 30일 × 다중 기기 = refresh row 누적. `expires_at` 인덱스 + 주기적 purge cron 필요.
- **세션 수 제한**: 동일 사용자 기기 다중 접속 시 refresh token이 여러 개. 정책 결정 필요(무제한 / N개 / 기기별 단일).
- **로테이션 race**: 동시 요청이 서로 다른 refresh token을 내는 경우 reuse detection에 걸려 정상 사용자가 로그아웃당할 수 있음 → Authenticator 단일화 필수.

## 8. 확정되어야 할 정책

대표님 결정사항:
1. access token 수명(1h 제안) — 배터리/서버 부하 tradeoff.
2. 동일 계정 동시 세션 개수 제한 여부.
3. refresh 재사용 감지(reuse detection) 엄격도 — 감지 시 전 세션 로그아웃 vs 해당 체인만.
4. 구 버전 사용자 강제 업데이트 정책.

이 네 가지만 확정되면 본격 구현 가능. **예상 작업량: 백엔드 3~4일 + Android 2~3일 + QA 2일.**
