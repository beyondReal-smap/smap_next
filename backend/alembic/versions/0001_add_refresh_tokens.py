"""add refresh_tokens table

Revision ID: 0001_refresh_tokens
Revises:
Create Date: 2026-04-14 19:50:00.000000

기존 backend/migrations/2026-04-14_add_refresh_tokens.sql의 alembic 버전.
prod에 이미 raw SQL로 적용된 환경이라면:
    $ alembic stamp 0001_refresh_tokens
로 적용 표시만 하고 upgrade는 건너뛴다.

깨끗한 환경(스테이징/신규)에서는:
    $ alembic upgrade head
로 직접 생성한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_refresh_tokens"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("mt_idx", sa.Integer, nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("chain_id", sa.String(36), nullable=False),
        sa.Column("issued_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.Column("replaced_by_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.UniqueConstraint("token_hash", name="uq_refresh_token_hash"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_refresh_mt_idx", "refresh_tokens", ["mt_idx"])
    op.create_index("idx_refresh_chain", "refresh_tokens", ["chain_id"])
    op.create_index("idx_refresh_expires", "refresh_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("idx_refresh_expires", table_name="refresh_tokens")
    op.drop_index("idx_refresh_chain", table_name="refresh_tokens")
    op.drop_index("idx_refresh_mt_idx", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
