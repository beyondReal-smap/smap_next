# SMAP 백엔드 Python → Go 마이그레이션 문서

> Strangler Fig 전략으로 FastAPI 백엔드를 Go(Gin+GORM)로 점진 이전.
> 설계서: `../../backend/.claude/plans/python-to-go-migration.md` (확정 v3)
> 인벤토리 작성: 2026-05-30 (워크플로 `py-backend-inventory`, 12 도메인 병렬 분석)

## 진행 상태

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Go 스캐폴딩 (health/db/cache/config/server/middleware) | ✅ 완료 (빌드·vet 통과, `backend-go/`) |
| — | **Python 백엔드 전체 정밀 매핑** | ✅ **완료 (이 문서)** |
| 2 | read-only 핫패스 이전 (`/app` PoC → weather/notices/admin) | ⏭️ 다음 |
| 3 | 배치 잡 12개 + 푸시 발송 (asynq) | 대기 (Redis 인프라 선행) |
| 4 | 도메인 라우트 (auth/member/group/location/schedule/push/misc-write) | 대기 |
| 5 | chat + Socket.IO | 대기 (잔존 가능) |

## 문서 인덱스

| 문서 | 내용 |
|------|------|
| **[inventory.md](inventory.md)** | 🎯 **시작점** — 종합 요약·인프라 동등성·Phase 견적·인프라 갭 |
| [endpoints.md](endpoints.md) | 207개 엔드포인트 전체 매트릭스 (도메인별, method/path/auth/복잡도/이식노트) |
| [models.md](models.md) | 14개 모델↔테이블 매핑 + GORM 노트 + 동시점유 위험 |
| [jobs.md](jobs.md) | 12개 배치 잡 + 스케줄러 + 멱등성 (APScheduler→asynq) |
| [infra.md](infra.md) | JWT/bcrypt/refresh/응답/캐시/설정 동등성 가이드 |
| [security-findings.md](security-findings.md) | 보안 43건 (이식 정책 의사결정 필요) |

## 핵심 수치

- 엔드포인트 **207개** (이식 대상 9도메인 206 + `/health` 1 완료) · 모델 **14** · 잡 **12** · 보안 발견 **43**
- ground truth(215 데코레이터) 교차검증 누락 0건
- 견적: 설계서 12~18주와 일치

## 다음 세션 시작점

**Phase 2 — `GET /app/version-check` PoC** (DB·외부의존 없는 순수 버전 비교 로직, 0.5일).
handler→service→repository 전 계층 Go 표준 패턴 확립 + Python:9000 vs Go:9200 응답 diff 검증.
