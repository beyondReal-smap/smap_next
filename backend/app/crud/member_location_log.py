from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, asc
from typing import Optional, List
from datetime import datetime, timedelta
import math
from ..models.member_location_log import MemberLocationLog
from ..schemas.member_location_log import (
    MemberLocationLogCreate, 
    MemberLocationLogUpdate,
    LocationLogListRequest,
    LocationSummaryResponse,
    LocationPathResponse
)

def get_member_location_logs(
    db: Session, 
    mt_idx: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[MemberLocationLog]:
    """회원의 위치 로그 목록 조회"""
    query = db.query(MemberLocationLog).filter(MemberLocationLog.mt_idx == mt_idx)
    
    # 날짜 필터링
    if start_date:
        start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(MemberLocationLog.mlt_gps_time >= start_datetime)
    
    if end_date:
        end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(MemberLocationLog.mlt_gps_time < end_datetime)
    
    # 시간순 정렬 및 페이징
    return query.order_by(asc(MemberLocationLog.mlt_gps_time)).offset(offset).limit(limit).all()

def get_location_log_by_id(db: Session, log_id: int) -> Optional[MemberLocationLog]:
    """특정 위치 로그 조회"""
    return db.query(MemberLocationLog).filter(MemberLocationLog.mlt_idx == log_id).first()

def create_location_log(db: Session, log_data: MemberLocationLogCreate) -> MemberLocationLog:
    """위치 로그 생성"""
    db_log = MemberLocationLog(**log_data.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def update_location_log(db: Session, log_id: int, log_data: MemberLocationLogUpdate) -> Optional[MemberLocationLog]:
    """위치 로그 업데이트"""
    db_log = get_location_log_by_id(db, log_id)
    if not db_log:
        return None
    
    update_data = log_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_log, field, value)
    
    db.commit()
    db.refresh(db_log)
    return db_log

def delete_location_log(db: Session, log_id: int) -> bool:
    """위치 로그 삭제"""
    db_log = get_location_log_by_id(db, log_id)
    if not db_log:
        return False
    
    db.delete(db_log)
    db.commit()
    return True

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간의 거리 계산 (km)"""
    if not all([lat1, lon1, lat2, lon2]):
        return 0.0
    
    # Haversine 공식
    R = 6371  # 지구 반지름 (km)
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat/2) * math.sin(dlat/2) + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon/2) * math.sin(dlon/2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

def get_location_summary(
    db: Session, 
    mt_idx: int, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> LocationSummaryResponse:
    """위치 로그 요약 정보 조회"""
    logs = get_member_location_logs(db, mt_idx, start_date, end_date, limit=10000)
    
    if not logs:
        return LocationSummaryResponse(
            total_distance=0.0,
            total_time=0,
            total_steps=0,
            average_speed=0.0,
            battery_usage=0,
            log_count=0
        )
    
    # 총 이동거리 계산
    total_distance = 0.0
    for i in range(1, len(logs)):
        prev_log = logs[i-1]
        curr_log = logs[i]
        if prev_log.mlt_lat and prev_log.mlt_long and curr_log.mlt_lat and curr_log.mlt_long:
            distance = calculate_distance(
                float(prev_log.mlt_lat), float(prev_log.mlt_long),
                float(curr_log.mlt_lat), float(curr_log.mlt_long)
            )
            total_distance += distance
    
    # 총 시간 계산 (분)
    if len(logs) > 1:
        start_time = logs[0].mlt_gps_time
        end_time = logs[-1].mlt_gps_time
        total_time = int((end_time - start_time).total_seconds() / 60)
    else:
        total_time = 0
    
    # 총 걸음수
    total_steps = sum(log.mt_health_work or 0 for log in logs)
    
    # 평균 속도 (km/h)
    if total_time > 0:
        average_speed = (total_distance / total_time) * 60
    else:
        average_speed = 0.0
    
    # 배터리 사용량 (시작 - 끝)
    start_battery = logs[0].mlt_battery or 100
    end_battery = logs[-1].mlt_battery or 100
    battery_usage = max(0, start_battery - end_battery)
    
    return LocationSummaryResponse(
        total_distance=round(total_distance, 2),
        total_time=total_time,
        total_steps=total_steps,
        average_speed=round(average_speed, 2),
        battery_usage=battery_usage,
        log_count=len(logs)
    )

def get_location_path(
    db: Session, 
    mt_idx: int, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> LocationPathResponse:
    """위치 경로 및 요약 정보 조회"""
    logs = get_member_location_logs(db, mt_idx, start_date, end_date, limit=10000)
    
    # 포인트 데이터 생성
    points = []
    for log in logs:
        if log.mlt_lat and log.mlt_long:
            points.append({
                'lat': float(log.mlt_lat),
                'lng': float(log.mlt_long),
                'timestamp': log.mlt_gps_time.isoformat(),
                'accuracy': log.mlt_accuacy,
                'speed': log.mlt_speed,
                'battery': log.mlt_battery,
                'steps': log.mt_health_work
            })
    
    # 요약 정보
    summary = get_location_summary(db, mt_idx, start_date, end_date)
    
    return LocationPathResponse(
        points=points,
        summary=summary
    )

def get_members_with_logs_by_date(db: Session, date: str) -> List[int]:
    """특정 날짜에 위치 로그가 있는 회원 목록 조회"""
    start_datetime = datetime.strptime(date, "%Y-%m-%d")
    end_datetime = start_datetime + timedelta(days=1)
    
    result = db.query(MemberLocationLog.mt_idx).filter(
        and_(
            MemberLocationLog.mlt_gps_time >= start_datetime,
            MemberLocationLog.mlt_gps_time < end_datetime
        )
    ).distinct().all()
    
    return [row[0] for row in result]

def get_member_location_logs_by_exact_date(
    db: Session, 
    mt_idx: int,
    date: str,
    limit: int = 1000,
    offset: int = 0
) -> List[MemberLocationLog]:
    """특정 회원의 특정 날짜 위치 로그 조회 (정확한 날짜 매칭)"""
    # YYYY-MM-DD 형식의 날짜를 받아서 해당 날짜의 00:00:00 ~ 23:59:59 범위로 조회
    start_datetime = datetime.strptime(f"{date} 00:00:00", "%Y-%m-%d %H:%M:%S")
    end_datetime = datetime.strptime(f"{date} 23:59:59", "%Y-%m-%d %H:%M:%S")
    
    query = db.query(MemberLocationLog).filter(
        and_(
            MemberLocationLog.mt_idx == mt_idx,
            MemberLocationLog.mlt_gps_time >= start_datetime,
            MemberLocationLog.mlt_gps_time <= end_datetime
        )
    )
    
    # 시간순 정렬 및 페이징
    return query.order_by(asc(MemberLocationLog.mlt_gps_time)).offset(offset).limit(limit).all()

def get_member_daily_location_summary(
    db: Session, 
    mt_idx: int, 
    date: str
) -> LocationSummaryResponse:
    """특정 회원의 특정 날짜 위치 로그 요약 정보"""
    logs = get_member_location_logs_by_exact_date(db, mt_idx, date, limit=10000)
    
    if not logs:
        return LocationSummaryResponse(
            total_distance=0.0,
            total_time=0,
            total_steps=0,
            average_speed=0.0,
            battery_usage=0,
            log_count=0
        )
    
    # 총 이동거리 계산
    total_distance = 0.0
    for i in range(1, len(logs)):
        prev_log = logs[i-1]
        curr_log = logs[i]
        if prev_log.mlt_lat and prev_log.mlt_long and curr_log.mlt_lat and curr_log.mlt_long:
            distance = calculate_distance(
                float(prev_log.mlt_lat), float(prev_log.mlt_long),
                float(curr_log.mlt_lat), float(curr_log.mlt_long)
            )
            total_distance += distance
    
    # 총 시간 계산 (분) - 첫 번째 로그부터 마지막 로그까지의 시간
    if len(logs) > 1:
        start_time = logs[0].mlt_gps_time
        end_time = logs[-1].mlt_gps_time
        total_time = int((end_time - start_time).total_seconds() / 60)
    else:
        total_time = 0
    
    # 총 걸음수 (가장 마지막 걸음수 - 첫 번째 걸음수로 실제 증가량 계산)
    step_logs = [log.mt_health_work for log in logs if log.mt_health_work is not None]
    if len(step_logs) > 1:
        total_steps = max(step_logs) - min(step_logs)
    elif len(step_logs) == 1:
        total_steps = step_logs[0]
    else:
        total_steps = 0
    
    # 평균 속도 (km/h)
    if total_time > 0:
        average_speed = (total_distance / total_time) * 60
    else:
        average_speed = 0.0
    
    # 배터리 사용량 (시작 - 끝)
    battery_logs = [log.mlt_battery for log in logs if log.mlt_battery is not None]
    if len(battery_logs) > 1:
        start_battery = battery_logs[0]
        end_battery = battery_logs[-1]
        battery_usage = max(0, start_battery - end_battery)
    else:
        battery_usage = 0
    
    return LocationSummaryResponse(
        total_distance=round(total_distance, 2),
        total_time=total_time,
        total_steps=total_steps,
        average_speed=round(average_speed, 2),
        battery_usage=battery_usage,
        log_count=len(logs)
    )

def get_member_daily_location_path(
    db: Session, 
    mt_idx: int, 
    date: str
) -> LocationPathResponse:
    """특정 회원의 특정 날짜 위치 경로 및 요약 정보"""
    logs = get_member_location_logs_by_exact_date(db, mt_idx, date, limit=10000)
    
    # 포인트 데이터 생성
    points = []
    for log in logs:
        if log.mlt_lat and log.mlt_long:
            points.append({
                'lat': float(log.mlt_lat),
                'lng': float(log.mlt_long),
                'timestamp': log.mlt_gps_time.isoformat(),
                'accuracy': log.mlt_accuacy,
                'speed': log.mlt_speed,
                'battery': log.mlt_battery,
                'steps': log.mt_health_work,
                'gps_time': log.mlt_gps_time.strftime('%H:%M:%S')  # 시간만 표시
            })
    
    # 요약 정보
    summary = get_member_daily_location_summary(db, mt_idx, date)
    
    return LocationPathResponse(
        points=points,
        summary=summary
    ) 