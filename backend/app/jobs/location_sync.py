"""
위치 동기화 작업

- 최근 위치 동기화
- 20분 주기 사용자 위치 업데이트 (벌크 쿼리)
- 자정 내부 위치 강제 업데이트
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def run_sync_member_locations_recently(db: Session) -> None:
    """최근 위치 동기화"""
    from app.models.member import Member
    from app.models.member_location_log import MemberLocationLog

    try:
        # 활성화된 모든 회원 가져오기
        members = Member.get_all_active(db)

        for member in members:
            mt_idx = str(member.mt_idx)

            # 회원의 최근 위치 로그 가져오기
            recent_location = MemberLocationLog.get_recent_location(
                db,
                int(mt_idx)
            )

            if recent_location:
                # 위치 정보 업데이트
                member.mt_lat = recent_location.mlt_lat
                member.mt_long = recent_location.mlt_long

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Member locations sync executed successfully")

    except Exception as e:
        logger.exception(f"Error in member locations sync: {e}")
        db.rollback()


def run_update_user_locations_every_20_minutes(db: Session) -> None:
    """사용자 위치 업데이트 (벌크 쿼리)"""
    try:
        db.execute(text("""
            UPDATE member_t m
            JOIN (
                SELECT mll.mt_idx, mll.mlt_lat, mll.mlt_long
                FROM member_location_log_t mll
                INNER JOIN (
                    SELECT mt_idx, MAX(mlt_idx) AS max_idx
                    FROM member_location_log_t
                    GROUP BY mt_idx
                ) latest ON mll.mlt_idx = latest.max_idx AND mll.mt_idx = latest.mt_idx
            ) loc ON m.mt_idx = loc.mt_idx
            SET m.mt_lat = loc.mlt_lat, m.mt_long = loc.mlt_long
            WHERE m.mt_status = 1 AND m.mt_level > 1
        """))
        db.commit()
        logger.info("User locations update executed successfully")

    except Exception as e:
        logger.exception(f"Error in user locations update: {e}")
        db.rollback()


def run_force_update_internal_locations_midnight(db: Session) -> None:
    """자정 내부 위치 강제 업데이트"""
    from app.models.member import Member
    from app.models.member_location_log import MemberLocationLog

    try:
        # 활성화된 모든 회원 가져오기
        members = Member.get_all_active(db)

        for member in members:
            mt_idx = str(member.mt_idx)

            # 회원의 최근 위치 로그 가져오기
            recent_location = MemberLocationLog.get_recent_location(
                db,
                int(mt_idx)
            )

            if recent_location:
                # 위치 정보 강제 업데이트
                member.mt_lat = recent_location.mlt_lat
                member.mt_long = recent_location.mlt_long

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Internal locations force update executed successfully")

    except Exception as e:
        logger.exception(f"Error in internal locations force update: {e}")
        db.rollback()
