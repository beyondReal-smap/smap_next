from sqlalchemy import Column, BigInteger, Integer, String, DateTime, Index
from app.models.base import BaseModel


class RefreshToken(BaseModel):
    """
    Refresh token 저장소. raw token은 저장하지 않고 SHA-256 해시만 저장.
    rotation 시 동일 chain_id를 공유하는 새 row를 발급하고 기존 row는 revoked.
    reuse(이미 revoked된 token 재사용) 감지 시 해당 chain_id의 모든 활성 row를 revoke.
    """
    __tablename__ = "refresh_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mt_idx = Column(Integer, nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    chain_id = Column(String(36), nullable=False)
    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by_hash = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    ip_hash = Column(String(64), nullable=True)

    __table_args__ = (
        Index("idx_refresh_mt_idx", "mt_idx"),
        Index("idx_refresh_chain", "chain_id"),
        Index("idx_refresh_expires", "expires_at"),
    )
