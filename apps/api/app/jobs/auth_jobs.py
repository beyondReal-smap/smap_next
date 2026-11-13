"""
인증 관련 백그라운드 작업.

- run_purge_expired_refresh_tokens: 만료된 refresh_tokens 정리.
  정책: 만료 시점으로부터 7일이 더 지난 row만 삭제(감사용 단기 보존).
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken

logger = logging.getLogger(__name__)


def run_purge_expired_refresh_tokens(db: Session) -> None:
    """만료된 refresh token row 삭제. 일 1회 야간에 실행을 권장."""
    threshold = datetime.utcnow() - timedelta(days=7)
    deleted = (
        db.query(RefreshToken)
        .filter(RefreshToken.expires_at < threshold)
        .delete(synchronize_session=False)
    )
    db.commit()
    if deleted:
        logger.info(f"[purge_refresh_tokens] removed {deleted} expired rows (threshold={threshold.isoformat()})")
    else:
        logger.debug("[purge_refresh_tokens] no rows to remove")
