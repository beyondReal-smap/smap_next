from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.api import deps
from app.models.schedule import Schedule
from app.models.member import Member
from app.models.group_detail import GroupDetail
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

@router.get("/group/{group_id}", response_model=List[dict])
def get_group_schedules(
    group_id: int,
    days: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹의 일정 목록을 조회합니다.
    home/page.tsx의 scheduleService.getGroupSchedules()에서 사용
    'days' 파라미터가 주어지면 오늘부터 해당 일수까지의 일정을 반환합니다.
    """
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    if days is not None and days > 0:
        start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=days)
    
    # 그룹에 속한 멤버들의 ID 조회
    group_member_ids = db.query(GroupDetail.mt_idx).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N'
        )
    ).subquery()
    
    # 스케줄 쿼리 구성
    schedule_query = db.query(Schedule).filter(
        or_(
            Schedule.sgt_idx == group_id,  # 그룹 스케줄
            Schedule.mt_idx.in_(group_member_ids)  # 멤버 개인 스케줄
        )
    )
    
    # 날짜 필터 적용
    if start_date and end_date:
        schedule_query = schedule_query.filter(
            and_(
                Schedule.sst_sdate >= start_date,
                Schedule.sst_sdate < end_date
            )
        )
    
    schedules = schedule_query.order_by(Schedule.sst_sdate).all()
    
    # home/page.tsx의 Schedule 타입에 맞게 데이터 변환
    result = []
    for schedule in schedules:
        # 멤버 정보 조회 (mt_schedule_idx 필드 생성용)
        member_id = None
        if schedule.mt_idx:
            member_id = schedule.mt_idx
        
        schedule_data = {
            "id": str(schedule.sst_idx),
            "sst_pidx": schedule.sst_pidx,
            "mt_schedule_idx": member_id,  # home/page.tsx에서 멤버 구분에 사용
            "title": schedule.sst_title,
            "date": schedule.sst_sdate.isoformat() if schedule.sst_sdate else None,
            "sst_edate": schedule.sst_edate.isoformat() if schedule.sst_edate else None,
            "sst_sedate": schedule.sst_sedate.isoformat() if schedule.sst_sedate else None,
            "sst_all_day": schedule.sst_all_day,
            "sst_repeat_json": schedule.sst_repeat_json,
            "sst_repeat_json_v": schedule.sst_repeat_json_v,
            "sgt_idx": schedule.sgt_idx,
            "sgdt_idx": schedule.sgdt_idx,
            "sgdt_idx_t": schedule.sgdt_idx_t,
            "sst_alram": schedule.sst_alram,
            "sst_alram_t": schedule.sst_alram_t,
            "sst_adate": schedule.sst_adate.isoformat() if schedule.sst_adate else None,
            "slt_idx": schedule.slt_idx,
            "slt_idx_t": schedule.slt_idx_t,
            "location": schedule.sst_location_title,  # home/page.tsx에서 location으로 사용
            "sst_location_add": schedule.sst_location_add,
            "sst_location_lat": float(schedule.sst_location_lat) if schedule.sst_location_lat else None,
            "sst_location_long": float(schedule.sst_location_long) if schedule.sst_location_long else None,
            "sst_supplies": schedule.sst_supplies,
            "sst_memo": schedule.sst_memo,
            "sst_show": schedule.sst_show,
            "sst_location_alarm": schedule.sst_location_alarm,
            "sst_schedule_alarm_chk": schedule.sst_schedule_alarm_chk,
            "sst_pick_type": schedule.sst_pick_type,
            "sst_pick_result": schedule.sst_pick_result,
            "sst_schedule_alarm": schedule.sst_schedule_alarm.isoformat() if schedule.sst_schedule_alarm else None,
            "sst_update_chk": schedule.sst_update_chk,
            "sst_wdate": schedule.sst_wdate.isoformat() if schedule.sst_wdate else None,
            "sst_udate": schedule.sst_udate.isoformat() if schedule.sst_udate else None,
            "sst_ddate": schedule.sst_ddate.isoformat() if schedule.sst_ddate else None,
            "sst_in_chk": schedule.sst_in_chk,
            "sst_schedule_chk": schedule.sst_schedule_chk,
            "sst_entry_cnt": schedule.sst_entry_cnt,
            "sst_exit_cnt": schedule.sst_exit_cnt
        }
        result.append(schedule_data)
    
    return result

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