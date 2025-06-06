import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ....db.session import get_db
from ....schemas.member_location_log import (
    MemberLocationLogCreate, 
    MemberLocationLogUpdate, 
    MemberLocationLogResponse,
    LocationLogListRequest,
    LocationSummaryResponse,
    LocationPathResponse,
    DailySummary,
    StayTime,
    MapMarker,
    LocationLogSummaryResponse
)
from ....crud import member_location_log as location_log_crud

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/member-location-logs")
async def handle_location_log_request(
    request: Request,
    db: Session = Depends(get_db)
):
    """위치 로그 관련 요청 처리"""
    print("==== FastAPI /api/v1/member-location-logs 진입 ====")
    try:
        body = await request.json()
        logger.info(f"Received location log request: {body}")
        act = body.get("act")
        
        if not act:
            logger.error("No 'act' parameter provided in request")
            raise HTTPException(status_code=400, detail="'act' parameter is required")
        
        if act == "get_location_logs":
            # 회원의 위치 로그 목록 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                limit = body.get("limit", 100)
                offset = body.get("offset", 0)
                
                logs = location_log_crud.get_member_location_logs(
                    db, mt_idx, start_date, end_date, limit, offset
                )
                
                result = [log.to_dict() for log in logs]
                logger.info(f"Retrieved {len(result)} location logs for member {mt_idx}")
                return {"result": "Y", "data": result}
                
            except Exception as e:
                logger.error(f"Error getting location logs: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_location_summary":
            # 위치 로그 요약 정보 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                
                summary = location_log_crud.get_location_summary(
                    db, mt_idx, start_date, end_date
                )
                
                logger.info(f"Retrieved location summary for member {mt_idx}")
                return {"result": "Y", "data": summary.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting location summary: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_location_path":
            # 위치 경로 및 요약 정보 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                
                path_data = location_log_crud.get_location_path(
                    db, mt_idx, start_date, end_date
                )
                
                logger.info(f"Retrieved location path for member {mt_idx}: {len(path_data.points)} points")
                return {"result": "Y", "data": path_data.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting location path: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "create_location_log":
            # 위치 로그 생성
            try:
                log_data = MemberLocationLogCreate(**body)
                result = location_log_crud.create_location_log(db, log_data)
                logger.info(f"Location log created successfully: {result.mlt_idx}")
                return {"result": "Y", "data": result.to_dict()}
                
            except Exception as e:
                logger.error(f"Error creating location log: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "update_location_log":
            # 위치 로그 업데이트
            try:
                log_id = body.get("mlt_idx")
                if not log_id:
                    raise HTTPException(status_code=400, detail="mlt_idx is required")
                
                update_data = {k: v for k, v in body.items() if k not in ["act", "mlt_idx"]}
                log_data = MemberLocationLogUpdate(**update_data)
                
                result = location_log_crud.update_location_log(db, log_id, log_data)
                if not result:
                    raise HTTPException(status_code=404, detail="Location log not found")
                
                logger.info(f"Location log updated successfully: {result.mlt_idx}")
                return {"result": "Y", "data": result.to_dict()}
                
            except Exception as e:
                logger.error(f"Error updating location log: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "delete_location_log":
            # 위치 로그 삭제
            try:
                log_id = body.get("mlt_idx")
                if not log_id:
                    raise HTTPException(status_code=400, detail="mlt_idx is required")
                
                success = location_log_crud.delete_location_log(db, log_id)
                if not success:
                    raise HTTPException(status_code=404, detail="Location log not found")
                
                logger.info(f"Location log deleted successfully: {log_id}")
                return {"result": "Y", "data": {"deleted_id": log_id}}
                
            except Exception as e:
                logger.error(f"Error deleting location log: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_members_with_logs":
            # 특정 날짜에 위치 로그가 있는 회원 목록 조회
            try:
                date = body.get("date")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                member_ids = location_log_crud.get_members_with_logs_by_date(db, date)
                
                logger.info(f"Found {len(member_ids)} members with logs on {date}")
                return {"result": "Y", "data": {"member_ids": member_ids}}
                
            except Exception as e:
                logger.error(f"Error getting members with logs: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_daily_location_logs":
            # 특정 회원의 특정 날짜 위치 로그 조회 (logs 페이지용)
            try:
                mt_idx = body.get("mt_idx")
                date = body.get("date")
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                limit = body.get("limit", 1000)
                offset = body.get("offset", 0)
                
                logs = location_log_crud.get_member_location_logs_by_exact_date(
                    db, mt_idx, date, limit, offset
                )
                
                result = [log.to_dict() for log in logs]
                logger.info(f"Retrieved {len(result)} daily location logs for member {mt_idx} on {date}")
                return {"result": "Y", "data": result}
                
            except Exception as e:
                logger.error(f"Error getting daily location logs: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_daily_location_summary":
            # 특정 회원의 특정 날짜 위치 로그 요약 정보 (logs 페이지용)
            try:
                mt_idx = body.get("mt_idx")
                date = body.get("date")
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                summary = location_log_crud.get_member_daily_location_summary(db, mt_idx, date)
                
                logger.info(f"Retrieved daily location summary for member {mt_idx} on {date}")
                return {"result": "Y", "data": summary.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting daily location summary: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_daily_location_path":
            # 특정 회원의 특정 날짜 위치 경로 및 요약 정보 (logs 페이지용)
            try:
                mt_idx = body.get("mt_idx")
                date = body.get("date")
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                path_data = location_log_crud.get_member_daily_location_path(db, mt_idx, date)
                
                logger.info(f"Retrieved daily location path for member {mt_idx} on {date}: {len(path_data.points)} points")
                return {"result": "Y", "data": path_data.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting daily location path: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_daily_summary_by_range" or act == "get_daily_summary":
            # 특정 회원의 날짜 범위별 위치 로그 요약 정보 (제공된 SQL 쿼리 기반)
            try:
                mt_idx = body.get("mt_idx")
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                max_accuracy = body.get("max_accuracy", 50.0)
                min_speed = body.get("min_speed", 0.0)
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not start_date:
                    raise HTTPException(status_code=400, detail="start_date is required (YYYY-MM-DD format)")
                if not end_date:
                    raise HTTPException(status_code=400, detail="end_date is required (YYYY-MM-DD format)")
                
                summary_data = location_log_crud.get_member_location_logs_daily_summary(
                    db, mt_idx, start_date, end_date, max_accuracy, min_speed
                )
                
                logger.info(f"Retrieved daily summary by range for member {mt_idx}: {len(summary_data)} days")
                return {
                    "result": "Y", 
                    "data": summary_data,
                    "total_days": len(summary_data)
                }
                
            except Exception as e:
                logger.error(f"Error getting daily summary by range: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_stay_times":
            # 특정 회원의 특정 날짜 체류시간 분석 (제공된 복잡한 CTE 쿼리 기반)
            try:
                mt_idx = body.get("mt_idx")
                date = body.get("date")
                min_speed = body.get("min_speed", 1.0)
                max_accuracy = body.get("max_accuracy", 50.0)
                min_duration = body.get("min_duration", 5)
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                stay_times = location_log_crud.get_member_stay_times(
                    db, mt_idx, date, min_speed, max_accuracy, min_duration
                )
                
                logger.info(f"Retrieved stay times for member {mt_idx} on {date}: {len(stay_times)} stays")
                return {
                    "result": "Y", 
                    "data": stay_times,
                    "total_stays": len(stay_times)
                }
                
            except Exception as e:
                logger.error(f"Error getting stay times: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_map_markers":
            # 특정 회원의 특정 날짜 지도 마커용 이동로그 데이터 조회 (제공된 SQL 쿼리 기반)
            try:
                mt_idx = body.get("mt_idx")
                date = body.get("date")
                min_speed = body.get("min_speed", 1.0)
                max_accuracy = body.get("max_accuracy", 50.0)
                
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                map_markers = location_log_crud.get_member_map_markers(
                    db, mt_idx, date, min_speed, max_accuracy
                )
                
                logger.info(f"Retrieved map markers for member {mt_idx} on {date}: {len(map_markers)} markers")
                return {
                    "result": "Y", 
                    "data": map_markers,
                    "total_markers": len(map_markers)
                }
                
            except Exception as e:
                logger.error(f"Error getting map markers: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_location_summary":
            # 특정 회원의 위치 로그 요약 정보 조회 (PHP 로직 기반)
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                date = body.get("date")
                if not date:
                    raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD format)")
                
                summary = location_log_crud.get_location_log_summary(db, mt_idx=mt_idx, date_str=date)
                
                logger.info(f"Retrieved location summary for member {mt_idx} on {date}")
                return LocationLogSummaryResponse(
                    result="Y",
                    data=summary,
                    message="위치 로그 요약 정보 조회 성공"
                )
                
            except Exception as e:
                logger.error(f"Error getting location summary: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        else:
            logger.error(f"Invalid act value: {act}")
            raise HTTPException(status_code=400, detail=f"Invalid act value: {act}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in location log request: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# REST API 스타일 엔드포인트들 (선택사항)
@router.get("/member-location-logs/{mt_idx}")
async def get_member_location_logs(
    mt_idx: int,
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    limit: int = Query(100, description="조회할 로그 수"),
    offset: int = Query(0, description="건너뛸 로그 수"),
    db: Session = Depends(get_db)
):
    """회원의 위치 로그 목록 조회 (GET 방식)"""
    try:
        logs = location_log_crud.get_member_location_logs(
            db, mt_idx, start_date, end_date, limit, offset
        )
        result = [log.to_dict() for log in logs]
        return {"result": "Y", "data": result}
    except Exception as e:
        logger.error(f"Error getting location logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/summary")
async def get_location_summary(
    mt_idx: int,
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """위치 로그 요약 정보 조회 (GET 방식)"""
    try:
        summary = location_log_crud.get_location_summary(db, mt_idx, start_date, end_date)
        return {"result": "Y", "data": summary.model_dump()}
    except Exception as e:
        logger.error(f"Error getting location summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/path")
async def get_location_path(
    mt_idx: int,
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """위치 경로 및 요약 정보 조회 (GET 방식)"""
    try:
        path_data = location_log_crud.get_location_path(db, mt_idx, start_date, end_date)
        return {"result": "Y", "data": path_data.model_dump()}
    except Exception as e:
        logger.error(f"Error getting location path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/daily")
async def get_daily_location_logs(
    mt_idx: int,
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    limit: int = Query(1000, description="조회할 로그 수"),
    offset: int = Query(0, description="건너뛸 로그 수"),
    db: Session = Depends(get_db)
):
    """특정 회원의 특정 날짜 위치 로그 조회 (GET 방식)"""
    try:
        logger.info(f"[GET] Daily location logs: mt_idx={mt_idx}, date={date}")
        
        logs = location_log_crud.get_member_location_logs_by_exact_date(
            db, mt_idx, date, limit, offset
        )
        
        result = [log.to_dict() for log in logs]
        logger.info(f"Retrieved {len(result)} daily location logs for member {mt_idx} on {date}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting daily location logs: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/summary")
async def get_daily_location_summary(
    mt_idx: int,
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db)
):
    """특정 회원의 특정 날짜 위치 요약 정보 조회 (GET 방식)"""
    try:
        logger.info(f"[GET] Daily location summary: mt_idx={mt_idx}, date={date}")
        
        summary = location_log_crud.get_member_daily_location_summary(
            db, mt_idx, date
        )
        
        logger.info(f"Retrieved daily location summary for member {mt_idx} on {date}")
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting daily location summary: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/path")
async def get_daily_location_path(
    mt_idx: int,
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db)
):
    """특정 회원의 특정 날짜 위치 경로 데이터 조회 (GET 방식)"""
    try:
        logger.info(f"[GET] Daily location path: mt_idx={mt_idx}, date={date}")
        
        path_data = location_log_crud.get_member_daily_location_path(
            db, mt_idx, date
        )
        
        logger.info(f"Retrieved daily location path for member {mt_idx} on {date}: {len(path_data)} points")
        
        return path_data
        
    except Exception as e:
        logger.error(f"Error getting daily location path: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/members-with-logs")
async def get_members_with_logs(
    group_id: int = Query(..., description="그룹 ID"),
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db)
):
    """특정 날짜에 위치 로그가 있는 멤버 목록 조회 (GET 방식)"""
    try:
        logger.info(f"[GET] Members with logs: group_id={group_id}, date={date}")
        
        member_ids = location_log_crud.get_members_with_logs_by_date(db, date)
        
        logger.info(f"Found {len(member_ids)} members with logs on {date}")
        
        return member_ids
        
    except Exception as e:
        logger.error(f"Error getting members with logs: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/daily-summary")
async def get_member_location_logs_daily_summary(
    mt_idx: int,
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD 형식)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD 형식)"),
    max_accuracy: float = Query(50.0, description="최대 정확도 값"),
    min_speed: float = Query(0.0, description="최소 속도 값"),
    db: Session = Depends(get_db)
):
    """
    특정 회원의 위치 로그를 날짜별로 그룹화하여 요약 정보 조회 (GET 방식)
    제공된 SQL 쿼리를 기반으로 구현된 API
    """
    try:
        logger.info(f"[GET] Daily summary: mt_idx={mt_idx}, start_date={start_date}, end_date={end_date}")
        
        summary_data = location_log_crud.get_member_location_logs_daily_summary(
            db, mt_idx, start_date, end_date, max_accuracy, min_speed
        )
        
        logger.info(f"Retrieved daily summary for member {mt_idx}: {len(summary_data)} days")
        
        return {
            "result": "Y",
            "data": summary_data,
            "total_days": len(summary_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting daily summary: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/stay-times")
async def get_member_stay_times(
    mt_idx: int,
    date: str = Query(..., description="분석할 날짜 (YYYY-MM-DD 형식)"),
    min_speed: float = Query(1.0, description="체류/이동 구분 기준 속도"),
    max_accuracy: float = Query(50.0, description="최대 정확도 값"),
    min_duration: int = Query(5, description="최소 체류시간(분)"),
    db: Session = Depends(get_db)
):
    """
    특정 회원의 특정 날짜 체류시간 분석 (GET 방식)
    제공된 복잡한 CTE 쿼리를 기반으로 구현된 API
    """
    try:
        logger.info(f"[GET] Stay times: mt_idx={mt_idx}, date={date}, min_speed={min_speed}")
        
        stay_times = location_log_crud.get_member_stay_times(
            db, mt_idx, date, min_speed, max_accuracy, min_duration
        )
        
        logger.info(f"Retrieved stay times for member {mt_idx} on {date}: {len(stay_times)} stays")
        
        return {
            "result": "Y",
            "data": stay_times,
            "total_stays": len(stay_times)
        }
        
    except Exception as e:
        logger.error(f"Error getting stay times: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/map-markers")
async def get_member_map_markers(
    mt_idx: int,
    date: str = Query(..., description="조회할 날짜 (YYYY-MM-DD 형식)"),
    min_speed: float = Query(1.0, description="최소 속도 값"),
    max_accuracy: float = Query(50.0, description="최대 정확도 값"),
    db: Session = Depends(get_db)
):
    """
    특정 회원의 특정 날짜 지도 마커용 이동로그 데이터 조회 (GET 방식)
    제공된 SQL 쿼리를 기반으로 구현된 API (데이터 샘플링 포함)
    """
    try:
        logger.info(f"[GET] Map markers API 호출: mt_idx={mt_idx}, date={date}, min_speed={min_speed}, max_ㅣaccuracy={max_accuracy}")
        
        map_markers = location_log_crud.get_member_map_markers(
            db, mt_idx, date, min_speed, max_accuracy
        )
        
        logger.info(f"[GET] Map markers API 응답: member={mt_idx}, date={date}, 마커 수={len(map_markers)}개")
        
        # 600건 넘는 경우 경고 로그
        if len(map_markers) > 600:
            logger.warning(f"[GET] Map markers 경고: {len(map_markers)}건으로 600건 초과! 샘플링 로직 확인 필요")
        
        return {
            "result": "Y",
            "data": map_markers,
            "total_markers": len(map_markers)
        }
        
    except Exception as e:
        logger.error(f"Error getting map markers: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-counts")
async def get_daily_location_counts(
    group_id: int = Query(..., description="그룹 ID"),
    days: int = Query(14, description="조회할 일수 (기본값: 14일)"),
    db: Session = Depends(get_db)
):
    """
    최근 N일간 그룹 멤버들의 일별 위치 기록 카운트를 반환합니다.
    """
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import func, and_, text
        from ....models.member import Member
        from ....models.group import Group
        from ....models.member_location_log import MemberLocationLog
        
        # 현재 날짜부터 N일 전까지의 날짜 범위 계산
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        logger.info(f"조회 기간: {start_date} ~ {end_date}, 그룹 ID: {group_id}")
        
        # 그룹 멤버 확인
        from ....models.group_detail import GroupDetail
        
        group_members = db.query(Member).join(
            GroupDetail, Member.mt_idx == GroupDetail.mt_idx
        ).filter(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N', 
            GroupDetail.sgdt_show == 'Y'
        ).all()
        
        if not group_members:
            logger.warning(f"그룹 {group_id}에 멤버가 없습니다.")
            return {"daily_counts": [], "total_days": days}
        
        member_ids = [member.mt_idx for member in group_members]
        
        # 일별 위치 기록 카운트 조회
        # SQL 쿼리로 직접 날짜별 카운트를 가져옴
        query = text("""
            SELECT 
                mt_idx as member_idx,
                DATE(mlt_gps_time) as log_date,
                COUNT(DISTINCT mlt_idx) as count
            FROM member_location_log_t 
            WHERE mt_idx IN :member_ids
            AND DATE(mlt_gps_time) BETWEEN :start_date AND :end_date
            GROUP BY mt_idx, DATE(mlt_gps_time)
            ORDER BY mt_idx, log_date DESC
        """)
        
        result = db.execute(query, {
            "member_ids": tuple(member_ids),
            "start_date": start_date,
            "end_date": end_date
        }).fetchall()
        
        # 결과를 딕셔너리로 변환 (멤버ID -> 날짜 -> 카운트)
        member_count_dict = {}
        for row in result:
            member_id = row.member_idx
            date_str = str(row.log_date)
            count = row.count
            
            if member_id not in member_count_dict:
                member_count_dict[member_id] = {}
            member_count_dict[member_id][date_str] = count
        
        # 멤버별 일별 카운트 데이터 생성
        member_daily_counts = []
        for member in group_members:
            member_counts = []
            current_date = end_date
            
            for i in range(days):
                date_str = str(current_date)
                count = member_count_dict.get(member.mt_idx, {}).get(date_str, 0)
                
                member_counts.append({
                    "date": date_str,
                    "count": count,
                    "formatted_date": current_date.strftime("%m.%d"),
                    "day_of_week": current_date.strftime("%a"),
                    "is_today": current_date == end_date,
                    "is_weekend": current_date.weekday() >= 5
                })
                
                current_date -= timedelta(days=1)
            
            member_daily_counts.append({
                "member_id": member.mt_idx,
                "member_name": member.mt_name,
                "member_photo": getattr(member, 'mt_file1', None),  # Member 모델에는 mt_file1이 실제 photo 필드
                "member_gender": getattr(member, 'mt_gender', None),
                "daily_counts": member_counts
            })
        
        # 전체 그룹의 일별 총 카운트도 계산 (기존 로직 유지)
        total_daily_counts = []
        current_date = end_date
        
        for i in range(days):
            date_str = str(current_date)
            total_count = sum(
                member_count_dict.get(member.mt_idx, {}).get(date_str, 0) 
                for member in group_members
            )
            
            total_daily_counts.append({
                "date": date_str,
                "count": total_count,
                "formatted_date": current_date.strftime("%m.%d"),
                "day_of_week": current_date.strftime("%a"),
                "is_today": current_date == end_date,
                "is_weekend": current_date.weekday() >= 5
            })
            
            current_date -= timedelta(days=1)
        
        logger.info(f"멤버별 일별 카운트 조회 완료: {len(member_daily_counts)}명, {days}일간 데이터")
        
        return {
            "member_daily_counts": member_daily_counts,
            "total_daily_counts": total_daily_counts,
            "total_days": days,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "group_id": group_id,
            "total_members": len(group_members)
        }
        
    except Exception as e:
        logger.error(f"일별 위치 기록 카운트 조회 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"일별 위치 기록 카운트 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/daily-counts-simple")
async def get_daily_location_counts_simple(
    group_id: int = Query(..., description="그룹 ID"),
    days: int = Query(14, description="조회할 일수 (기본값: 14일)"),
    db: Session = Depends(get_db)
):
    """
    멤버별 일별 위치 기록 카운트를 간단한 텍스트 형태로 반환합니다.
    """
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import func, and_, text
        from ....models.member import Member
        from ....models.group import Group
        from ....models.member_location_log import MemberLocationLog
        
        # 현재 날짜부터 N일 전까지의 날짜 범위 계산
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        logger.info(f"간단 조회 기간: {start_date} ~ {end_date}, 그룹 ID: {group_id}")
        
        # 그룹 멤버 확인
        from ....models.group_detail import GroupDetail
        
        group_members = db.query(Member).join(
            GroupDetail, Member.mt_idx == GroupDetail.mt_idx
        ).filter(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N', 
            GroupDetail.sgdt_show == 'Y'
        ).all()
        
        if not group_members:
            return {"message": f"그룹 {group_id}에 멤버가 없습니다."}
        
        member_ids = [member.mt_idx for member in group_members]
        
        # 일별 위치 기록 카운트 조회
        query = text("""
            SELECT 
                mt_idx as member_idx,
                DATE(mlt_gps_time) as log_date,
                COUNT(DISTINCT mlt_idx) as count
            FROM member_location_log_t 
            WHERE mt_idx IN :member_ids
            AND DATE(mlt_gps_time) BETWEEN :start_date AND :end_date
            GROUP BY mt_idx, DATE(mlt_gps_time)
            HAVING COUNT(DISTINCT mlt_idx) > 0
            ORDER BY mt_idx, log_date DESC
        """)
        
        result = db.execute(query, {
            "member_ids": tuple(member_ids),
            "start_date": start_date,
            "end_date": end_date
        }).fetchall()
        
        # 간단한 텍스트 형태로 변환
        simple_data = []
        for row in result:
            simple_data.append(f"{row.member_idx} {row.log_date} {row.count}")
        
        logger.info(f"간단 형태 데이터: {len(simple_data)}건")
        
        return {
            "simple_format": simple_data,
            "total_records": len(simple_data),
            "group_id": group_id,
            "date_range": f"{start_date} ~ {end_date}"
        }
        
    except Exception as e:
        logger.error(f"간단 일별 카운트 조회 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"간단 일별 카운트 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/member-activity")
async def get_member_activity_by_date(
    group_id: int = Query(..., description="그룹 ID"),
    date: str = Query(..., description="조회할 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 그룹 멤버별 위치 기록 활동을 반환합니다.
    """
    try:
        from datetime import datetime
        from sqlalchemy import func, and_
        from ....models.member import Member
        from ....models.group import Group
        from ....models.member_location_log import MemberLocationLog
        from ....models.group_detail import GroupDetail
        
        # 날짜 파싱
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        
        logger.info(f"멤버 활동 조회: {target_date}, 그룹 ID: {group_id}")
        
        # 그룹 멤버 조회
        group_members = db.query(Member).join(
            GroupDetail, Member.mt_idx == GroupDetail.mt_idx
        ).filter(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N', 
            GroupDetail.sgdt_show == 'Y'
        ).all()
        
        if not group_members:
            return {"member_activities": [], "date": date}
        
        member_activities = []
        
        for member in group_members:
            # 해당 날짜의 위치 기록 카운트
            count = db.query(MemberLocationLog).filter(
                and_(
                    MemberLocationLog.mlt_member_idx == member.mt_idx,
                    func.date(MemberLocationLog.mlt_gps_time) == target_date
                )
            ).count()
            
            # 첫 번째와 마지막 위치 기록 시간
            first_log = db.query(MemberLocationLog).filter(
                and_(
                    MemberLocationLog.mlt_member_idx == member.mt_idx,
                    func.date(MemberLocationLog.mlt_gps_time) == target_date
                )
            ).order_by(MemberLocationLog.mlt_gps_time.asc()).first()
            
            last_log = db.query(MemberLocationLog).filter(
                and_(
                    MemberLocationLog.mlt_member_idx == member.mt_idx,
                    func.date(MemberLocationLog.mlt_gps_time) == target_date
                )
            ).order_by(MemberLocationLog.mlt_gps_time.desc()).first()
            
            member_activities.append({
                "member_id": member.mt_idx,
                "member_name": member.mt_name,
                "member_photo": getattr(member, 'mt_file1', None),  # Member 모델에는 mt_file1이 실제 photo 필드
                "member_gender": getattr(member, 'mt_gender', None),
                "log_count": count,
                "first_log_time": first_log.mlt_gps_time.isoformat() if first_log else None,
                "last_log_time": last_log.mlt_gps_time.isoformat() if last_log else None,
                "is_active": count > 0
            })
        
        logger.info(f"멤버 활동 조회 완료: {len(member_activities)}명")
        
        return {
            "member_activities": member_activities,
            "date": date,
            "group_id": group_id,
            "total_members": len(group_members),
            "active_members": len([m for m in member_activities if m["is_active"]])
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용해주세요.")
    except Exception as e:
        logger.error(f"멤버 활동 조회 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"멤버 활동 조회 중 오류가 발생했습니다: {str(e)}"
        ) 