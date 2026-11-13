# SMAP 백엔드 Python → Go 점진 마이그레이션 설계서

> 작성일: 2026-05-27 (v3: 환경 사실 추가 확인 반영)
> 작성자: Claude Code
> 상태: **확정 (v3)** — Go 1.26.2 이미 설치 확인, 포트/도메인 슬롯 확인 완료. Phase 1 코드 작성 진행 중.

---

## 0. 개요 (TL;DR)

| 항목 | 결정 |
|------|------|
| **목적** | 성능/리소스 절감 (FastAPI 워커 메모리·지연·CPU 사용량 축소) |
| **전략** | **Strangler Fig** — 게이트웨이 단에서 라우트별로 Go 서비스로 트래픽 점진 이전, Python은 마지막 도메인까지 살려둠 |
| **Go 스택** | **Gin** (HTTP) + **GORM** (ORM) + **asynq** (Redis 작업 큐) + **firebase-admin-go** (FCM) + **go-redis** + **slog** (로깅) |
| **공유 자원** | MySQL · Redis · 정적 파일 디렉터리 · JWT 시크릿을 Python/Go가 **동시 점유** |
| **롤백** | Nginx upstream 한 줄 되돌리면 즉시 Python으로 회귀 가능 |
| **비목표** | 1) 기능 추가/리팩토링, 2) DB 스키마 변경, 3) 클라이언트(앱) API 계약 변경, 4) 인증 방식 변경 |

---

## 1. 현 상태 인벤토리

### 1.1 코드 규모

| 항목 | 수치 |
|------|------|
| 파이썬 파일 | 108 |
| 코드 라인 | 27,835 |
| API 라우터 prefix | 27 |
| 모델(ORM) | 18 |
| 서비스 모듈 | 9 (`ai_message`, `chat`, `email`, `firebase`, `member`, `push`, `sms`, `weather`, `notifications/*`) |
| APScheduler 잡 | 5 (`auth_jobs`, `daily_jobs`, `location_alerts`, `location_sync`, `push_jobs`) |
| Alembic 마이그레이션 | 2 |

### 1.2 현재 운영 형태 (`ecosystem.config.js`)

```
smap-api2  (app_v2.main, --uds /tmp/smap_fastapi.sock, SCHEDULER_DISABLED)
smap-api3  (app.main,   --host 127.0.0.1 --port 9000,  스케줄러 활성)
```

→ **이미 다중 프로세스/소켓 운영**. Nginx 또는 다른 리버스 프록시가 앞단에서 라우팅한다고 가정 (확인 필요 — §13.1).

### 1.3 라우터 prefix (27개)

```
/health, /auth, /users, /groups, /group-details, /locations,
/schedules, /schedule, /push-logs, /push-fcms, /members,
/group-members, /weather, /logs, /fcm_sendone, /notices,
/orders, /fcm-token, /member-fcm-token, /sms,
/log-management, /admin, /chats, /app, /hwgi
```

### 1.4 Python 의존성 → Go 매핑

| 영역 | Python | Go 대체 | 호환성 위험도 |
|------|--------|---------|-------|
| HTTP 프레임워크 | FastAPI 0.109 | **Gin 1.10+** | 낮음 |
| ASGI 서버 | uvicorn | 내장 net/http | 낮음 |
| ORM | SQLAlchemy 2.x | **GORM 2.x** | 중간 (relation eager load 차이) |
| 마이그레이션 | Alembic | **golang-migrate** 또는 Atlas | 중간 — Alembic과 분리 운영 필요 |
| 검증 | Pydantic v2 | **go-playground/validator** + struct tag | 중간 (커스텀 validator 재작성) |
| 설정 | pydantic-settings | **viper** 또는 envconfig | 낮음 |
| MySQL 드라이버 | mysqlclient / PyMySQL | go-sql-driver/mysql | 낮음 |
| JWT | python-jose | **golang-jwt/jwt v5** | **낮음** (시크릿/알고리즘 동일 유지 시 토큰 상호 검증 가능) |
| 패스워드 해시 | passlib + bcrypt | golang.org/x/crypto/bcrypt | **낮음** (동일 알고리즘) |
| 비대칭 암호화 | cryptography | crypto/* + go-jose | 중간 |
| 푸시 | firebase-admin (py) | **firebase.google.com/go/v4** | 낮음 |
| OpenAI | openai 1.x | **sashabaranov/go-openai** | 낮음 |
| 이미지 처리 | Pillow | **disintegration/imaging** 또는 imagor | 중간 (썸네일/리사이즈만 사용 중인지 확인 필요) |
| HTTP 클라이언트 | httpx, aiohttp | net/http + **hashicorp/go-retryablehttp** | 낮음 |
| 스케줄러 | APScheduler | **asynq** (cron 옵션) 또는 robfig/cron | 중간 — APScheduler의 jobstore/state 이관 설계 필요 |
| 캐시 | redis-py | **go-redis/v9** | 낮음 |
| WebSocket / Socket.IO | python-socketio (ASGI) | **마지막 단계로 보류** — googollee/go-socket.io는 v4 호환 약함. 옵션 평가 필요 (§9.3) | **높음** |
| SMTP | smtplib (표준) | net/smtp + **wneessen/go-mail** | 낮음 |
| 비동기 패턴 | asyncio | goroutine + errgroup | 패러다임 차이 |
| 로깅 | logging | log/slog (Go 1.21+) | 낮음 |

### 1.5 인증/세션 모델 (Go 측에서 동등성 유지 필수)

- `app/services/auth` 및 `app/crud/crud_refresh_token.py` 가 access/refresh JWT를 발급.
- refresh 토큰은 DB(`refresh_tokens` 테이블 추정)에 저장 → **Python·Go 양쪽이 같은 테이블을 읽고 같은 시크릿으로 서명**해야 토큰 상호 호환.
- bcrypt 패스워드 해시: passlib 형식(`$2b$...`)은 Go bcrypt 라이브러리에서 그대로 검증 가능 ✅

---

## 2. Strangler Fig 아키텍처

```
                ┌─────────────────────────────────────────┐
                │     Nginx / Reverse Proxy (앞단)         │
                │  location 매칭으로 upstream 라우팅       │
                └───────────────┬──────────────┬──────────┘
                                │              │
              upstream go-api   │              │  upstream python-api
                                ▼              ▼
                ┌────────────────────┐  ┌────────────────────────┐
                │ Go 서비스(신규)     │  │ Python(app.main,        │
                │  - Gin             │  │   app_v2.main)          │
                │  - GORM            │  │  - FastAPI              │
                │  - asynq worker    │  │  - APScheduler (당분간)  │
                │  - asynq scheduler │  │                         │
                └─────────┬──────────┘  └─────────┬───────────────┘
                          │                       │
                          └─────────┬─────────────┘
                                    ▼
                          ┌────────────────────┐
                          │   MySQL (공유)      │
                          │   Redis (공유)      │
                          │   Storage (공유 볼륨)│
                          └────────────────────┘
```

### 핵심 원칙
1. **DB는 단일 소스 오브 트루스**. 두 스택이 동시에 같은 테이블 읽기/쓰기.
2. **상태 충돌 방지**: 같은 도메인에 대해 두 스택이 동시에 *쓰기*를 하지 않도록 라우팅 단위로 owner 명확화. 한 prefix는 한 스택만 소유.
3. **APScheduler 잡은 한 곳에서만 동작**. Python → asynq 이관까지는 `SMAP_DISABLE_SCHEDULER` 환경변수로 단일 워커에서만 실행 (현재 패턴 유지).
4. **롤백 우선**: 매 단계마다 Nginx upstream 한 줄로 트래픽 회귀 가능해야 함.

---

## 3. 단계별 로드맵 (Phase)

### Phase 0 — 사전 정비 (예상 1~2일)
**목표**: 마이그레이션이 안전하게 시작될 수 있는 측정 가능 상태 확보.
- [ ] Nginx 라우팅 설정 파일 위치/형식 확인 및 문서화 (§13.1)
- [ ] 현재 워커별 P50/P95 지연, 메모리 사용량, CPU 사용량 베이스라인 측정 (성능 비교 기준)
- [ ] DB 연결 풀 헤더(`/health/db-pool`)에 Go 워커 추가될 것 대비 풀 사이즈 정책 재검토
- [ ] APScheduler 잡 5종의 실행 빈도/락 전략 문서화 (이중 실행 방지)
- [ ] `app_v2/` 디렉토리의 현재 역할/엔드포인트 인벤토리 — 이미 v2로 분리된 라우트는 v2 기준으로 마이그레이션
- [ ] JWT 시크릿/refresh 테이블 스키마 캡처 (양 스택 공유 검증)
- **산출물**: `docs/migration/baseline.md`, Nginx 라우팅 다이어그램

### Phase 1 — Go 프로젝트 부트스트랩 (예상 2~3일)
**목표**: 빈 껍데기지만 운영 가능한 Go 서비스.
- [ ] `backend-go/` 디렉토리 생성 (§7 구조 기준)
- [ ] Gin + GORM + go-redis + zap/slog + viper 셋업
- [ ] `/health`, `/health/db-pool` 엔드포인트 (Python과 응답 스키마 동일)
- [ ] MySQL 연결 (read-only 모드로 먼저 검증)
- [ ] Redis 연결
- [ ] Dockerfile + PM2 또는 systemd unit (단일 바이너리 실행)
- [ ] Nginx에서 `/health/go-*` 같은 임시 prefix로 라우팅, 1주일간 트래픽 없이 안정성 관찰
- **산출물**: `backend-go/` 스켈레톤, 첫 컨테이너 이미지

### Phase 2 — Read-Only 핫패스 이전 (예상 1~2주)
**목표**: 위험 낮은 GET 위주 엔드포인트를 Go로 이관해 성능 효과 검증.
- 우선 후보(읽기 위주, 사이드이펙트 적음):
  - [ ] `/app` (app_version) — 단순 조회, 가장 안전 ★ **첫 PoC 추천**
  - [ ] `/health/*`
  - [ ] `/weather` — 외부 API 캐싱 비중 큼, Go 성능 효과 큼
  - [ ] `/notices` (목록/조회 GET)
  - [ ] `/admin` 통계 read 부분
- 각 prefix마다:
  1. Go 구현
  2. **shadow traffic 비교 도구** — Python/Go 동일 요청 후 응답 diff (선택)
  3. Nginx에서 트래픽 점진 이전 (canary 10% → 50% → 100%)
  4. 1주 안정성 확인 후 다음 prefix
- **검증 기준**: 응답 스키마 100% 동일, P95 지연 동등 이하, 5xx 비율 ≤ Python 기준

### Phase 3 — 알림/배치 워커 이전 (예상 2~3주)
**목표**: APScheduler + 알림 디스패처를 asynq로 이전 — 가장 큰 성능 이득 영역.
- [ ] asynq 서버 구성 (Go), Python 측은 enqueue만 하던 코드를 asynq 호환 enqueue 로 전환 (또는 Python 측이 직접 큐에 push 하도록 asynq Python 클라이언트가 없으니 **Go 쪽이 cron 트리거 + enqueue + worker 통합**으로 가는 게 단순)
- [ ] APScheduler 5개 잡을 asynq cron 또는 robfig/cron 으로 1:1 이식 (`auth_jobs`, `daily_jobs`, `location_alerts`, `location_sync`, `push_jobs`)
- [ ] **이중 실행 방지**: Phase 3 시작과 동시에 Python `scheduler.start()` 비활성화 (`SMAP_SCHEDULER_DISABLED=1`)
- [ ] FCM 발송 경로 (`firebase_service.py` + `notifications/dispatcher.py`)를 Go로 이식
  - Firebase Admin Go SDK 사용
  - 배치 발송(`send_each_for_multicast`) 동등 구현
- [ ] 이메일/SMS 어댑터 이식
- **검증 기준**: 잡 실행 누락 0건, 발송 성공률 동등, 전송 지연 동등 이하

### Phase 4 — 도메인 라우트 이전 (예상 4~6주)
**목표**: 비즈니스 API의 대부분을 Go로 이전.
- 권장 순서 (의존성 적은 것부터 → 결합 많은 것 마지막):
  1. `/groups`, `/group-details`, `/group-members` (그룹 도메인)
  2. `/members`, `/users`
  3. `/auth` — **신중**: Python/Go가 같은 JWT 시크릿·refresh 테이블 공유 검증 후 진행
  4. `/locations`, `/logs`, `/member-location-logs` — 쓰기 빈도 매우 높음, 성능 효과 큼
  5. `/schedules`, `/schedule` (group_schedule_manage) — 비즈니스 룰 복잡, 동등성 테스트 필수
  6. `/push-logs`, `/push-fcms`, `/fcm-token`, `/member-fcm-token`, `/fcm_sendone`
  7. `/orders`, `/sms`, `/notices`
  8. `/hwgi`, `/log-management`, `/admin`
- **각 라우트 이전 체크리스트** (§10 참조)

### Phase 5 — 채팅/WebSocket + 잔여 처리 (예상 2~4주)
**목표**: 가장 위험한 영역 마지막. 결과에 따라 Python 잔존 가능성도 열어둠.
- [ ] `/chats` REST API → Go
- [ ] `/ws` Socket.IO 처리 — **3가지 옵션 평가** (§9.3)
  1. googollee/go-socket.io 사용 (v4 호환성 검증 필수)
  2. 채팅만 Python에 남기고 나머지 모두 Go (Strangler 잔존)
  3. 클라이언트와 협의해 순수 WebSocket(JSON 메시지)로 프로토콜 단순화
- [ ] Python 프로세스 단계적 종료, `app_v2` 디렉토리 정리
- [ ] 정적 파일/이미지 서빙은 Nginx 직접 또는 Go embed
- [ ] Alembic → golang-migrate 또는 Atlas로 마이그레이션 이관

### Phase 6 — 정리 (예상 1주)
- [ ] Python 코드 아카이브 (`.archive/python-legacy/`)
- [ ] CI/CD 파이프라인을 Go 빌드 기준으로 단순화
- [ ] requirements.txt 제거, Dockerfile 단일화
- [ ] 운영 문서 갱신

---

## 4. 도메인 우선순위 매트릭스

| 라우트 | 트래픽 | 쓰기 비율 | 복잡도 | 외부의존 | Phase | 비고 |
|--------|--------|-----------|--------|----------|-------|------|
| `/health` | 높음 | 0 | 매우 낮음 | 없음 | 1 | 부트스트랩 |
| `/app` | 중간 | 0 | 매우 낮음 | 없음 | 2 | ★ PoC 후보 |
| `/weather` | 높음 | 0 | 낮음 | 외부 API | 2 | Go 캐싱 효과 큼 |
| `/notices` | 중간 | 낮음 | 낮음 | 없음 | 2 | |
| `/admin` (read) | 낮음 | 0 | 중간 | 없음 | 2 | |
| **알림 워커** (asynq) | — | 매우 높음 | 높음 | FCM, Redis | 3 | 가장 큰 성능 이득 |
| `/groups`, `/group-*` | 높음 | 중간 | 중간 | 없음 | 4 | |
| `/members`, `/users` | 높음 | 중간 | 중간 | 없음 | 4 | |
| `/auth` | 매우 높음 | 높음 | 높음 | bcrypt, JWT | 4 | 토큰 호환성 사전 검증 필수 |
| `/locations`, `/logs` | **매우 높음** | **매우 높음** | 중간 | 없음 | 4 | 성능 효과 큼 |
| `/schedules`, `/schedule` | 높음 | 중간 | **매우 높음** | 알림 트리거 | 4 | 동등성 테스트 필수 |
| `/push-*`, `/fcm-*` | 높음 | 중간 | 중간 | FCM | 4 | Phase 3 이후 |
| `/orders`, `/sms`, `/notices` (CUD) | 낮음 | 중간 | 낮음 | SMS API | 4 | |
| `/hwgi`, `/log-management` | 낮음 | 중간 | 중간 | 파일 I/O | 4 | |
| `/chats` (REST) | 중간 | 높음 | 높음 | DB | 5 | 채팅 도메인 |
| `/ws` (Socket.IO) | 높음 | 높음 | **매우 높음** | 프로토콜 | 5 | **잔존 가능성** |

---

## 5. 기술 매핑 상세 (선정 근거)

### 5.1 Gin
- Echo/Chi 대비 학습 자료 가장 풍부, 미들웨어 생태계 성숙
- FastAPI의 의존성 주입 패턴과 가장 유사한 미들웨어 체인
- 단점: 기본 panic recovery가 단순 → 커스텀 recovery + 구조화 로깅 필요

### 5.2 GORM v2
- SQLAlchemy와 가장 유사한 API → 모델 1:1 이식 부담 적음
- 단, **N+1 회피** 패턴이 SQLAlchemy의 `selectinload`와 다르므로 (`Preload`) 코드 리뷰 시 주의
- **raw SQL 사용 빈도가 높은 경우 sqlx/sqlc 혼용** 권장 — 통계 쿼리, 복잡 JOIN 등은 sqlc로 컴파일 타임 검증 가능

### 5.3 asynq
- Redis 기반 분산 작업 큐 + 내장 cron 스케줄러
- APScheduler의 `jobstore` 개념과 유사하게 Redis에 잡 상태 저장
- Web UI(`asynqmon`) 제공 — 운영 가시성 우수
- 단점: Python 측에서 asynq 큐에 직접 push 어려움 → **Phase 3에서 Python의 잡 트리거를 Go로 이관 필수**

### 5.4 firebase-admin-go v4
- Python firebase-admin과 기능 동등 (`SendEachForMulticast`, dry-run, batch 500개 제한 동일)
- 서비스 계정 JSON은 공유 가능

### 5.5 결정 보류
- **OpenAPI 문서화**: swaggo/swag (코드 주석 기반) vs 수동 spec — Phase 1에서 결정
- **에러 응답 포맷 표준화**: 현재 Python 응답 포맷 캡처 후 Go에서 동일 wrapper 정의

---

## 6. Go 프로젝트 구조 (제안)

```
backend-go/
├── cmd/
│   ├── api/          # HTTP 서버 진입점
│   │   └── main.go
│   ├── worker/       # asynq worker 진입점
│   │   └── main.go
│   └── scheduler/    # asynq cron 트리거 (혹은 worker에 통합)
│       └── main.go
├── internal/
│   ├── config/       # viper 기반 설정 로드
│   ├── server/       # gin 엔진 구성, 미들웨어
│   ├── middleware/   # auth, cors, logging, recovery
│   ├── handler/      # HTTP 핸들러 (라우트별 파일)
│   │   ├── auth.go
│   │   ├── group.go
│   │   ├── member.go
│   │   └── ...
│   ├── service/      # 비즈니스 로직
│   │   ├── auth.go
│   │   ├── group.go
│   │   ├── notification/
│   │   │   ├── catalog.go
│   │   │   ├── composer.go
│   │   │   └── dispatcher.go
│   │   └── ...
│   ├── repository/   # GORM/sqlx 데이터 접근
│   │   ├── group.go
│   │   ├── member.go
│   │   └── ...
│   ├── model/        # GORM 모델 (Python ORM과 1:1)
│   ├── dto/          # 요청/응답 구조체
│   ├── job/          # asynq 잡 정의
│   │   ├── daily.go
│   │   ├── location_alert.go
│   │   └── push.go
│   ├── client/       # 외부 의존 (FCM, OpenAI, SMS)
│   │   ├── fcm.go
│   │   ├── openai.go
│   │   └── sms.go
│   └── pkg/          # 공용 유틸 (errors, validator, crypto)
├── migrations/       # golang-migrate sql 파일 (Alembic과 분리)
├── deploy/
│   ├── Dockerfile
│   └── ecosystem.go.config.js  # PM2 통합 운영
├── go.mod
├── go.sum
└── README.md
```

**원칙**:
- handler → service → repository 단방향 의존
- DTO/Model 분리 (외부 노출 ≠ DB 모델)
- 외부 의존은 인터페이스 + 구현 분리 (테스트 가능)

---

## 7. 공유 리소스 전략

### 7.1 MySQL
- **풀 분리**: Python(현재 풀) + Go(별도 풀) → 총 커넥션이 MySQL `max_connections` 한도 안에 들도록 풀 사이즈 재배분 필요
  - 예: 현재 Python `pool_size=20, max_overflow=10` × 2 워커 = 60 → Go 추가 시 Python 측 축소
- **쓰기 owner는 한 쪽만**: 한 prefix는 한 스택만 owner. 동시 쓰기 금지 (Phase 별 컷오버 시점에 명확히)
- **트랜잭션 격리**: GORM 기본 격리수준은 MySQL `REPEATABLE READ` — Python과 동일하므로 동작 차이 없음

### 7.2 Redis
- **DB 번호 분리 권장**: Python 캐시 키와 충돌 방지 위해 `redis_db: 0` (Python) / `redis_db: 1` (Go) 또는 키 prefix 분리
- **asynq 전용 DB**: asynq는 키 구조를 통째로 사용하므로 **별도 Redis DB 또는 별도 인스턴스** 권장

### 7.3 정적 파일
- 업로드 디렉토리(`/data/wwwroot/smap_next/backend/storage/uploads`)는 양 스택이 같은 볼륨 마운트
- 서빙은 Nginx 직접 또는 Go static handler — Phase 5에서 통합

### 7.4 환경변수/시크릿
- 현재 `.env` 파일을 Go도 동일하게 로드 (viper의 `automaticEnv` + `envconfig`)
- **JWT 시크릿/Firebase 서비스 계정/DB 비밀번호** 동일 값 사용 — 분리하지 않음

---

## 8. API 계약 호환성 전략

### 8.1 응답 스키마
- **현재 Python 응답을 ground truth로 고정**. 모든 Go 핸들러는 동일한 JSON 키/타입/null 정책을 유지
- 자동화 도구: Python OpenAPI spec(`/api/v1/openapi.json`) 다운로드 → Go 측에서 schema diff 테스트 도구로 매 PR마다 검증
- 예: `pyo3-schema-compare` 또는 자체 스크립트 (Python pydantic schema vs Go struct tags)

### 8.2 에러 응답
- Python의 `HTTPException(status_code, detail)` → Go에서 동일 포맷 wrapper
- 400/401/403/404/422/500 매핑표 작성 후 Phase 1 산출물로 코드화

### 8.3 헤더/CORS
- `CORSMiddleware` 동일 origin 허용 정책 Gin `cors.Default()`에 이식
- `X-Request-ID`, `X-Forwarded-Proto` 등 헤더 처리 동일

### 8.4 OpenAPI
- swaggo/swag 도입 또는 Python 측 spec 그대로 노출 후 path만 변경
- 클라이언트 SDK 자동 생성이 있다면 양 스택의 spec 일치 검증 필수

---

## 9. 위험 영역 상세 분석

### 9.1 인증(`/auth`)
- **bcrypt 호환성**: passlib `$2b$` 해시는 Go bcrypt에서 검증 ok. ✅
- **JWT 호환성**: HS256 + 동일 시크릿 → 양방향 검증 ok. ✅
- **Refresh 토큰 회전 정책**: `crud_refresh_token.py` 확인 후 Go 측 동등 구현 — Phase 4 진입 전 별도 테스트 케이스 작성
- **OAuth (구글/카카오 등)**: 사용 여부 확인 필요 (§13.2)

### 9.2 APScheduler
- 현재 `app.main` 워커에서만 `scheduler.start()` (다른 워커는 `SCHEDULER_DISABLED`)
- Phase 3 컷오버 시:
  1. Go asynq 스케줄러 배포 (잡 등록만, enqueue 비활성)
  2. Python `SMAP_SCHEDULER_DISABLED=1` 설정 + 재시작
  3. Go asynq enqueue 활성화
  → **둘 다 끄는 상태가 단 1초도 없도록 순서 엄수**

### 9.3 Socket.IO (`/ws`)
- googollee/go-socket.io는 Socket.IO v4 일부 기능 미지원
- **3가지 옵션**:
  1. **Go 이식 + v4 호환성 PoC** (2주 risk) — 가능하면 통합 운영
  2. **채팅만 Python 잔존** — Strangler의 "다 못 죽이는" 케이스. 운영 부담 ↑, 그러나 안전
  3. **클라이언트 협의로 순수 WebSocket으로 단순화** — 앱 릴리스 필요. 장기적으로 가장 깔끔
- **Phase 5 진입 전 별도 결정 게이트** 둘 것

### 9.4 OpenAI 스트리밍
- `ai_message_service.py`가 OpenAI 호출. 스트리밍 사용 여부 확인 필요 — 사용 시 Go에서 SSE 응답 처리 검증 필요

### 9.5 이미지 처리 (Pillow)
- Pillow 기능 중 실제 사용 범위(리사이즈만? EXIF 처리? OCR?) 확인 후 Go 라이브러리 선정
- 사용 범위가 크면 별도 image-service로 분리 고려

---

## 10. 라우트 이전 체크리스트 (Phase 4 각 prefix마다)

```
[ ] 1. Python 라우트 인벤토리 (메서드, 입출력, 인증 정책, 사이드이펙트)
[ ] 2. 응답 스키마 캡처 (실제 응답 JSON 샘플 3종 이상)
[ ] 3. Go 모델/DTO/핸들러/서비스/리포지토리 구현
[ ] 4. 동등성 테스트
       - 동일 요청 → 응답 diff (httpbin-style)
       - 동일 DB state 변경 검증
[ ] 5. 로그/메트릭 동등 레벨로 출력
[ ] 6. Canary 라우팅 (10% → 50% → 100%, 각 24h 관찰)
[ ] 7. 5xx 비율, P95 지연, 비즈니스 메트릭(예: 알림 발송 성공률) 비교
[ ] 8. 1주 안정 후 Python 측 라우트 비활성화 (코드는 일단 유지, 다음 단계에서 제거)
[ ] 9. 다음 prefix로 진행
```

---

## 11. 검증 전략

### 11.1 단위 테스트
- Go 측: `testing` + testify
- 커버리지 목표: handler 70%+, service 80%+, repository 60%+

### 11.2 통합 테스트
- testcontainers-go 로 MySQL/Redis 실 컨테이너 띄워 테스트
- Phase 별로 핵심 시나리오 5~10개 자동화

### 11.3 동등성 테스트 (가장 중요)
- 별도 도구(`shadow-diff/`) 작성:
  - 같은 요청을 Python:9000 / Go:9100 동시 전송 → 응답 diff
  - DB state 변경은 트랜잭션 롤백 모드로 비교
- Phase 2부터 운영 — CI에 포함

### 11.4 부하 테스트
- k6 또는 vegeta로 라우트별 부하 테스트
- 베이스라인(Python) vs Go: P50/P95/P99/RPS/에러율 비교
- **합격 기준**: P95 동등 이하, RPS 1.5배 이상, 메모리 1/2 이하 (목표치)

### 11.5 운영 모니터링
- Prometheus + Grafana (현재 미사용 시 도입 권장 — §13.4)
- 또는 최소한 Go 측 `/metrics` 노출 + 수동 관찰

---

## 12. 롤백 시나리오

| 상황 | 조치 | 영향 |
|------|------|------|
| Canary 단계 에러율 ↑ | Nginx upstream 비중 0%로 즉시 회귀 | 무중단 |
| 100% 컷오버 후 장애 | Nginx upstream Python으로 전체 회귀 | 무중단 |
| DB 스키마 불일치 발견 | Python으로 회귀 + Phase 검증 강화 후 재시도 | 무중단 |
| Phase 3 잡 누락 발견 | Python `SCHEDULER_DISABLED` 해제 + Go 잡 비활성 | 잡 1회 중복 가능, 멱등성 검증 필요 |
| Phase 5 Socket.IO 호환성 실패 | 채팅만 Python 잔존 (옵션 2) | 운영 복잡도 ↑ |

---

## 13. 결정사항 (v2 확정)

### 13.1 운영 환경 — ✅ 확정

| 항목 | 결정 |
|------|------|
| Nginx 설정 경로 | `/etc/nginx/sites-enabled/` (Ubuntu nginx 1.24.0) |
| 현재 라우팅 | `api2.smap.site` → unix `/tmp/smap_fastapi.sock` (v2, 스케줄러 OFF) · `api3.smap.site` → `127.0.0.1:9000` (v1, 스케줄러 ON) |
| **Go 신규 도메인** | **`api4.smap.site`** (sites-available에 슬롯 존재, enabled만 활성화 시 즉시 사용 가능) |
| 호스트 | 단일 호스트 |
| CI/CD | 별도 파이프라인 없음, PM2 직접 운영 → Go도 동일 패턴 |

### 13.2 인증 세부 정책 — ✅ 확정 (Go 이식 시 100% 동등 유지)

| 항목 | 정책 |
|------|------|
| 일반 로그인 | bcrypt(`$2b$`) + JWT HS256 (시크릿 공유) |
| 카카오 로그인 | `/auth/kakao-login`, `mt_kakao_id` 매핑 |
| 구글 로그인 | `/auth/google-login` |
| 전화번호 로그인 | `PhoneUserDataRequest` 기반 |
| Refresh 토큰 | 30일, SHA-256 해시 저장, chain_id rotation, reuse 감지 시 체인 전체 revoke |
| 비밀번호 리셋 | 전화번호 인증 기반 토큰 |

Go 이식 시 추가 클라이언트: `internal/client/{kakao,google}.go`

### 13.3 Pillow 사용 — ✅ 사용 안 함

`requirements.txt`에는 있지만 코드에서 `from PIL` import 0건. **Go 측 이미지 라이브러리 의존성 제외**.

### 13.4 모니터링 — ✅ 단계적 도입

| Phase | 조치 |
|-------|------|
| Phase 1 | Go `/metrics` (Prometheus 형식) 엔드포인트만 노출. 수집기는 없음. |
| Phase 2~ | 데이터 누적 후 필요 시 Prometheus + Grafana 검토. 단기 운영은 `pm2 monit` + nginx 로그로 시작. |

### 13.5 일정 제약 — ✅ 기본 가정 유지

deadline 미지정 → §14 추정(12~18주) 그대로. 추후 명시 시 Phase 병렬화로 단축.

### 13.6 `app_v2/` 처리 — ✅ v1/v2 통합 이식

`app_v2/main.py`는 14줄 래퍼로 `from app.main import app` + `SMAP_DISABLE_SCHEDULER=1`만 설정. v1과 코드 동일.

→ **Go에서 동일 패턴 재현**:
- `cmd/api/main.go` — 스케줄러 비활성 (현 `app_v2` 역할, `api4.smap.site` 노출용)
- `cmd/worker/main.go` — asynq 워커 (Phase 3 이후 활성)
- `cmd/scheduler/main.go` — asynq cron 트리거 (Phase 3 이후 활성)

단일 코드베이스, 진입점만 분리.

---

## 14. 일정 추정 (참고)

| Phase | 작업 | 기간 (1인 풀타임 기준) |
|-------|------|---------------------|
| 0 | 사전 정비 | 1~2일 |
| 1 | Go 부트스트랩 | 2~3일 |
| 2 | Read-only 이전 (5개 prefix) | 1~2주 |
| 3 | 알림/배치 이전 | 2~3주 |
| 4 | 도메인 라우트 이전 (15+ prefix) | 4~6주 |
| 5 | 채팅/WebSocket + 잔여 | 2~4주 |
| 6 | 정리 | 1주 |
| **합계** | | **약 12~18주 (3~4.5개월)** |

> 위 추정은 **기능 동등 이식만** 가정. 리팩토링/신규 기능 추가/스키마 변경 없음 전제.  
> 다인 작업 또는 Phase 병렬화 시 단축 가능 (예: Phase 3과 Phase 4 일부 동시 진행).

---

## 15. 다음 액션 (v2 — 즉시 착수 가능)

§13 결정사항이 모두 확정되었으므로 **Phase 1 즉시 착수 가능**한 상태입니다.

### Phase 1 착수 시 첫 세션에서 만들 것

```
backend-go/
├── go.mod                              # module: github.com/smap/backend-go
├── cmd/
│   └── api/
│       └── main.go                     # gin 서버 진입점, /health 만 노출
├── internal/
│   ├── config/
│   │   └── config.go                   # viper 기반, .env 로드
│   ├── server/
│   │   └── server.go                   # gin 엔진 구성
│   ├── middleware/
│   │   ├── logger.go                   # slog 기반 액세스 로그
│   │   ├── recovery.go                 # panic recovery + 구조화 로그
│   │   └── cors.go                     # Python과 동일 CORS 정책
│   ├── handler/
│   │   └── health.go                   # /health, /health/db-pool, /metrics
│   ├── db/
│   │   └── mysql.go                    # GORM MySQL 연결 (read-only 모드)
│   ├── cache/
│   │   └── redis.go                    # go-redis/v9 클라이언트
│   └── observability/
│       └── metrics.go                  # Prometheus 호환 /metrics
├── deploy/
│   ├── Dockerfile
│   └── ecosystem.go.config.js          # PM2 통합 (smap-api-go 추가)
└── README.md
```

### Phase 1 검증 기준

- [ ] `go build ./...` 무에러
- [ ] 별도 포트(예: `127.0.0.1:9100`)로 기동 → `curl http://127.0.0.1:9100/health` 200 OK
- [ ] DB/Redis 연결 헬스체크 통과
- [ ] Python `/health/db-pool` 응답 스키마와 100% 동일 JSON 확인
- [ ] Nginx `api4.smap.site` 활성화 후 `curl https://api4.smap.site/health` 200 OK
- [ ] 1시간 idle 안정성 (메모리 누수, panic 없음)

### Phase 1 비목표 (다음 Phase로 미룸)

- 비즈니스 라우트 (Phase 2)
- Auth 미들웨어 (Phase 4)
- asynq worker (Phase 3)
- Socket.IO (Phase 5)

### 환경 확인 결과 (v3 추가)

| 항목 | 확인 결과 | 적용 |
|------|-----------|------|
| Go 컴파일러 | `/data/wwwroot/.tools/go1.26.2/bin/go` **이미 설치됨** (PATH에는 없음) | 명시적 경로로 호출, 추가 설치 불필요 |
| Go 버전 | **1.26.2** | go.mod에 `go 1.26` 명시 |
| 기존 Go 프로젝트 | `/data/wwwroot/smap_go/` (코인 트레이딩 전용, module: `github.com/bluemusk/smap_go`) | 컨벤션 차용, 코드 침범 없음 |
| 새 Go 프로젝트 위치 | `/data/wwwroot/smap_next/backend-go/` | smap_next 하위로 분리 |
| **모듈 경로** | `github.com/bluemusk/smap_next_go` | 기존 컨벤션(bluemusk) 일치 |
| **포트** | 9100 점유(coin-backend), 9000 점유(smap-api3) → **9200** 사용 | `127.0.0.1:9200` |
| Nginx 도메인 | `api4.smap.site` sites-available에 슬롯 존재 (enabled 안 됨) | Phase 1 종료 시점에 activate (운영 영향, 사용자 승인) |
| PM2 앱 이름 | 기존 `smap-go-*` 패턴 존재 | `smap-api-go`로 추가 (운영 영향, 사용자 승인) |
| 운영 적용 절차 | 코드 작성 → 로컬 빌드/검증 → 사용자 보고 → PM2 등록 → Nginx 활성화 |

### Phase 1 진입 즉시 작업 큐 (#1 ~ #8)

내부 TaskList로 추적. 사용자에게는 단계별 결과 요약 보고.

---

## 부록 A. 참고 자료 링크 (작성자가 직접 확인하지 않은 자료는 제외)

- Strangler Fig Pattern — Martin Fowler 원문 (개념 참조)
- GORM 공식 가이드 — MySQL 사용 시 connection pool 설정
- asynq 공식 문서 — cron + retry 정책
- Firebase Admin Go SDK — MulticastMessage / SendEach
- golang-jwt v5 — HS256 호환성

> ⚠️ 위 라이브러리들의 **현재 메이저 버전과 호환성 보장**은 Phase 0에서 context7 또는 공식 문서로 재확인 필요. 이 설계서의 버전 표기는 2026-05-27 기준 가정.
