"""
Refresh token CRUD.

설계:
 - raw token(클라이언트가 들고 있는 값)은 `secrets.token_urlsafe(REFRESH_TOKEN_BYTES)`.
 - DB에는 SHA-256 해시만 저장. raw는 발급 시점에만 존재.
 - rotation은 chain_id(UUID) 기준. 새 raw를 발급하고 기존 row는 revoked.
 - reuse(이미 revoked된 raw가 다시 들어옴) 감지 시 같은 chain_id의 활성 토큰을 모두 revoke.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.refresh_token import RefreshToken


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue(
    db: Session,
    mt_idx: int,
    *,
    chain_id: Optional[str] = None,
    user_agent: Optional[str] = None,
    ip_hash: Optional[str] = None,
) -> Tuple[str, str]:
    """
    새 refresh token을 발급하고 저장. (raw, chain_id) 반환.
    chain_id가 None이면 새 체인. 주어지면 rotation 연장.
    """
    raw = secrets.token_urlsafe(settings.REFRESH_TOKEN_BYTES)
    now = datetime.utcnow()
    chain = chain_id or str(uuid.uuid4())
    row = RefreshToken(
        mt_idx=mt_idx,
        token_hash=_hash(raw),
        chain_id=chain,
        issued_at=now,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=(user_agent or "")[:255] or None,
        ip_hash=ip_hash,
    )
    db.add(row)
    db.commit()
    return raw, chain


def rotate(
    db: Session,
    raw_old: str,
    *,
    user_agent: Optional[str] = None,
    ip_hash: Optional[str] = None,
) -> Optional[Tuple[str, int, str]]:
    """
    기존 raw refresh token을 회전.
    성공: (new_raw, mt_idx, chain_id) 반환.
    실패(없음/만료/이미 사용됨): None 반환. reuse 감지 시 체인 전체 revoke.
    """
    old_hash = _hash(raw_old)
    old = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == old_hash)
        .first()
    )
    if old is None:
        return None

    now = datetime.utcnow()

    # REUSE DETECTION — 이미 revoked된 토큰이 재사용되면 체인 전체를 폐기.
    if old.revoked_at is not None:
        db.query(RefreshToken).filter(
            RefreshToken.chain_id == old.chain_id,
            RefreshToken.revoked_at.is_(None),
        ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
        db.commit()
        return None

    if old.expires_at < now:
        return None

    raw_new = secrets.token_urlsafe(settings.REFRESH_TOKEN_BYTES)
    new_hash = _hash(raw_new)

    new_row = RefreshToken(
        mt_idx=old.mt_idx,
        token_hash=new_hash,
        chain_id=old.chain_id,
        issued_at=now,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=(user_agent or "")[:255] or None,
        ip_hash=ip_hash,
    )
    db.add(new_row)
    old.revoked_at = now
    old.replaced_by_hash = new_hash
    db.commit()

    return raw_new, old.mt_idx, old.chain_id


def revoke_by_raw(db: Session, raw_token: str) -> bool:
    """로그아웃 시 특정 raw token을 revoke."""
    h = _hash(raw_token)
    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == h)
        .first()
    )
    if row is None or row.revoked_at is not None:
        return False
    row.revoked_at = datetime.utcnow()
    db.commit()
    return True


def revoke_all_for_member(db: Session, mt_idx: int, *, commit: bool = True) -> int:
    """해당 회원의 모든 활성 refresh token을 revoke. `logout-all` 등에서 사용."""
    now = datetime.utcnow()
    result = db.query(RefreshToken).filter(
        RefreshToken.mt_idx == mt_idx,
        RefreshToken.revoked_at.is_(None),
    ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
    if commit:
        db.commit()
    return int(result or 0)
