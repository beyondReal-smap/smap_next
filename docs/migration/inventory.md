# SMAP 백엔드 Python → Go 이식 — 전체 정밀 인벤토리

> 작성: 2026-05-30 · 워크플로 `py-backend-inventory`(12 도메인 병렬 분석) 결과 종합
> 상태: **매핑 완료**. 구현은 다음 세션부터 (설계서 `backend/.claude/plans/python-to-go-migration.md` v3 기준)
> 검증: ground truth(215 라우터 데코레이터)와 **교차검증 누락 0건** 확인

---

## 0. TL;DR

| 항목 | 수치 |
|------|------|
| 실제 엔드포인트 | **207개** (215 데코레이터 − backup 6 − dead `fcm_silent_push` 2) |
| 분석 도메인 | 9개 (auth/member/group/location/schedule/push/misc-read/misc-write/chat) |
| 모델 ↔ 테이블 | **14개** |
| 배치 잡 | **12개** (APScheduler → asynq) |
| 복잡도 분포 | trivial 54 · low 66 · medium 46 · high 31 · very_high 9 |
| **보안 발견** | **43건** (P1 27·P2 11·정리 5 — §5, `security-findings.md`) |
| 라우트 이식 견적 | Phase2 4.5일 + Phase4 54일 + Phase5 6일 + 잡(Phase3) ~15일 ≈ **설계서 12~18주와 일치** |

**현 진행**: Phase 1(Go 스캐폴딩 — health/db/cache/config/server/middleware) 완료·빌드 통과. 다음은 **Phase 2 `/app` PoC**.

---

## 1. 인프라 동등성 핵심 (이식 전 반드시 고정) → 상세 `infra.md`

### 1.1 JWT / 인증 — Python·Go 토큰 상호호환 필수
- **알고리즘**: HS256, 시크릿 `JWT_SECRET_KEY`(env 공유)
- **claim**: `mt_idx`(주 식별자), `mt_id`, `mt_name`, `exp`. 검증은 **`mt_idx` 우선 → 없으면 `sub` fallback**(구 토큰 호환)
- **소셜 토큰**: `member_service.create_access_token_for_social` — claim이 `{mt_idx, exp}`만 (PyJWT 사용, jose 아님) → Go는 `mt_id/mt_name` 누락 허용해야 함
- **access TTL**: `ACCESS_TOKEN_EXPIRE_MINUTES=43200`(30일), 응답 `expires_in`은 초(2592000). `exp`는 **UTC** 기준
- **refresh**: JWT 아님. `secrets.token_urlsafe(48)`(64자), DB엔 **SHA-256 hex만** 저장. `chain_id`(uuid4) 단위 rotation, revoked raw 재유입 시 **chain 전체 revoke**(reuse 감지). Go는 `48바이트 crypto/rand → base64.RawURLEncoding` + `sha256+hex`로 동일 재현
- **bcrypt**: 신규 cost=12. golang.org/x/crypto/bcrypt는 `$2a/$2b/$2y` 검증 호환 → **기존 PHP/Python 해시 그대로 검증 가능** ✅

### 1.2 응답·에러 계약 — ⚠️ 표준화 금지, 경로별 그대로 복제
- 성공: `core/response.py`의 `{success, message, data}` 래핑 **또는** 평면 dict (엔드포인트별 상이)
- **다수 라우터가 실패 시 HTTP 200 + `success:false` 반환**(401 안 씀). 일부(`/login-original`, `/refresh`, `/me`)만 `HTTPException` 4xx
- `HTTPException(detail='한국어 메시지')` → 본문 `{detail}`. 한국어 메시지를 클라가 매칭할 수 있으니 **문자열까지 동일 유지**

### 1.3 캐시(Redis) — best-effort(fail-open)
- `core/cache.py`: db=0, `@cached(prefix, ttl)` 데코레이터, `json.dumps(sort_keys=True)` 직렬화. 연결 실패 시 None(캐싱 비활성, 500 금지)

### 1.4 ⚠️ 인프라 갭 (Phase 진입 전 해소 필요)
| 갭 | 영향 | 해소 시점 |
|----|------|-----------|
| **REDIS_URL 미설정** | asynq(잡 큐) 동작 불가 | **Phase 3 진입 전** Redis 인프라 확보 |
| **SMS 인증코드가 `sms.py` 인메모리** | Go 멀티 인스턴스에서 공유 안 됨 | **Phase 4 auth 전** Redis 등 외부 저장소화 |
| Firebase 인증 3단 폴백 | `FIREBASE_CREDENTIALS_JSON`(env)→`FIREBASE_CREDENTIALS_PATH`(파일) | Phase 3 푸시 이식 시 |

---

## 2. 도메인별 요약 (설계서 Phase 기준) → 상세 매트릭스 `endpoints.md`

| 도메인 | ep | Phase | risk | 견적 | 핵심 난점 |
|--------|----|-------|------|------|-----------|
| **misc-read** (weather/notices/app/admin) | 14 | **2** | medium | 4.5일 | weather KMA 캐싱(`@cached`), `/app`이 PoC 후보(GET 1개) |
| **auth** (/auth /users) | 25 | 4 | high | 7일 | JWT/refresh 회전 동등, SMS 인메모리 외부화, 200+success:false 계약 |
| **member** (/members /fcm-token) | 40 | 4 | high | 9일 | FCM 토큰 시간기반 분기(3600/300/7200초), 수평인가 일부 부재 |
| **group** (/groups /group-*) | 31 | 4 | high | 7일 | sgt_code MD5 생성(PHP 호환), 스키마-모델 컬럼 불일치, soft delete |
| **location** (/locations /logs) | 25 | 4 | high | 9일 | 고빈도 raw SQL INSERT, mt_idx 하드코딩(282/641), 동시점유 |
| **schedule** (/schedules /schedule) | 18 | 4 | **very_high** | 9일 | 비즈니스 룰 복잡, 알림 트리거 연계, 반복일정 |
| **push** (/push-logs /push-fcms /sendone) | 28 | 4 (워커는 3) | high | 6일 | FCM 멀티캐스트, OpenAI 메시지 생성, N+1 발송 |
| **misc-write** (/orders /sms /log-mgmt /hwgi) | 22 | 4 | high | 7일 | hwgi 파일 업로드/OpenAI 리포트, SMS 알리고, 트랜잭션 |
| **chat** (/chats /ws) | 3 | **5** | **very_high** | 6일+ | **Socket.IO v4 호환성**(googollee/go-socket.io 약함) — 잔존 가능 |

> push 도메인의 **발송 경로**는 Phase 3(잡 워커)와 함께 이전, **CRUD/조회**는 Phase 4.

---

## 3. 배치 잡 12개 (Phase 3, asynq) → 상세 `jobs.md`

전부 `max_instances=1, coalesce=True` + misfire_grace_time 설정. 단일 in-process `BackgroundScheduler`, lifespan startup에서 `start()`.

| 주기 | 잡 | 비고 |
|------|----|------|
| **every 30s** | geofence 4종 (그룹 일정장소/My Place 진입·이탈 알림) | ENTRY ≤80m / EXIT ≥120m 히스테리시스 |
| **every 1min** | 일정 30분전 알림 · 예약푸시 발송(outbox) | |
| **every 20min** | 회원 최신위치 → member_t.mt_lat 동기화 | |
| **daily** | silent_push(03:00) · app실행유도(19:30) · 배터리(21:00) · 날씨갱신(06:30) · 날씨알림(07:00) | |

**이중 실행 방지**(설계서 §9.2): Go asynq 배포 → Python `SMAP_DISABLE_SCHEDULER=1` → Go enqueue 활성. **둘 다 꺼진 시점 0초** 엄수. 잡 멱등성은 `jobs.md` 참조.

---

## 4. 모델 ↔ 테이블 14개 → 상세 `models.md`

```
Member/member_t              Group/smap_group_t           GroupDetail/smap_group_detail_t
Location/smap_location_t      MemberLocationLog/member_location_log_t
Schedule/smap_schedule_t      PushFCM/push_fcm_t           PushLog/push_log_t
Order/order_t                 Notice/notice_t              RefreshToken/refresh_tokens
ChatRoom/smap_chat_room_t     ChatMember/smap_chat_member_t  ChatMessage/smap_chat_msg_t
```

**동시점유 최고 위험**: `member_location_log_t`(고빈도 INSERT), `smap_chat_msg_t`(채팅). 한 prefix는 한 스택만 쓰기 소유(설계서 §7.1). DB는 단일 소스 오브 트루스 — 양 스택이 동일 테이블 공유.

---

## 5. ⚠️ 보안 발견 43건 — 의사결정 필요 → 상세 `security-findings.md`

이식 중 발견. **설계서 비목표("API 계약·인증 방식 변경 없음")와 충돌**하므로 별도 의사결정 항목.
(인증 플로우 자체 — 로그인/가입/소셜/비번재설정 — 의 무인증은 정상으로 제외함)

| 패턴 | 건수 | 심각도 | 예시 |
|------|------|--------|------|
| 무인증 쓰기/삭제(회원·그룹·위치) | 17 | **P1** | `PUT/DELETE /users/{id}`, `PUT /group-details/{id}/role`(임의 리더임명) |
| 인증 후 수평인가 부재 | 4 | **P1** | `PUT /orders/status/{id}`, FCM 토큰 일부 |
| 무인증 발송/파일 I/O | 6 | **P1** | `/fcm_sendone/silent-batch`, `/hwgi/upload-photo`, generate-report(OpenAI 비용) |
| 무인증 정보 노출(전체 회원/PII) | 8 | P2 | `GET /users/`, `GET /members/`(limit 10000) |
| 에러/토큰 정보 노출 | 3 | P2 | `except→500 str(e)`, forgot-password 토큰 평문 로그 |
| 하드코딩 디버그/데드 | 5 | 정리 | `/groups/emergency-restore`(mt_idx=1186) |

**권장 처리 방침**(`security-findings.md`에서 상세):
1. **동등 이식 우선** — 설계서 충실, 무인증 그대로 + canary 비교. 단 명백한 디버그/테스트(`emergency-restore`, `test-send`)는 **이식 제외**
2. **앱 토큰 송신 여부 확인** 후, Phase 4에서 인증 게이트 추가를 별도 검토(앱 릴리스 영향)
3. P1 항목은 대표님 의사결정 필요

---

## 6. 다음 세션 권장 시작점

**Phase 2 — `/app` PoC** (가장 안전한 첫 단추):
- `GET /app` (app_version, 단일 GET, 외부의존 없음)
- handler→service→repository 전 계층으로 Go 표준 패턴 확립
- Python:9000 vs Go:9200 응답 JSON diff 동등성 검증
- 이후 weather(KMA 캐싱)→notices→admin read 순

그 다음 권장 순서: Phase 2 완주 → **Redis 인프라 확보** → Phase 3(잡 워커) → Phase 4(도메인, auth 토큰 호환 사전검증 필수) → Phase 5(chat, Socket.IO 결정 게이트).

---

## 부속 문서
- `endpoints.md` — 207개 엔드포인트 전체 매트릭스 (method/path/auth/복잡도/사이드이펙트/이식노트)
- `models.md` — 14개 모델-테이블 매핑 + GORM 이식 노트 + 동시점유 위험
- `jobs.md` — 12개 잡 + 스케줄러 구성 + 멱등성
- `infra.md` — JWT/bcrypt/refresh/응답/캐시/설정 동등성 가이드
- `security-findings.md` — 보안 72건 분류 + 의사결정 옵션
