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
from app.models.enums import ShowEnum, ExitEnum, DischargeEnum
import logging
import traceback

logger = logging.getLogger(__name__)

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
    try:
        logger.info(f"📅 [GET_GROUP_SCHEDULES] 시작 - group_id: {group_id}, days: {days}")
        
        start_date: Optional[datetime] = None
        end_date: Optional[datetime] = None

        # 기본값: 최근 2주 (7일 전 ~ 7일 후)
        if days is None:
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = today  # 오늘
            end_date = today + timedelta(days=14)    # 2주일 후
            logger.info(f"📅 [GET_GROUP_SCHEDULES] 기본 날짜 범위 적용: {start_date.date()} ~ {end_date.date()}")
        elif days > 0:
            start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(days=days)
            logger.info(f"📅 [GET_GROUP_SCHEDULES] 사용자 지정 날짜 범위: {start_date.date()} ~ {end_date.date()}")
        
        
        # 그룹에 속한 멤버들의 ID 조회
        group_member_ids = db.query(GroupDetail.mt_idx).filter(
            and_(
                GroupDetail.sgt_idx == group_id,
                GroupDetail.sgdt_show == ShowEnum.Y,
                GroupDetail.sgdt_exit == ExitEnum.N,
                GroupDetail.sgdt_discharge == DischargeEnum.N
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
        logger.info(f"📊 [GET_GROUP_SCHEDULES] 조회 완료 - 일정 수: {len(schedules)}")
        
        # home/page.tsx의 Schedule 타입에 맞게 데이터 변환
        result = []
        for schedule in schedules:
            try:
                # 멤버 정보 조회 (mt_schedule_idx 필드 생성용)
                member_id = None
                if schedule.mt_idx:
                    member_id = schedule.mt_idx
                
                schedule_data = {
                    "id": schedule.sst_idx,  # Int로 변경 (LoginModels.swift와 일치)
                    "sst_pidx": schedule.sst_pidx,
                    "mt_schedule_idx": member_id,  # home/page.tsx에서 멤버 구분에 사용
                    "title": schedule.sst_title,
                    "date": schedule.sst_sdate.isoformat() if schedule.sst_sdate and hasattr(schedule.sst_sdate, 'isoformat') else str(schedule.sst_sdate) if schedule.sst_sdate else None,
                    "sst_edate": schedule.sst_edate.isoformat() if schedule.sst_edate and hasattr(schedule.sst_edate, 'isoformat') else str(schedule.sst_edate) if schedule.sst_edate else None,
                    "sst_sedate": schedule.sst_sedate,
                    "sst_all_day": schedule.sst_all_day,
                    "sst_repeat_json": schedule.sst_repeat_json,
                    "sst_repeat_json_v": schedule.sst_repeat_json_v,
                    "sgt_idx": schedule.sgt_idx,
                    "sgdt_idx": schedule.sgdt_idx,
                    "sgdt_idx_t": schedule.sgdt_idx_t,
                    "sst_alram": schedule.sst_alram,
                    "sst_alram_t": schedule.sst_alram_t,
                    "sst_adate": schedule.sst_adate.isoformat() if schedule.sst_adate and hasattr(schedule.sst_adate, 'isoformat') else str(schedule.sst_adate) if schedule.sst_adate else None,
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
                    "sst_schedule_alarm": schedule.sst_schedule_alarm.isoformat() if schedule.sst_schedule_alarm and hasattr(schedule.sst_schedule_alarm, 'isoformat') else str(schedule.sst_schedule_alarm) if schedule.sst_schedule_alarm else None,
                    "sst_update_chk": schedule.sst_update_chk,
                    "sst_wdate": schedule.sst_wdate.isoformat() if schedule.sst_wdate and hasattr(schedule.sst_wdate, 'isoformat') else str(schedule.sst_wdate) if schedule.sst_wdate else None,
                    "sst_udate": schedule.sst_udate.isoformat() if schedule.sst_udate and hasattr(schedule.sst_udate, 'isoformat') else str(schedule.sst_udate) if schedule.sst_udate else None,
                    "sst_ddate": schedule.sst_ddate.isoformat() if schedule.sst_ddate and hasattr(schedule.sst_ddate, 'isoformat') else str(schedule.sst_ddate) if schedule.sst_ddate else None,
                    "sst_in_chk": schedule.sst_in_chk,
                    "sst_schedule_chk": schedule.sst_schedule_chk,
                    "sst_entry_cnt": schedule.sst_entry_cnt,
                    "sst_exit_cnt": schedule.sst_exit_cnt
                }
                result.append(schedule_data)
            except Exception as e:
                logger.error(f"💥 [GET_GROUP_SCHEDULES] 개별 일정 변환 오류 (ID: {getattr(schedule, 'sst_idx', '알수없음')}): {e}")
                continue
        
        logger.info(f"✅ [GET_GROUP_SCHEDULES] 완료 - 최종 일정 수: {len(result)}")
        return result
    except Exception as e:
        logger.error(f"💥 [GET_GROUP_SCHEDULES] 치명적 오류: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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