# smap_next_go

SMAP 백엔드의 Go 이식판. Strangler Fig 전략으로 Python(FastAPI) 백엔드를 점진 대체한다.

설계서: `../backend/.claude/plans/python-to-go-migration.md`

## Phase 1 (현 상태)

- HTTP 진입점: `cmd/api`
- 노출 엔드포인트: `/health`, `/health/db-pool`, `/metrics`
- 외부 의존: MySQL (read-only), Redis (옵셔널)
- 비즈니스 라우트 미포함 (Phase 2 이후)

## 빌드/실행

```bash
export GO=/data/wwwroot/.tools/go1.26.2/bin/go
$GO mod tidy
$GO build -o bin/api ./cmd/api
./bin/api
```

환경 변수는 `../backend/.env`를 그대로 읽는다 (Python과 공유).
