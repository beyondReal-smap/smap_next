# Legacy 마이그레이션 (raw SQL)

> 이 디렉토리의 SQL 파일은 **Alembic 도입 이전**의 수동 마이그레이션 history입니다. 이력 보존을 위해 유지하되, **새로운 스키마 변경은 모두 `backend/alembic/`에서 관리**합니다.

## 신규 변경 안내

새 마이그레이션은 다음 가이드를 참고하세요:
👉 [`backend/alembic/README.md`](../alembic/README.md)

## 파일 목록

| 파일 | Alembic 대응 revision |
|------|-----------------------|
| `2026-04-14_add_refresh_tokens.sql` | `0001_refresh_tokens` |
