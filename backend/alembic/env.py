"""
Alembic 환경 스크립트.
DB 접속 정보는 app.core.config.settings에서 끌어 쓰고, 모델 metadata는
app.models.base.Base.metadata로 통일한다. 새 모델을 추가할 때마다 아래
import 목록에 추가해야 autogenerate에서 인식한다.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.models.base import Base

# 모델 import — Base.metadata에 테이블이 등록되도록 trigger.
# autogenerate 정확도를 위해 새 모델 추가 시 여기에도 import 한 줄 추가할 것.
import app.models.member  # noqa: F401
import app.models.refresh_token  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 시크릿이 alembic.ini에 들어가지 않도록 런타임에 덮어쓴다.
config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """오프라인 모드 — SQL 스크립트만 출력."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드 — DB에 직접 적용."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
