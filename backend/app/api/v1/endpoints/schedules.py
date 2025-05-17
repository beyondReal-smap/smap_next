from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/", response_model=List[ScheduleResponse])
def get_schedules(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    일정 목록을 조회합니다.
    """
    schedules = db.query(Schedule).offset(skip).limit(limit).all()
    return schedules

@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 일정을 조회합니다.
    """
    schedule = Schedule.find_by_idx(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@router.get("/member/{member_id}", response_model=List[ScheduleResponse])
def get_member_schedules(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 일정 목록을 조회합니다.
    """
    schedules = Schedule.find_by_member(db, member_id)
    return schedules

@router.get("/group/{group_id}", response_model=List[ScheduleResponse])
def get_group_schedules(
    group_id: int,
    days: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹의 일정 목록을 조회합니다.
    'days' 파라미터가 주어지면 오늘부터 해당 일수까지의 일정을 반환합니다.
    """
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    if days is not None and days > 0:
        start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=days)
    
    schedules = Schedule.find_by_group(db, group_id, start_date=start_date, end_date=end_date)
    return schedules

@router.get("/now/in-members", response_model=List[ScheduleResponse])
def get_now_schedule_in_members(
    db: Session = Depends(deps.get_db)
):
    """
    현재 입장해야 할 멤버의 일정 목록을 조회합니다.
    """
    schedules = Schedule.get_now_schedule_in_members(db)
    return schedules

@router.get("/now/out-members", response_model=List[ScheduleResponse])
def get_now_schedule_out_members(
    db: Session = Depends(deps.get_db)
):
    """
    현재 퇴장해야 할 멤버의 일정 목록을 조회합니다.
    """
    schedules = Schedule.get_now_schedule_out_members(db)
    return schedules

@router.get("/now/push", response_model=List[ScheduleResponse])
def get_now_schedule_push(
    db: Session = Depends(deps.get_db)
):
    """
    현재 푸시 알림을 보내야 할 일정 목록을 조회합니다.
    """
    schedules = Schedule.get_now_schedule_push(db)
    return schedules

@router.get("/before-30min", response_model=List[ScheduleResponse])
def get_schedule_before_30min(
    db: Session = Depends(deps.get_db)
):
    """
    30분 전 일정 목록을 조회합니다.
    """
    schedules = Schedule.get_schedule_before_30min(db)
    return schedules

@router.post("/", response_model=ScheduleResponse)
def create_schedule(
    schedule_in: ScheduleCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 일정을 생성합니다.
    """
    schedule = Schedule(**schedule_in.dict())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    schedule_in: ScheduleUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    일정 정보를 업데이트합니다.
    """
    schedule = Schedule.find_by_idx(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    for field, value in schedule_in.dict(exclude_unset=True).items():
        setattr(schedule, field, value)
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    일정을 삭제합니다.
    """
    schedule = Schedule.find_by_idx(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    return {"message": "Schedule deleted successfully"} 