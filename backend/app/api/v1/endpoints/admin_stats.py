"""
관리자 대시보드 통계 API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from app.db.session import get_db
from app.models.member import Member
from app.models.group import Group

router = APIRouter()


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
