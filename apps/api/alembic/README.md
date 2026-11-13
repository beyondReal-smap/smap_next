# Alembic 마이그레이션 가이드

> SMAP 백엔드는 이제 Alembic으로 DB 스키마를 관리합니다. 이전에는 `backend/migrations/*.sql`로 수동 적용했지만, 새 변경은 모두 Alembic을 사용합니다.

## 기본 명령

`backend/` 디렉토리에서 venv 활성화 후:

```bash
# 현재 적용된 revision 확인
alembic current

# 신규 마이그레이션 자동 생성 (모델 변경을 감지)
alembic revision --autogenerate -m "add some_table"

# 비어 있는 마이그레이션 직접 작성
alembic revision -m "manual change"

# 최신까지 적용
alembic upgrade head

# 한 단계 롤백
alembic downgrade -1
```

## 환경변수
`alembic/env.py`는 `app.core.config.settings.SQLALCHEMY_DATABASE_URI`를 사용합니다. `.env`에 `MYSQL_*`/`JWT_SECRET_KEY` 등이 있으면 그대로 동작합니다.

## 기존 prod에 raw SQL이 이미 적용된 경우

`backend/migrations/2026-04-14_add_refresh_tokens.sql`로 이미 테이블을 만들었다면, alembic upgrade를 그대로 실행하면 “테이블이 이미 존재” 오류가 납니다. 다음으로 “적용 표시”만 하세요:

```bash
alembic stamp 0001_refresh_tokens
```

이후 새 마이그레이션부터는 정상적으로 `alembic upgrade head`로 적용됩니다.

## 새 모델 추가 시 체크리스트

1. `backend/app/models/<new>.py` 작성, `Base`(또는 `BaseModel`) 상속.
2. `backend/alembic/env.py`의 `import app.models.<new>` 라인 추가 (autogenerate가 metadata에서 인식).
3. `alembic revision --autogenerate -m "..."` 실행 → `versions/`에 파일 생성.
4. **반드시 생성된 마이그레이션을 직접 검토**. autogenerate는 인덱스/제약/타입을 누락할 수 있습니다.
5. 스테이징에서 `alembic upgrade head` 후 정상 동작 확인 → prod 적용.

## 호환 정책

- `backend/migrations/*.sql`은 **history로 보존**합니다(삭제하지 않음). 향후 모든 변경은 alembic 사용.
- 기존 SQL과 alembic 첫 revision(`0001_refresh_tokens`)은 동일한 스키마를 만듭니다.
