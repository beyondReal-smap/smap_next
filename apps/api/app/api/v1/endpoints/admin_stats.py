"""
관리자 대시보드 통계 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
import logging

from app.api import deps
from app.db.session import get_db
from app.models.member import Member
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.models.schedule import Schedule
from app.models.location import Location

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats")
def get_admin_stats(user_id: int = Depends(deps.get_required_admin_id), db: Session = Depends(get_db)):
    """
    관리자 대시보드 통계 조회
    - 전체 회원 수
    - 전체 그룹 수
    - 오늘 가입자 수
    """

    try:
        # 전체 회원 수 (활성 회원만: mt_level >= 2)
        total_members = db.query(func.count(Member.mt_idx)).filter(
            Member.mt_level >= 2
        ).scalar() or 0

        # 전체 그룹 수
        total_groups = db.query(func.count(Group.sgt_idx)).scalar() or 0

        # 오늘 가입자 수
        today = date.today()
        today_signups = db.query(func.count(Member.mt_idx)).filter(
            Member.mt_level >= 2,
            func.date(Member.mt_wdate) == today
        ).scalar() or 0

        return {
            "success": True,
            "data": {
                "total_members": total_members,
                "total_groups": total_groups,
                "today_signups": today_signups,
                "pending_inquiries": 0  # 문의 테이블이 없으면 0
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": {
                "total_members": 0,
                "total_groups": 0,
                "today_signups": 0,
                "pending_inquiries": 0
            }
        }


@router.get("/groups")
def get_admin_groups(
    user_id: int = Depends(deps.get_required_admin_id),
    db: Session = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    show_hidden: bool = Query(False)
):
    """
    관리자용 그룹 목록 조회 - 서브쿼리 집계로 N+1 쿼리 해결
    각 그룹의 멤버 수, 일정 수, 장소 수를 1-2개 쿼리로 조회
    """
    from sqlalchemy.orm import aliased
    from sqlalchemy import case, literal_column

    try:
        logger.info(f"[ADMIN_GROUPS] 그룹 목록 조회 시작 - offset: {offset}, limit: {limit}")

        # 서브쿼리 1: 그룹별 활성 멤버 수
        member_count_sq = db.query(
            GroupDetail.sgt_idx,
            func.count(GroupDetail.sgdt_idx).label("member_count")
        ).filter(
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_show == 'Y'
        ).group_by(GroupDetail.sgt_idx).subquery()

        # 서브쿼리 2: 그룹별 활성 멤버의 mt_idx 목록을 활용한 일정/장소 수
        # 활성 멤버의 mt_idx 서브쿼리
        active_member_sq = db.query(
            GroupDetail.sgt_idx,
            GroupDetail.mt_idx
        ).filter(
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_show == 'Y'
        ).subquery()

        # 서브쿼리 3: 그룹별 일정 수 (활성 멤버의 활성 일정)
        schedule_count_sq = db.query(
            active_member_sq.c.sgt_idx,
            func.count(Schedule.sst_idx).label("schedule_count")
        ).join(
            Schedule, Schedule.mt_idx == active_member_sq.c.mt_idx
        ).filter(
            Schedule.sst_show == 'Y'
        ).group_by(active_member_sq.c.sgt_idx).subquery()

        # 서브쿼리 4: 그룹별 장소 수 (활성 멤버의 활성 장소)
        location_count_sq = db.query(
            active_member_sq.c.sgt_idx,
            func.count(Location.slt_idx).label("location_count")
        ).join(
            Location, Location.mt_idx == active_member_sq.c.mt_idx
        ).filter(
            Location.slt_show == 'Y'
        ).group_by(active_member_sq.c.sgt_idx).subquery()

        # 메인 쿼리: 그룹 + 소유자 + 집계 서브쿼리 조인
        query = db.query(
            Group,
            Member.mt_name,
            Member.mt_nickname,
            func.coalesce(member_count_sq.c.member_count, 0).label("member_count"),
            func.coalesce(schedule_count_sq.c.schedule_count, 0).label("schedule_count"),
            func.coalesce(location_count_sq.c.location_count, 0).label("location_count"),
        ).outerjoin(
            Member, Member.mt_idx == Group.mt_idx
        ).outerjoin(
            member_count_sq, member_count_sq.c.sgt_idx == Group.sgt_idx
        ).outerjoin(
            schedule_count_sq, schedule_count_sq.c.sgt_idx == Group.sgt_idx
        ).outerjoin(
            location_count_sq, location_count_sq.c.sgt_idx == Group.sgt_idx
        )

        if not show_hidden:
            query = query.filter(Group.sgt_show == 'Y')

        rows = query.offset(offset).limit(limit).all()

        result = []
        for group, mt_name, mt_nickname, member_count, schedule_count, location_count in rows:
            owner_name = mt_name or mt_nickname or f"사용자 {group.mt_idx}"

            group_data = {
                "sgt_idx": group.sgt_idx,
                "sgt_title": group.sgt_title or "",
                "sgt_memo": group.sgt_memo or "",
                "sgt_code": group.sgt_code or "",
                "sgt_show": group.sgt_show or "Y",
                "mt_idx": group.mt_idx,
                "owner_name": owner_name,
                "member_count": member_count,
                "schedule_count": schedule_count,
                "location_count": location_count,
                "sgt_wdate": group.sgt_wdate.isoformat() if group.sgt_wdate else None,
                "sgt_udate": group.sgt_udate.isoformat() if group.sgt_udate else None
            }
            result.append(group_data)

        logger.info(f"[ADMIN_GROUPS] 그룹 목록 조회 완료 - 결과 수: {len(result)}")

        return result

    except Exception as e:
        logger.error(f"[ADMIN_GROUPS] 그룹 목록 조회 실패: {str(e)}")
        raise
