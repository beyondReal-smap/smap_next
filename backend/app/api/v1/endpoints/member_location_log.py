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
    LocationPathResponse
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