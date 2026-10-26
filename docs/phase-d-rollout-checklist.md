# Phase D — Refresh Token + 강제 업데이트 롤아웃 체크리스트

> Phase A/B/C가 모두 머지·배포된 후 진행. 순서가 어긋나면 사용자 세션 폭주 또는 강제 차단 사고가 발생할 수 있습니다.

## 목표
- 30일 access token → 1시간 access + 30일 refresh로 전환
- 구버전 즉시 강제 업데이트 활성화

## 사전 조건
- [ ] **Phase A 백엔드** — `docs/phase-a-integration-guide.md`의 4개 수정 파일 변경이 본인 worktree와 합쳐 별도 커밋 + 배포 완료
- [ ] **Phase A DB 마이그레이션** — `backend/migrations/2026-04-14_add_refresh_tokens.sql`이 prod DB에 실행 완료
- [ ] **Phase B 안드로이드** — `docs/phase-b-android-integration-guide.md`의 7개 수정 파일이 본인 worktree와 합쳐 별도 커밋 + 빌드 완료, Play Console 내부 테스트 통과
- [ ] **Phase C iOS** — `7c6aca234`(Phase B 커밋) / `58b9a3dbf`(Phase C 커밋)이 iOS Xcode 프로젝트에 반영, TestFlight 통과
- [ ] **TestFlight / Play 내부 테스트** — 신버전 빌드를 실제 기기에서 7일 이상 사용. refresh rotation, 강제 업데이트, 401 재시도 동작 확인

## 빌드 번호 결정
배포할 신버전 빌드 번호를 확정하고 백엔드 설정에 반영. **반드시 두 플랫폼 동일 번호로 일치**(혹은 둘 다 명시적 분리). 예시:
- Android: `versionName = "3.2.0"`
- iOS: `CFBundleShortVersionString = "3.2.0"`

## 1단계 — 신버전 앱 배포

### Android
- [ ] `Android/app/build.gradle.kts`의 `versionCode`/`versionName` 증가
- [ ] release build → AAB 업로드
- [ ] Play Console에서 단계적 출시(예: 10%) 시작
- [ ] 1일 후 크래시율/refresh 실패율 모니터링

### iOS
- [ ] iOS/smap.xcodeproj 빌드 번호 증가
- [ ] App Store Connect 업로드
- [ ] 심사 통과 후 단계적 출시 50% → 100%
- [ ] **iOS App Store URL**: `iOS/smap/App/RootView.swift`의 `id6450881892`를 실제 App Store ID로 교체. App Store Connect의 앱 정보 → "Apple ID" 항목에서 확인
- [ ] 크래시율 모니터링

## 2단계 — Access Token 수명 단축 (1주 후)

배포 1주 이상 지나 신버전 점유율이 충분(~70%+)해진 시점에:

### 백엔드
```python
# backend/app/core/config.py
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 30일 → 1시간
```
- [ ] 배포 직후 모니터링: 401 응답률, /auth/refresh 호출량 폭증 여부 정상 범위 내
- [ ] 구버전(refresh 미지원) 클라이언트는 1시간 후부터 401 → 자동 로그아웃 → 재로그인. 사용자 컴플레인 모니터링.

만약 401 폭주가 심하면 1시간 → 4시간 → 1시간 식의 점진적 단축으로 완화.

## 3단계 — 강제 업데이트 활성화 (구버전 차단)

신버전 점유율이 90%+ 도달, 또는 정책상 즉시 차단이 결정되면:

### 백엔드 환경변수 (또는 config 직접 변경)
```bash
MIN_APP_VERSION_ANDROID=3.2.0
MIN_APP_VERSION_IOS=3.2.0
```
또는 `backend/app/core/config.py`의 default 값을 신버전 번호로 직접 수정.

- [ ] 배포 직후 `GET /api/v1/app/version-check?platform=android&version=3.0.0` 호출해 `update_required=true` 응답 확인
- [ ] iOS도 동일하게 확인
- [ ] CS팀 사전 공지 — "구버전 사용자 강제 업데이트 다이얼로그가 뜨고 있음"

## 4단계 — 모니터링 (활성화 후 1주)

- [ ] 일일 신규 refresh token 발급 수
- [ ] 일일 refresh rotation 호출 수 (정상 사용자 1인당 access TTL/일 = 24회 정도)
- [ ] reuse detection 트리거 횟수 (정상 사용 중에는 0~극소수여야 함. 폭증하면 동시 요청 race 확인)
- [ ] 강제 업데이트 다이얼로그 노출 후 store conversion 비율
- [ ] CS 컴플레인 — "갑자기 로그아웃됨" 등

## 5단계 — 정리

- [ ] `backend/app/api/v1/endpoints/auth.py`의 `/auth/refresh` v1 fallback 경로 제거 검토(모든 클라가 v2 사용 후)
- [ ] `AuthInterceptor`의 v1 호환 분기 정리
- [ ] DB cron — 만료된 refresh token 주기 정리(`DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL 7 DAY`)

## 롤백 절차

문제 발생 시 **단계적으로** 롤백:

| 증상 | 롤백 |
|------|------|
| 401 폭주, refresh 실패 | `ACCESS_TOKEN_EXPIRE_MINUTES`를 다시 큰 값(예: 10080=1주)으로 |
| 강제 업데이트로 사용자 차단 | `MIN_APP_VERSION_*`을 낮춰서 차단 해제 |
| reuse detection 폭증 | `crud_refresh_token.rotate`의 reuse 분기 임시 비활성화(주석 처리) |
| Keychain/EncryptedSharedPreferences 문제 | 클라이언트 hotfix 배포 전까지 v2 refresh 제거(서버 응답에 refresh_token 미포함)는 옵션이지만 비권장 |

## 검증 cURL

```bash
BASE=https://api3.aiagnt.kr/api/v1

# 1. 로그인 — refresh_token, expires_in 포함 확인
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mt_id":"<phone>","mt_pwd":"<pw>"}' | jq '.data | {token, refresh_token, expires_in}'

# 2. refresh rotation
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<raw_from_step_1>"}' | jq

# 3. logout — refresh revoke
curl -s -X POST $BASE/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<rotated_raw>"}' | jq

# 4. revoked refresh로 다시 회전 시도 → 401
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<rotated_raw_already_revoked>"}' -i | head

# 5. version-check
curl -s "$BASE/app/version-check?platform=android&version=3.0.0" | jq
# 기대: update_required=true, force_update=true (Phase D 활성화 후)
```

## 스테이크홀더 공지

- **사용자**: "보안 강화 및 안정성 개선을 위해 구버전 차단" 안내(공지 채널/푸시).
- **CS**: 강제 업데이트 다이얼로그 안내, 업데이트 후에도 문제 시 로그인 재시도 안내.
- **데이터팀**: refresh_tokens 테이블 추가에 따른 백업/모니터링 대시보드 갱신.
