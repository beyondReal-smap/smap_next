from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.api import deps
from app import crud, models, schemas
from app.db.session import get_db

router = APIRouter()

@router.get("/daily-counts")
async def get_daily_location_counts(
    group_id: int = Query(..., description="그룹 ID"),
    days: int = Query(14, description="조회할 일수 (기본 14일)"),
    db: Session = Depends(get_db)
):
    """
    그룹의 일별 위치 기록 카운트를 조회합니다.
    """
    try:
        # 실제 데이터베이스에서 조회하는 로직을 구현해야 합니다.
        # 지금은 모의 데이터를 반환합니다.
        
        from datetime import datetime, timedelta
        import random
        
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        # 모의 멤버 데이터
        mock_members = [
            {"member_id": 1186, "member_name": "jin"},
            {"member_id": 1187, "member_name": "sil"}
        ]
        
        # 모의 일별 카운트 데이터 생성
        member_daily_counts = []
        total_daily_counts = []
        
        for member in mock_members:
            daily_counts = []
            for i in range(days):
                current_date = start_date + timedelta(days=i)
                count = random.randint(0, 50) if current_date <= end_date else 0
                daily_counts.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "formatted_date": current_date.strftime("%m.%d"),
                    "count": count
                })
            
            member_daily_counts.append({
                "member_id": member["member_id"],
                "member_name": member["member_name"],
                "daily_counts": daily_counts
            })
        
        # 전체 일별 합계 계산
        for i in range(days):
            current_date = start_date + timedelta(days=i)
            total_count = sum(member["daily_counts"][i]["count"] for member in member_daily_counts)
            if total_count > 0:  # 데이터가 있는 날짜만 포함
                total_daily_counts.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "formatted_date": current_date.strftime("%m.%d"),
                    "count": total_count
                })
        
        return {
            "member_daily_counts": member_daily_counts,
            "total_daily_counts": total_daily_counts,
            "total_days": len(total_daily_counts),
            "total_members": len(member_daily_counts),
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "group_id": group_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일별 위치 카운트 조회 실패: {str(e)}")

@router.get("/member-activity")
async def get_member_activity_by_date(
    group_id: int = Query(..., description="그룹 ID"),
    date: str = Query(..., description="조회 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 그룹 멤버 활동을 조회합니다.
    """
    try:
        # 실제 데이터베이스에서 조회하는 로직을 구현해야 합니다.
        # 지금은 모의 데이터를 반환합니다.
        
        import random
        
        # 모의 멤버 활동 데이터
        mock_activities = [
            {
                "member_id": 1186,
                "member_name": "jin",
                "activity_count": random.randint(10, 100),
                "last_activity_time": f"{date}T15:30:00Z",
                "total_distance": round(random.uniform(0.5, 10.0), 2),
                "active": True
            },
            {
                "member_id": 1187,
                "member_name": "sil", 
                "activity_count": random.randint(5, 80),
                "last_activity_time": f"{date}T14:20:00Z",
                "total_distance": round(random.uniform(0.2, 8.0), 2),
                "active": True
            },
            {
                "member_id": 1188,
                "member_name": "eun",
                "activity_count": 0,
                "last_activity_time": None,
                "total_distance": 0.0,
                "active": False
            }
        ]
        
        active_members = len([m for m in mock_activities if m["active"]])
        
        return {
            "member_activities": mock_activities,
            "date": date,
            "group_id": group_id,
            "total_members": len(mock_activities),
            "active_members": active_members
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"멤버 활동 조회 실패: {str(e)}")

@router.get("/test")
async def test_endpoint():
    """
    API 엔드포인트 테스트용
    """
    return {"status": "ok", "message": "Member location log API is working"} 