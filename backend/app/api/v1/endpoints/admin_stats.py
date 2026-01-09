"""
관리자 대시보드 통계 API
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
import logging

from app.db.session import get_db
from app.models.member import Member
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.models.schedule import Schedule
from app.models.location import Location

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
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
async def get_admin_groups(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1, le=10000),
    show_hidden: bool = Query(False)
):
    """
    관리자용 그룹 목록 조회 - 각 그룹의 멤버 수, 일정 수, 장소 수 포함
    """
    try:
        logger.info(f"[ADMIN_GROUPS] 그룹 목록 조회 시작 - skip: {skip}, limit: {limit}, show_hidden: {show_hidden}")
        
        # 그룹 목록 조회
        if show_hidden:
            groups = db.query(Group).offset(skip).limit(limit).all()
        else:
            groups = db.query(Group).filter(Group.sgt_show == 'Y').offset(skip).limit(limit).all()
        
        logger.info(f"[ADMIN_GROUPS] 조회된 그룹 수: {len(groups)}")
        
        result = []
        for group in groups:
            # 멤버 수 (탈퇴하지 않은 활성 멤버)
            member_count = db.query(func.count(GroupDetail.sgdt_idx)).filter(
                GroupDetail.sgt_idx == group.sgt_idx,
                GroupDetail.sgdt_exit == 'N',
                GroupDetail.sgdt_show == 'Y'
            ).scalar() or 0
            
            # 그룹 멤버 목록 조회 (일정/장소 계산용)
            member_ids = db.query(GroupDetail.mt_idx).filter(
                GroupDetail.sgt_idx == group.sgt_idx,
                GroupDetail.sgdt_exit == 'N',
                GroupDetail.sgdt_show == 'Y'
            ).all()
            member_ids = [m[0] for m in member_ids]
            
            # 일정 수 (그룹 멤버들의 활성 일정)
            schedule_count = 0
            if member_ids:
                schedule_count = db.query(func.count(Schedule.sst_idx)).filter(
                    Schedule.mt_idx.in_(member_ids),
                    Schedule.sst_show == 'Y'
                ).scalar() or 0
            
            # 장소 수 (그룹 멤버들의 활성 장소)
            location_count = 0
            if member_ids:
                location_count = db.query(func.count(Location.slt_idx)).filter(
                    Location.mt_idx.in_(member_ids),
                    Location.slt_show == 'Y'
                ).scalar() or 0
            
            # 그룹 소유자 정보
            owner = db.query(Member).filter(Member.mt_idx == group.mt_idx).first()
            owner_name = owner.mt_name or owner.mt_nickname or f"사용자 {group.mt_idx}" if owner else f"사용자 {group.mt_idx}"
            
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
