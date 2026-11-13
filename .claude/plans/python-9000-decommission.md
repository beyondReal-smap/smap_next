# Python 9000(smap-api3) 정리 + Go PM2 통합 계획

> 작성: 2026-06-03 · 대상: SMAP 백엔드 Strangler Fig 마무리(잡 컷오버 + Python API 종료)
> 결정: ① Go 운영관리 = **PM2 통합** ② 본 문서는 **계획서**이며 실행은 대표님 확인 하에 진행
> 관련 메모리: `project_py_to_go_migration` · 설계서 `backend/.claude/plans/python-to-go-migration.md`

---

## 1. 현 상태 진단 (2026-06-03 실측)

| 구분 | 현황 | 근거 |
|------|------|------|
| **API 트래픽** | ✅ Go(9200) 100% | `sites-enabled/api3.smap.site` 전 location `proxy_pass 127.0.0.1:9200`. 활성 Nginx에 9000 참조 0 |
| **Go API 관리** | systemd `smap-go-api.service` (active/enabled) | `ExecStart=/data/.../backend-go/bin/api`, env: `REDIS_URL`, `FIREBASE_CREDENTIALS_PATH` |
| **Python API 관리** | PM2 `smap-api3` (id 4, pid 1137) | `uvicorn app.main:app --port 9000`. God Daemon(pid 1113) 자식 |
| 🔴 **백그라운드 잡** | **Python APScheduler 단독 가동 중** | `push_msg.log` 14:59:52 geofence 알림 실행. Python `.env`에 스케줄러 플래그 없음 → 기본 활성 |
| 🔴 **Go 잡 워커/스케줄러** | **빌드만 됨, 미실행** | `bin/worker`·`bin/scheduler` 존재하나 프로세스/서비스 없음. `cmd/scheduler`는 기본 dry 모드 |

### 핵심 결론
- **API는 이미 Go로 완전 컷오버됨** → Python API 프로세스는 트래픽 0, 안전하게 종료 가능
- **잡은 아직 Python이 단독 처리** → Python을 그냥 끄면 **알림 12종 전부 중단**
- 따라서 본 작업의 본질은 "API 종료"가 아니라 **"잡 컷오버"**다. 컷오버 없이 Python을 끄면 장애.

### 의존성 확인 (정리해도 안전한 근거)
- `sms.py`의 `9000` = 난수 코드 생성(`secrets.randbelow(900000)`), **무관** ✅
- `app_v3/main.py`의 `9000` = 주석일 뿐, app_v3는 **미가동** ✅
- `app_v2`(PM2 `smap-api2`, unix socket) = **별개 서비스, 정리 대상 아님** ✅
- Redis는 Python·Go **공유**(캐시 db=0 + asynq 잡큐 db=1 + SMS 인증 interop) → **끊지 말 것** ⚠️

---

## 2. 목표 및 성공 기준

| # | 성공 기준 | 검증 방법 |
|---|-----------|-----------|
| G1 | Go 잡 워커/스케줄러가 PM2로 가동되어 잡 12종을 처리 | Go worker 로그에 잡 실행 + `push_msg.log` 신규 발송 |
| G2 | 컷오버 중 **중복 발송 0건, 누락 최소화** | claim-then-send 멱등 + Python OFF→Go ON 순서 |
| G3 | Go API(9200)가 PM2로 이관, systemd와 충돌 없음 | `pm2 list`에 smap-go-api online, `systemctl is-active smap-go-api`=inactive |
| G4 | Python API(9000) 종료 후 서비스 무영향 | api3.smap.site 200 유지, push 정상 |
| G5 | 즉시 롤백 경로 확보 | Nginx 9000 백업 + PM2 재기동 절차 문서화 |

---

## 3. 실행 계획

### ⚠️ 컷오버 원칙 (cmd/scheduler/main.go 주석 = 권위 기준)
```
1. Go worker + scheduler 배포 (scheduler는 기본 dry — enqueue 안 함)
2. Python 스케줄러 정지  → Python 재기동
3. Go 스케줄러 활성화 (SCHEDULER_ENABLED=true) → scheduler 재기동
```
- **이중 enqueue 절대 금지**(중복 푸시). 잡은 claim-then-send 멱등이라 찰나 중첩은 안전하나, 순서는 **Python OFF 먼저 → Go ON**.
- 변수명 주의: **Python은 `SMAP_DISABLE_SCHEDULER=1`** 로 끈다(app/main.py `_scheduler_disabled()`). Go는 **`SCHEDULER_ENABLED=true`** 로 켠다. (서로 다른 변수)
- config.Load는 `../backend/.env`를 상대경로로 읽음 → PM2 등록 시 **모든 Go 앱 `cwd`=`/data/wwwroot/smap_next/backend-go` 필수**.

---

### Phase A — Go PM2 통합 + 잡 컷오버 〔핵심〕

**A-1. ecosystem 설정 작성** (`backend-go/ecosystem.go.config.js` 신규)
```js
module.exports = {
  apps: [
    {
      name: "smap-go-api",
      cwd: "/data/wwwroot/smap_next/backend-go",
      interpreter: "none",
      script: "/data/wwwroot/smap_next/backend-go/bin/api",
      env: {
        REDIS_URL: "redis://127.0.0.1:6379/0",
        FIREBASE_CREDENTIALS_PATH: "/data/wwwroot/smap_next/backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"
      },
      out_file: "/data/wwwroot/smap_next/backend-go/logs/api-out.log",
      error_file: "/data/wwwroot/smap_next/backend-go/logs/api-error.log",
      max_restarts: 10, restart_delay: 5000, autorestart: true
    },
    {
      name: "smap-go-worker",
      cwd: "/data/wwwroot/smap_next/backend-go",
      interpreter: "none",
      script: "/data/wwwroot/smap_next/backend-go/bin/worker",
      env: {
        REDIS_URL: "redis://127.0.0.1:6379/0",   // 멱등락(db=0). 단일 worker면 미설정도 안전(TryLock nil→true)
        FIREBASE_CREDENTIALS_PATH: "/data/wwwroot/smap_next/backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"
        // ASYNQ_REDIS_ADDR(기본 127.0.0.1:6379)·ASYNQ_REDIS_DB(기본 1)=잡큐, 기본값으로 충분(명시 불필요)
        // KMA_SERVICE_KEY는 cwd=backend-go → ../backend/.env에서 자동 주입(weather:refresh용)
      },
      out_file: ".../logs/worker-out.log", error_file: ".../logs/worker-error.log",
      max_restarts: 10, restart_delay: 5000, autorestart: true
    },
    {
      name: "smap-go-scheduler",
      cwd: "/data/wwwroot/smap_next/backend-go",
      interpreter: "none",
      script: "/data/wwwroot/smap_next/backend-go/bin/scheduler",
      env: {
        REDIS_URL: "redis://127.0.0.1:6379/0",
        SCHEDULER_ENABLED: "false"   // ★ 초기엔 dry. 컷오버 시점에 true로
      },
      out_file: ".../logs/scheduler-out.log", error_file: ".../logs/scheduler-error.log",
      max_restarts: 10, restart_delay: 5000, autorestart: true
    }
  ]
};
```
> ⚠️ worker/scheduler env의 정확한 키는 `internal/config/config.go`로 재확인(AsynqRedisAddr/DB가 별도 키면 추가). FCM 키는 `FIREBASE_CREDENTIALS_PATH`(절대경로) 또는 `FIREBASE_CREDENTIALS_JSON`.

**A-2. Go API를 systemd → PM2로 이관** (포트 9200 충돌 방지: 한쪽만 점유)
```bash
# (a) 최신 바이너리 확인/빌드
cd /data/wwwroot/smap_next/backend-go
/data/wwwroot/.tools/go1.26.2/bin/go build -o ./bin/api ./cmd/api
/data/wwwroot/.tools/go1.26.2/bin/go build -o ./bin/worker ./cmd/worker
/data/wwwroot/.tools/go1.26.2/bin/go build -o ./bin/scheduler ./cmd/scheduler
mkdir -p logs

# (b) systemd 중지 후 PM2 인수 (9200 끊김 수 초 — API는 Nginx가 5xx 잠깐, 무중단 원하면 reload 타이밍 조정)
systemctl disable --now smap-go-api.service
pm2 start ecosystem.go.config.js --only smap-go-api
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9200/health   # 200 기대
```

**A-3. Worker 기동** (큐 컨슈머 — 큐 비어 있어 무동작, 안전)
```bash
pm2 start ecosystem.go.config.js --only smap-go-worker
pm2 logs smap-go-worker --lines 30   # "config loaded", asynq 연결 확인
```

**A-4. Scheduler 등록(dry)** — enqueue 안 함, 동작 무해
```bash
pm2 start ecosystem.go.config.js --only smap-go-scheduler   # SCHEDULER_ENABLED=false
pm2 logs smap-go-scheduler --lines 20   # 스케줄 등록 로그, enqueue 없음 확인
```

**A-5. 잡 컷오버 (Python OFF → Go ON, 순서 엄수)**
```bash
# (1) Python 스케줄러 OFF: ecosystem.config.js의 smap-api3 env에 SMAP_DISABLE_SCHEDULER=1 추가
#     → pm2 restart smap-api3 --update-env  (API는 계속 뜸, 스케줄러만 정지)
# (2) 로그로 Python 잡 정지 확인: push_msg.log 신규 라인 멈춤 / "Scheduler startup skipped"
# (3) Go 스케줄러 ON: scheduler env SCHEDULER_ENABLED=true 로 수정 후
pm2 restart smap-go-scheduler --update-env
```

**A-6. 검증**
```bash
# Go가 잡을 enqueue → worker가 소비하는지
pm2 logs smap-go-worker --lines 50    # geofence/30min 등 처리 로그
tail -f /data/wwwroot/smap_next/backend/push_msg.log   # 신규 발송 누가? (Go 경로)
# 중복 발송 점검: 동일 대상 30초 내 2건 없는지 / push_log_t status 분포
```
- 30초~1분 주기 잡(geofence·30min·reserved)은 1~2틱 내 정상화 확인
- 일일 잡(silent 03:00, weather 06:30/07:00, app 19:30, battery 21:00)은 다음 트리거 시각 모니터링

---

### Phase B — Python API(9000) 종료

| 단계 | 명령 | 비고 |
|------|------|------|
| B-1 | `pm2 stop smap-api3` | **delete 아님** — 즉시 롤백용. 스케줄러는 이미 A-5에서 OFF |
| B-2 | 관찰기간 **1~3일** | api3.smap.site 200 유지, push 정상, 에러로그 무이상 |
| B-3 | `pm2 delete smap-api3` → `pm2 save` | 관찰 통과 후. ecosystem에서 smap-api3 블록 제거 |

> 🔒 `delete`·env파일 수정·`rm`은 **대표님 명시 승인 시 실행**(자율 작업 금지 규칙).

---

### Phase C — 잔존물 정리 (선택, 별도 합의)

- `app_v3/main.py`(미사용 9000 진입점) 처리 방침 결정 — 삭제 아닌 `.archive/` 이동 권장
- `backend/push_msg.log.1~10` 로그 로테이션 정리 (pm2-logrotate 이미 가동 중 — 정책 통일 검토)
- `deploy/smap-go-api.service`(systemd 잔재) 보존/이동 — 롤백 안전망으로 당분간 보존 권장

---

## 4. 롤백 절차 (각 Phase별 즉시 복귀)

| 상황 | 롤백 |
|------|------|
| Go API(PM2) 이상 | `pm2 stop smap-go-api` → `systemctl enable --now smap-go-api.service` (systemd 복귀) |
| 잡 이중/누락 | Go scheduler dry 복귀(`SCHEDULER_ENABLED=false` restart) + Python `SMAP_DISABLE_SCHEDULER` 제거 후 `pm2 restart smap-api3` |
| API 트래픽 장애 | Nginx `api3.smap.site` → `proxy_pass 9000` 백업(`*.bak-*`) 복원 + `nginx -t && reload` + `pm2 start smap-api3` |

---

## 5. 리스크 체크리스트

- [ ] **스케줄러 이중실행** → 중복 푸시 (Python OFF 먼저 / claim-then-send 멱등으로 2차 방어)
- [ ] **잡 공백** → 알림 누락 (주기 잡은 다음 틱 복구, 공백 최소화)
- [ ] **FCM 자격증명** worker/scheduler env 누락 시 실발송 0건 (`FIREBASE_CREDENTIALS_PATH` 필수)
- [ ] **cwd 누락** → `../backend/.env` 못 읽어 config 실패 (PM2 cwd=backend-go 필수)
- [ ] **Redis 공유** 유지 (캐시 db=0 + 잡큐 db=1 + SMS interop) — 끊지 말 것
- [ ] **포트 9200 동시 점유**(systemd+PM2) → systemd disable 먼저
- [ ] **PM2 영속화**: `pm2 save` 후 부팅 자동기동(`pm2-root.service` 기존 존재) 확인

---

## 6. 사전 확인 (실행 전 재검증할 항목)

### ✅ ① asynq Redis 키 — 검증 완료 (config.go 실측)
| 필드 | env 키 | 기본값 | 용도 |
|------|--------|--------|------|
| `AsynqRedisAddr` | `ASYNQ_REDIS_ADDR` | `127.0.0.1:6379` | 잡큐(enqueue/consume) |
| `AsynqRedisDB` | `ASYNQ_REDIS_DB` | `1` | 잡큐 전용 DB (캐시 db=0과 분리) |
| `RedisURL` | `REDIS_URL` | `""` | 캐시 db=0 = **멱등 분산락** |
| `SchedulerEnabled` | `SCHEDULER_ENABLED` | `false` | 컷오버 토글 |
| `FirebaseCredentialsPath` | `FIREBASE_CREDENTIALS_PATH` | (상대 파일명) | **cwd 의존** → 절대경로 명시 필수 |
| `KMAServiceKey` | `KMA_SERVICE_KEY` | (없음) | `.env` 자동 주입(weather:refresh) |

- **결론**: 잡큐 ASYNQ_* 는 기본값(db=1)으로 충분 → **명시 불필요**. worker에 `REDIS_URL`을 넣으면 멱등락 활성, 안 넣어도 `TryLock(nil)→true`라 **단일 worker 인스턴스면 안전**(다중 인스턴스 시에만 REDIS_URL 필수). scheduler는 `SCHEDULER_ENABLED`만 토글하면 됨.

### ✅ ② worker 12종 핸들러 — 검증 완료 (실로직, 스텁 아님)
- `jobs.NewMux`가 **12종 전부 등록**(geofence 4 + schedule:30min + push:reserved + location:sync + daily 3 + weather 2)
- 발송 잡 **실제 FCM 호출 확인**: geofence/schedule/silent/daily=`h.fcm.SendEach`, reserved=`h.fcm.Send`, weather:alert=`sendDailyBatches`(공용 헬퍼 위임). location:sync·weather:refresh=DB UPDATE 실로직(FCM 무관)
- `cmd/worker/main.go`가 `fcm.New(cfg)`로 발송기 배선 + `Available()` 로깅
- ⚠️ **문서 함정**: `tasks.go:3`·`handler.go:21`에 "stub/무발송 단계" 주석이 **골격 시절 잔재**로 남아 있음(실코드·`NewMux` 주석이 반증). 실행팀 오해 방지용으로만 인지 — 코드는 완성됨

### ✅ ④ 타임존 — 검증 완료, **수정 적용 완료 (2026-06-03)**
- 발견: Python `BackgroundScheduler()`(tzlocal=KST) ↔ Go `SchedulerOpts` Location 미지정(UTC) → 일일 cron 5종 9시간 밀림 위험.
- 수정: `cmd/scheduler/main.go`에 `time` import + `time.LoadLocation("Asia/Seoul")` → `SchedulerOpts.Location`에 KST 고정(실패 시 fail-fast `os.Exit(1)`). 주석도 갱신.
- 검증: `go build`/`go vet` exit 0 · dry 모드 12종 등록 정상 · `/usr/share/zoneinfo/Asia/Seoul` 존재 확인(LoadLocation 성공 보장). `bin/scheduler` 재빌드 완료.
- ⚠️ 활성 경로(`SCHEDULER_ENABLED=true`)의 실발화 시각 검증은 **컷오버 시점**에 수행(현재 켜면 Python과 이중 enqueue).

### ⬜ 남은 확인 (실행 직전)
3. Python `SMAP_DISABLE_SCHEDULER` 값 형식(`1`/`true` 등 — `_scheduler_disabled()`는 소문자셋 비교)
