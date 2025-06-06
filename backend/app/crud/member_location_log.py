from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, asc, text, or_
from typing import Optional, List
from datetime import datetime, timedelta, date
import math
from ..models.member_location_log import MemberLocationLog
from ..schemas.member_location_log import (
    MemberLocationLogCreate, 
    MemberLocationLogUpdate,
    LocationLogListRequest,
    LocationSummaryResponse,
    LocationPathResponse,
    LocationPath,
    DailySummary,
    StayTime,
    MapMarker,
    LocationLogSummary
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
            total_time='0분',
            step_count=0,
            average_speed=0.0,
            battery_consumption=0
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
    
    # 시간을 문자열 형식으로 변환
    def format_duration(minutes: int) -> str:
        if minutes <= 0:
            return '0분'
        hours = minutes // 60
        mins = minutes % 60
        if hours > 0 and mins > 0:
            return f'{hours}시간 {mins}분'
        elif hours > 0:
            return f'{hours}시간'
        else:
            return f'{mins}분'
    
    return LocationSummaryResponse(
        total_distance=round(total_distance, 2),
        total_time=format_duration(total_time),
        step_count=total_steps,
        average_speed=round(average_speed, 2),
        battery_consumption=battery_usage
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
            total_time='0분',
            step_count=0,
            average_speed=0.0,
            battery_consumption=0
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
    
    # 시간을 문자열 형식으로 변환
    def format_duration(minutes: int) -> str:
        if minutes <= 0:
            return '0분'
        hours = minutes // 60
        mins = minutes % 60
        if hours > 0 and mins > 0:
            return f'{hours}시간 {mins}분'
        elif hours > 0:
            return f'{hours}시간'
        else:
            return f'{mins}분'
    
    return LocationSummaryResponse(
        total_distance=round(total_distance, 2),
        total_time=format_duration(total_time),
        step_count=total_steps,
        average_speed=round(average_speed, 2),
        battery_consumption=battery_usage
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

def get_member_location_logs_daily_summary(
    db: Session, 
    mt_idx: int,
    start_date: str,
    end_date: str,
    max_accuracy: float = 50.0,
    min_speed: float = 0.0
) -> List[dict]:
    """
    특정 회원의 위치 로그를 날짜별로 그룹화하여 요약 정보 조회
    제공된 SQL 쿼리를 SQLAlchemy로 구현
    
    Args:
        mt_idx: 회원 인덱스
        start_date: 시작 날짜 (YYYY-MM-DD)
        end_date: 종료 날짜 (YYYY-MM-DD)
        max_accuracy: 최대 정확도 값 (기본값: 50.0)
        min_speed: 최소 속도 값 (기본값: 0.0)
    
    Returns:
        List[dict]: 날짜별 요약 정보
            - mlt_idx: 첫 번째 로그 인덱스
            - log_date: 로그 날짜
            - start_time: 해당 날짜 첫 번째 GPS 시간
            - end_time: 해당 날짜 마지막 GPS 시간
    """
    from sqlalchemy import func, and_, cast, Date
    
    # 날짜 범위 설정
    start_datetime = datetime.strptime(f"{start_date} 00:00:00", "%Y-%m-%d %H:%M:%S")
    end_datetime = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
    
    # SQLAlchemy 쿼리 작성
    query = db.query(
        func.min(MemberLocationLog.mlt_idx).label('mlt_idx'),
        cast(MemberLocationLog.mlt_gps_time, Date).label('log_date'),
        func.min(MemberLocationLog.mlt_gps_time).label('start_time'),
        func.max(MemberLocationLog.mlt_gps_time).label('end_time')
    ).filter(
        and_(
            MemberLocationLog.mt_idx == mt_idx,
            MemberLocationLog.mlt_accuacy < max_accuracy,
            MemberLocationLog.mlt_speed >= min_speed,
            MemberLocationLog.mlt_lat > 0,
            MemberLocationLog.mlt_long > 0,
            MemberLocationLog.mlt_gps_time >= start_datetime,
            MemberLocationLog.mlt_gps_time <= end_datetime
        )
    ).group_by(
        cast(MemberLocationLog.mlt_gps_time, Date)
    ).order_by(
        cast(MemberLocationLog.mlt_gps_time, Date).asc()
    )
    
    # 결과를 딕셔너리 리스트로 변환
    results = []
    for row in query.all():
        results.append({
            'mlt_idx': row.mlt_idx,
            'log_date': row.log_date.strftime('%Y-%m-%d'),
            'start_time': row.start_time.strftime('%Y-%m-%d %H:%M:%S'),
            'end_time': row.end_time.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return results

def get_member_stay_times(
    db: Session, 
    mt_idx: int,
    date: str,
    min_speed: float = 1.0,
    max_accuracy: float = 50.0,
    min_duration: int = 5
) -> List[dict]:
    """
    특정 회원의 특정 날짜 체류시간 분석
    제공된 복잡한 CTE 쿼리를 원시 SQL로 구현
    
    Args:
        mt_idx: 회원 인덱스 (sgdt_mt_idx)
        date: 분석할 날짜 (YYYY-MM-DD)
        min_speed: 체류/이동 구분 기준 속도 (기본값: 1.0)
        max_accuracy: 최대 정확도 값 (기본값: 50.0)
        min_duration: 최소 체류시간(분) (기본값: 5)
    
    Returns:
        List[dict]: 체류시간 분석 결과
            - label: 'stay' 또는 'move'
            - grp: 그룹 번호
            - start_time: 시작 시간
            - end_time: 종료 시간
            - duration: 지속 시간(분)
            - distance: 이동 거리(km)
            - start_lat: 시작 위도
            - start_long: 시작 경도
    """
    from sqlalchemy import text
    
    # 복잡한 CTE 쿼리를 원시 SQL로 구현
    sql_query = text("""
        WITH labeled_data AS (
            SELECT
                mlt_idx,
                mt_idx,
                mlt_gps_time,
                mlt_speed,
                mlt_lat,
                mlt_long,
                CASE
                    WHEN mlt_speed < :min_speed THEN 'stay'
                    ELSE 'move'
                END AS label
            FROM
                member_location_log_t
            WHERE 
                mt_idx = :mt_idx
                AND mlt_accuacy < :max_accuracy
                AND mlt_gps_time BETWEEN :start_datetime AND :end_datetime
            ORDER BY
                mlt_gps_time
        ),
        labeled_data_with_lag AS (
            SELECT
                *,
                LAG(label) OVER (ORDER BY mlt_gps_time) AS prev_label,
                LAG(mlt_lat) OVER (ORDER BY mlt_gps_time) AS prev_lat,
                LAG(mlt_long) OVER (ORDER BY mlt_gps_time) AS prev_long
            FROM
                labeled_data
        ),
        labeled_data_with_grp AS (
            SELECT
                *,
                SUM(CASE WHEN label <> COALESCE(prev_label, label) THEN 1 ELSE 0 END) OVER (ORDER BY mlt_gps_time) AS grp
            FROM
                labeled_data_with_lag
        ),
        labeled_data_with_grp_status AS (
            SELECT
                *,
                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY grp ORDER BY mlt_gps_time) = 1 THEN 'S' 
                    WHEN ROW_NUMBER() OVER (PARTITION BY grp ORDER BY mlt_gps_time DESC) = 1 THEN 'E' 
                    WHEN mlt_gps_time = (SELECT MAX(mlt_gps_time) FROM labeled_data_with_grp) THEN 'E'
                    ELSE NULL
                END AS grp_status
            FROM
                labeled_data_with_grp
        ),
        filtered_data AS (
            SELECT
                *
            FROM
                labeled_data_with_grp_status
            WHERE
                grp IN (
                    SELECT
                        grp
                    FROM
                        labeled_data_with_grp_status
                    GROUP BY
                        grp
                    HAVING
                        COUNT(CASE WHEN grp_status = 'S' THEN 1 END) = 1
                        AND COUNT(CASE WHEN grp_status = 'E' THEN 1 END) >= 1
                )
        ),
        result_data AS (
            SELECT
                label,
                grp,
                MIN(CASE WHEN grp_status = 'S' THEN mlt_gps_time END) AS start_time,
                MAX(CASE WHEN grp_status = 'E' THEN mlt_gps_time END) AS end_time,
                TIMESTAMPDIFF(SECOND, 
                    MIN(CASE WHEN grp_status = 'S' THEN mlt_gps_time END), 
                    MAX(CASE WHEN grp_status = 'E' THEN mlt_gps_time END)
                ) / 60 AS duration,
                SUM(
                    CASE WHEN prev_lat IS NOT NULL AND prev_long IS NOT NULL 
                    THEN 
                        (6371 * ACOS(
                            GREATEST(-1, LEAST(1,
                                COS(RADIANS(mlt_lat)) * COS(RADIANS(prev_lat)) * 
                                COS(RADIANS(prev_long) - RADIANS(mlt_long)) + 
                                SIN(RADIANS(mlt_lat)) * SIN(RADIANS(prev_lat))
                            ))
                        ))
                    ELSE 0 
                    END
                ) AS distance,
                MAX(CASE WHEN grp_status = 'S' THEN mlt_lat END) AS start_lat,
                MAX(CASE WHEN grp_status = 'S' THEN mlt_long END) AS start_long
            FROM
                filtered_data
            GROUP BY
                label, grp
        )
        SELECT
            label,
            grp,
            start_time,
            end_time,
            duration,
            distance,
            start_lat,
            start_long
        FROM
            result_data
        WHERE 
            duration >= :min_duration
            AND label = 'stay'
        ORDER BY
            start_time
    """)
    
    # 파라미터 바인딩
    params = {
        'mt_idx': mt_idx,
        'min_speed': min_speed,
        'max_accuracy': max_accuracy,
        'start_datetime': f"{date} 00:00:00",
        'end_datetime': f"{date} 23:59:59",
        'min_duration': min_duration
    }
    
    # 쿼리 실행
    result = db.execute(sql_query, params)
    
    # 결과를 딕셔너리 리스트로 변환
    results = []
    for row in result:
        results.append({
            'label': row.label,
            'grp': row.grp,
            'start_time': row.start_time.strftime('%Y-%m-%d %H:%M:%S') if row.start_time else None,
            'end_time': row.end_time.strftime('%Y-%m-%d %H:%M:%S') if row.end_time else None,
            'duration': float(row.duration) if row.duration else 0.0,
            'distance': float(row.distance) if row.distance else 0.0,
            'start_lat': float(row.start_lat) if row.start_lat else None,
            'start_long': float(row.start_long) if row.start_long else None
        })
    
    return results

def get_member_map_markers(
    db: Session, 
    mt_idx: int,
    date: str,
    min_speed: float = 1.0,
    max_accuracy: float = 50.0
) -> List[dict]:
    """
    특정 회원의 특정 날짜 지도 마커용 이동로그 데이터 조회
    제공된 SQL 쿼리를 원시 SQL로 구현 (데이터 샘플링 포함)
    
    Args:
        mt_idx: 회원 인덱스 (sgdt_mt_idx)
        date: 조회할 날짜 (YYYY-MM-DD)
        min_speed: 최소 속도 값 (기본값: 1.0)
        max_accuracy: 최대 정확도 값 (기본값: 50.0)
    
    Returns:
        List[dict]: 지도 마커용 위치 로그 데이터
            - mlt_idx: 위치로그 인덱스
            - mt_idx: 회원 인덱스
            - mlt_gps_time: GPS 시간
            - mlt_speed: 속도
            - mlt_lat: 위도
            - mlt_long: 경도
            - mlt_accuacy: 정확도
            - mt_health_work: 걸음수
            - mlt_battery: 배터리
    """
    from sqlalchemy import text
    
    # 제공된 SQL 쿼리를 원시 SQL로 구현
    sql_query = text("""
        SELECT *
        FROM member_location_log_t
        WHERE mt_idx = :mt_idx
            AND mlt_accuacy < :max_accuracy
            AND mlt_speed >= :min_speed
            AND (mlt_lat > 0 AND mlt_long > 0)
            AND mlt_gps_time BETWEEN :start_datetime AND :end_datetime
        GROUP BY 
            CASE 
                WHEN (mlt_speed >= :min_speed AND mlt_accuacy < :max_accuracy) THEN mlt_gps_time
                ELSE mt_health_work
            END
        HAVING COUNT(*) % 10 = 1
        ORDER BY mlt_gps_time ASC
    """)
    
    # 파라미터 바인딩
    params = {
        'mt_idx': mt_idx,
        'min_speed': min_speed,
        'max_accuracy': max_accuracy,
        'start_datetime': f"{date} 00:00:00",
        'end_datetime': f"{date} 23:59:59"
    }
    
    # 쿼리 실행
    result = db.execute(sql_query, params)
    
    # 결과를 딕셔너리 리스트로 변환
    results = []
    for row in result:
        results.append({
            'mlt_idx': row.mlt_idx,
            'mt_idx': row.mt_idx,
            'mlt_gps_time': row.mlt_gps_time.strftime('%Y-%m-%d %H:%M:%S') if row.mlt_gps_time else None,
            'mlt_speed': float(row.mlt_speed) if row.mlt_speed else 0.0,
            'mlt_lat': float(row.mlt_lat) if row.mlt_lat else None,
            'mlt_long': float(row.mlt_long) if row.mlt_long else None,
            'mlt_accuacy': float(row.mlt_accuacy) if row.mlt_accuacy else None,
            'mt_health_work': row.mt_health_work if row.mt_health_work else 0,
            'mlt_battery': row.mlt_battery if row.mlt_battery else None,
            'mlt_fine_location': row.mlt_fine_location,
            'mlt_location_chk': row.mlt_location_chk,
            'mlt_wdate': row.mlt_wdate.strftime('%Y-%m-%d %H:%M:%S') if row.mlt_wdate else None,
            'stay_lat': float(row.stay_lat) if row.stay_lat else None,
            'stay_long': float(row.stay_long) if row.stay_long else None
        })
    
    return results

def get_schedule_count(db: Session, mt_idx: int, date_str: str) -> int:
    """특정 날짜의 일정 개수 조회 (PHP get_schedule_array 함수 기반)"""
    
    # 개인 일정 조회
    personal_query = text("""
        SELECT COUNT(DISTINCT sst_idx) as count
        FROM smap_schedule_t 
        WHERE mt_idx = :mt_idx 
        AND sgt_idx IS NULL 
        AND (sgdt_idx IS NULL OR sgdt_idx = 0)
        AND (sst_sdate <= :date_end AND sst_edate >= :date_start)
        AND sst_show = 'Y'
        AND sst_title IS NOT NULL AND sst_title != ''
    """)
    
    date_start = f"{date_str} 00:00:00"
    date_end = f"{date_str} 23:59:59"
    
    try:
        personal_result = db.execute(personal_query, {
            "mt_idx": mt_idx,
            "date_start": date_start,
            "date_end": date_end
        }).fetchone()
        
        personal_count = personal_result.count if personal_result else 0
        
        # 그룹 일정 조회
        group_query = text("""
            SELECT GROUP_CONCAT(sgt_idx) as gc_sgt_idx, GROUP_CONCAT(sgdt_idx) as gc_sgdt_idx
            FROM smap_group_detail_t 
            WHERE mt_idx = :mt_idx 
            AND sgdt_discharge = 'N' 
            AND sgdt_exit = 'N'
        """)
        
        group_result = db.execute(group_query, {"mt_idx": mt_idx}).fetchone()
        
        group_count = 0
        if group_result and group_result.gc_sgdt_idx:
            group_schedule_query = text("""
                SELECT COUNT(DISTINCT sst_idx) as count
                FROM smap_schedule_t 
                WHERE sgdt_idx IN ({})
                AND (sst_sdate <= :date_end AND sst_edate >= :date_start)
                AND sst_show = 'Y'
                AND sst_title IS NOT NULL AND sst_title != ''
            """.format(group_result.gc_sgdt_idx))
            
            group_schedule_result = db.execute(group_schedule_query, {
                "date_start": date_start,
                "date_end": date_end
            }).fetchone()
            
            group_count = group_schedule_result.count if group_schedule_result else 0
        
        return personal_count + group_count
        
    except Exception as e:
        print(f"일정 개수 조회 오류: {e}")
        return 0

def get_gps_distance_and_time(db: Session, mt_idx: int, date_str: str, max_accuracy: float = 100.0, min_speed: float = 2.0, max_speed: float = 55.0) -> tuple:
    """GPS 거리 및 시간 계산 (PHP get_gps_distance 함수 기반)"""
    
    # PHP 복잡한 SQL 쿼리를 Python으로 변환
    distance_query = text("""
        WITH RankedLogs AS (
            SELECT
                mt_idx,
                mlt_accuacy,
                mlt_speed,
                mlt_lat,
                mlt_long,
                mlt_gps_time,
                ROW_NUMBER() OVER (ORDER BY mlt_gps_time ASC) AS rn
            FROM
                member_location_log_t
            WHERE 1=1
                AND mt_idx = :mt_idx
                AND mlt_gps_time BETWEEN :date_start AND :date_end
                AND mlt_speed > 0
                AND mlt_accuacy < :max_accuracy
        ),
        Diffs AS (
            SELECT
                L1.rn,
                L1.mlt_lat AS lat1,
                L1.mlt_long AS long1,
                L2.mlt_lat AS lat2,
                L2.mlt_long AS long2,
                L1.mlt_gps_time AS wdate1,
                L2.mlt_gps_time AS wdate2,
                L1.mlt_speed AS speed,
                L1.mlt_accuacy AS accuracy,
                TIMESTAMPDIFF(SECOND, L1.mlt_gps_time, L2.mlt_gps_time) AS time_diff_seconds
            FROM
                RankedLogs L1
            INNER JOIN RankedLogs L2 ON L1.rn = L2.rn - 1
        )
        SELECT 
            SUM(CASE
                WHEN rslt.time_diff_seconds > 10
                AND ROUND((rslt.distance_meters / rslt.time_diff_seconds) * 3600 / 1000, 1) < :min_speed
                AND rslt.time_diff_seconds > rslt.distance_meters / 0.6
                THEN rslt.distance_meters / 0.6
                ELSE time_diff_seconds
            END) / 60 AS moving_minute,
            SUM(rslt.distance_meters) AS moving_meters
        FROM (
            SELECT
                rn,
                lat1,
                long1,
                lat2,
                long2,
                wdate1,
                wdate2,
                speed,
                accuracy,
                time_diff_seconds,
                ROUND(6371000 * ACOS(COS(RADIANS(lat2)) * COS(RADIANS(lat1)) * COS(RADIANS(long1) - RADIANS(long2)) + SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))), 1) AS distance_meters
            FROM
                Diffs
        ) rslt
        WHERE ROUND((rslt.distance_meters / rslt.time_diff_seconds) * 3600 / 1000, 1) BETWEEN :min_speed AND :max_speed
    """)
    
    date_start = f"{date_str} 00:00:00"
    date_end = f"{date_str} 23:59:59"
    
    try:
        result = db.execute(distance_query, {
            "mt_idx": mt_idx,
            "date_start": date_start,
            "date_end": date_end,
            "max_accuracy": max_accuracy,
            "min_speed": min_speed,
            "max_speed": max_speed
        }).fetchone()
        
        moving_meters = result.moving_meters if result and result.moving_meters else 0
        moving_minutes = result.moving_minute if result and result.moving_minute else 0
        
        # 걸음수 조회 (해당 날짜의 마지막 기록)
        steps_query = text("""
            SELECT mt_health_work 
            FROM member_location_log_t 
            WHERE mt_idx = :mt_idx 
            AND mlt_wdate BETWEEN :date_start AND :date_end
            ORDER BY mlt_gps_time DESC 
            LIMIT 1
        """)
        
        steps_result = db.execute(steps_query, {
            "mt_idx": mt_idx,
            "date_start": date_start,
            "date_end": date_end
        }).fetchone()
        
        steps = steps_result.mt_health_work if steps_result and steps_result.mt_health_work else 0
        
        return moving_meters, moving_minutes, steps
        
    except Exception as e:
        print(f"GPS 거리/시간 계산 오류: {e}")
        return 0, 0, 0

def format_distance_km(meters: float) -> str:
    """거리를 km 형식으로 포맷팅"""
    if meters < 1000:
        return f"{int(meters)}m"
    else:
        km = meters / 1000
        return f"{km:.1f}km"

def format_duration_hm(minutes: float) -> str:
    """시간을 시간:분 형식으로 포맷팅"""
    if minutes < 60:
        return f"{int(minutes)}분"
    else:
        hours = int(minutes // 60)
        mins = int(minutes % 60)
        return f"{hours}시간 {mins}분"

def get_location_log_summary(db: Session, mt_idx: int, date_str: str) -> LocationLogSummary:
    """PHP 로직 기반 위치 로그 요약 정보 생성"""
    
    # 일정 개수 조회
    schedule_count = get_schedule_count(db, mt_idx, date_str)
    
    # GPS 거리, 시간, 걸음수 조회
    distance_meters, time_minutes, steps = get_gps_distance_and_time(db, mt_idx, date_str)
    
    return LocationLogSummary(
        schedule_count=f"{schedule_count:,}",
        distance=format_distance_km(distance_meters),
        duration=format_duration_hm(time_minutes),
        steps=int(steps)
    ) 