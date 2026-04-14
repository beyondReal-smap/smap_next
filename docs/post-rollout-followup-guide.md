# Post-rollout Follow-up — 통합 가이드

> 이번 PR로 들어간 신규 파일과, worktree에 진행 중인 작업과 분리해야 하는 한 곳의 수정 내역.

## 본 PR 포함

| 영역 | 파일 | 비고 |
|------|------|------|
| iOS Force Update | `iOS/smap/App/RootView.swift` | App Store URL을 실제 ID(`6480279658`)로 교체. iTunes Lookup API 검증값 |
| Alembic | `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/0001_add_refresh_tokens.py`, `backend/alembic/README.md`, `backend/migrations/README.md` | 신규 — 표준 Alembic 셋업 + 첫 revision |
| Refresh token cron | `backend/app/jobs/auth_jobs.py` | 신규 — `run_purge_expired_refresh_tokens` job 정의 |

## 본 PR에서 stage하지 않은 1개 수정

### `backend/app/core/scheduler.py`

worktree에 대표님 다른 작업이 섞여 있어 안전을 위해 stage하지 않았습니다. 본인 worktree에 합쳐 별도 커밋으로 올려주세요.

#### (a) `_get_job_func` 내부 import에 추가
```python
from app.jobs.auth_jobs import run_purge_expired_refresh_tokens
```

#### (b) `_JOB_REGISTRY.update({...})` 안에 추가
```python
"purge_expired_refresh_tokens": run_purge_expired_refresh_tokens,
```

#### (c) `_schedule_all_jobs` 안에 cron 등록
```python
# 일일 cron 작업 블록(`from apscheduler.triggers.cron import CronTrigger` 아래)에 추가
self.scheduler.add_job(
    self._run_job, CronTrigger(hour=4, minute=0),
    args=['purge_expired_refresh_tokens'],
    id='purge_expired_refresh_tokens', **_cron_opts
)
```

## Alembic 적용 절차

### 신규 환경
```bash
cd backend
alembic upgrade head
```

### prod처럼 raw SQL이 이미 적용된 환경
```bash
cd backend
alembic stamp 0001_refresh_tokens
```

이후 새 마이그레이션은 `alembic revision --autogenerate -m "..."`로 생성하면 됩니다. 자세한 사용은 `backend/alembic/README.md` 참조.

## 검증

```bash
# Alembic 상태 확인
cd backend && alembic current

# 만료 정리 직접 호출 (테스트)
python3 -c "
from app.db.session import SessionLocal
from app.jobs.auth_jobs import run_purge_expired_refresh_tokens
db = SessionLocal()
run_purge_expired_refresh_tokens(db)
db.close()
"
```
