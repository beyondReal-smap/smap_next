import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
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
from ....core.config import settings
import jwt

router = APIRouter()
logger = logging.getLogger(__name__)

def _extract_token_from_header(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def _get_mt_idx_from_token(request: Request) -> Tuple[Optional[int], Optional[str]]:
    """Return (mt_idx, error_message). error_message is None when ok."""
    token = _extract_token_from_header(request)
    if not token:
        return None, "Authorization 헤더가 필요합니다 (Bearer 토큰)."
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        # mt_idx 먼저 확인, 없으면 sub 확인 (하위 호환)
        mt_idx = payload.get("mt_idx") or payload.get("sub")
        if not mt_idx:
            return None, "토큰에 mt_idx가 없습니다."
        return int(mt_idx), None
    except Exception as e:
        return None, f"토큰 검증 실패: {str(e)}"

@router.post("/member-location-logs")
async def handle_location_log_request(
    request: Request,
    db: Session = Depends(get_db)
):
    """위치 로그 관련 요청 처리"""
    # print("==== FastAPI /api/v1/member-location-logs 진입 ====")
    try:
        body = await request.json()
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
                
                return {"result": "Y", "data": path_data.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting location path: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "create_location_log":
            # 위치 로그 생성 (토큰 기반 사용자 식별 + 배치 전송 지원)
            try:
                # 토큰이 있으면 토큰 기반, 없으면 body의 mt_idx 사용
                token_mt_idx, token_err = _get_mt_idx_from_token(request)
                if token_err and not body.get("mt_idx"):
                    # 토큰도 없고 body에 mt_idx도 없으면 에러
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=token_err)
                
                # 토큰에서 mt_idx를 가져오거나 body에서 사용
                final_mt_idx = token_mt_idx if token_mt_idx else body.get("mt_idx")
                if not final_mt_idx:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mt_idx가 필요합니다 (토큰 또는 body)")

                # 동의(옵션): body 또는 헤더로 넘어오는 동의 플래그가 명시적으로 'N'이면 차단
                consent = (str(body.get("location_consent", "Y")).upper() != "N")
                if not consent:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="위치 정보 수집 동의가 필요합니다.")

                # 배치 전송 처리: mlt_gps_data 배열이 있으면 배치로 저장
                if isinstance(body.get("mlt_gps_data"), list) and body.get("mlt_gps_data"):
                    created = []
                    errors = []
                    for idx, item in enumerate(body["mlt_gps_data"]):
                        try:
                            single = {
                                "act": "create_location_log",  # 내부 검증용
                                "mt_idx": final_mt_idx,
                                "mlt_lat": item.get("mlt_lat"),
                                "mlt_long": item.get("mlt_long"),
                                "mlt_accuacy": item.get("mlt_accuracy") or item.get("mlt_accuacy"),  # 스키마에 맞게 mlt_accuacy 사용
                                "mlt_speed": item.get("mlt_speed"),
                                "mlt_altitude": item.get("mlt_altitude"),
                                # iOS 배치 필드명 호환: mlt_timestamp → mlt_gps_time (스키마 호환성)
                                "mlt_gps_time": item.get("mlt_timestamp") or item.get("mlt_gps_time"),
                                "source": body.get("source", "ios-app"),
                                "mlt_location_chk": item.get("mlt_location_chk"),
                                "mlt_fine_location": item.get("mlt_fine_location"),
                                "mlt_battery": item.get("mlt_battery"),
                                "mt_health_work": item.get("mt_health_work"),
                            }
                            log_data = MemberLocationLogCreate(**single)
                            result = location_log_crud.create_location_log(db, log_data)
                            created.append(result.to_dict())
                        except Exception as e:
                            logger.warning(f"Batch item {idx} failed: {str(e)}")
                            errors.append({"index": idx, "error": str(e)})
                    return {"result": "Y" if created else "N", "created_count": len(created), "errors": errors, "data": created[:10]}

                # 단건 처리
                # print(f"📍 [BACKEND] 위치 로그 생성 요청 수신 (단건):")
                # print(f"   📍 final_mt_idx: {final_mt_idx}")
                # print(f"   📍 위도: {body.get('mlt_lat')}")
                # print(f"   📍 경도: {body.get('mlt_long')}")
                
                body["mt_idx"] = final_mt_idx  # 토큰 또는 body의 mt_idx 사용
                
                # 필드명 매핑: mlt_timestamp -> mlt_gps_time (스키마 호환성)
                if "mlt_timestamp" in body and "mlt_gps_time" not in body:
                    body["mlt_gps_time"] = body["mlt_timestamp"]
                
                # mlt_accuracy 매핑 (오타 호환성)
                if "mlt_accuracy" in body and "mlt_accuacy" not in body:
                    body["mlt_accuacy"] = body["mlt_accuracy"]
                log_data = MemberLocationLogCreate(**body)
                result = location_log_crud.create_location_log(db, log_data)
                return {"result": "Y", "data": result.to_dict()}
            except HTTPException:
                raise
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
        
        elif act == "get_location_log_summary":
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
        
        # elif act == "create_location_log":
        #     # 새로운 위치 로그 생성 (iOS/Android에서 실시간 위치 전송용) - 중복 블록으로 주석 처리
        #     try:
        #         logger.info("=== create_location_log 액션 실행 ===")
        #         
        #         # 필수 파라미터 검증
        #         mt_idx = body.get("mt_idx")
        #         if not mt_idx:
        #             logger.error("mt_idx is required for create_location_log")
        #             raise HTTPException(status_code=400, detail="mt_idx is required")
        #         
        #         mlt_lat = body.get("mlt_lat")
        #         mlt_long = body.get("mlt_long")
        #         if mlt_lat is None or mlt_long is None:
        #             logger.error("mlt_lat and mlt_long are required")
        #             raise HTTPException(status_code=400, detail="mlt_lat and mlt_long are required")
        #         
        #         # 선택적 파라미터들
        #         mlt_accuracy = body.get("mlt_accuracy", 0)
        #         mlt_speed = body.get("mlt_speed", 0)
        #         mlt_altitude = body.get("mlt_altitude", 0)
        #         mlt_timestamp = body.get("mlt_timestamp")
        #         source = body.get("source", "unknown")
        #         
        #         logger.info(f"Creating location log for member {mt_idx}: lat={mlt_lat}, lng={mlt_long}, source={source}")
        #         
        #         # 위치 로그 생성 (실제 DB 저장 로직은 CRUD에서 구현)
        #         # 지금은 성공 응답만 반환 (추후 실제 DB 저장 로직 구현 가능)
        #         
        #         result_data = {
        #             "mt_idx": mt_idx,
        #             "location_saved": True,
        #             "coordinates": {
        #                 "latitude": mlt_lat,
        #                 "longitude": mlt_long
        #             },
        #             "metadata": {
        #                 "accuracy": mlt_accuracy,
        #                 "speed": mlt_speed,
        #                 "altitude": mlt_altitude,
        #                 "source": source,
        #                 "timestamp": mlt_timestamp or "auto-generated"
        #             },
        #             "saved_at": "2025-08-07T20:26:00Z"  # 현재 시간으로 교체 가능
        #         }
        #         
        #         logger.info(f"Location log created successfully for member {mt_idx}")
        #         return {"result": "Y", "data": result_data, "message": "위치 로그 생성 성공"}
        #         
        #     except Exception as e:
        #         logger.error(f"Error creating location log: {str(e)}")
        #         logger.error(traceback.format_exc())
        #         raise HTTPException(status_code=500, detail=str(e))
        
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
def get_member_location_logs(
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
def get_location_summary(
    mt_idx: int,
    date: Optional[str] = Query(None, description="특정 날짜 (YYYY-MM-DD 형식)"),
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    위치 로그 요약 정보 조회 (GET 방식)
    date 파라미터가 있으면 해당 날짜의 상세 요약을, 
    없으면 start_date/end_date 범위의 요약을 반환합니다.
    """
    try:
        if date:
            # iOS 앱 및 활동로그 페이지에서 사용하는 특정 날짜 요약 (PHP 로직 기반)
            summary = location_log_crud.get_location_log_summary(db, mt_idx, date)
            return {
                "result": "Y",
                "data": summary.model_dump(),
                "message": "위치 로그 요약 조회 성공"
            }
        else:
            # 기간별 기본 요약
            summary = location_log_crud.get_location_summary(db, mt_idx, start_date, end_date)
            return {"result": "Y", "data": summary.model_dump()}
    except Exception as e:
        logger.error(f"Error getting location summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/member-location-logs/{mt_idx}/path")
def get_location_path(
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
def get_daily_location_logs(
    mt_idx: int,
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    limit: int = Query(1000, description="조회할 로그 수"),
    offset: int = Query(0, description="건너뛸 로그 수"),
    db: Session = Depends(get_db)
):
    """특정 회원의 특정 날짜 위치 로그 조회 (GET 방식)"""
    try:
        logs = location_log_crud.get_member_location_logs_by_exact_date(
            db, mt_idx, date, limit, offset
        )
        
        result = [log.to_dict() for log in logs]
        return result
        
    except Exception as e:
        logger.error(f"Error getting daily location logs: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# 중복된 /summary 엔드포인트 제거 (위의 통합 엔드포인트로 대체됨)

@router.get("/member-location-logs/{mt_idx}/path")
def get_daily_location_path(
    mt_idx: int,
    date: str = Query(..., description="날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db)
):
    """특정 회원의 특정 날짜 위치 경로 데이터 조회 (GET 방식)"""
    try:
        path_data = location_log_crud.get_member_daily_location_path(
            db, mt_idx, date
        )
        
        return path_data
        
    except Exception as e:
        logger.error(f"Error getting daily location path: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/members-with-logs")
def get_members_with_logs(
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
def get_member_location_logs_daily_summary(
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
def get_member_stay_times(
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
def get_member_map_markers(
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
        if len(map_markers) > 200:
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
def get_daily_location_counts(
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
                "mt_nickname": getattr(member, 'mt_nickname', None), # Unified nickname field
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
def get_daily_location_counts_simple(
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
def get_member_activity_by_date(
    group_id: int = Query(..., description="그룹 ID"),
    date: str = Query(..., description="조회할 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 그룹 멤버별 위치 기록 활동을 반환합니다.
    """
    try:
        from datetime import datetime
        from sqlalchemy import func, and_, text
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
        
        # 모든 멤버의 데이터를 한 번의 쿼리로 조회 (성능 최적화)
        member_ids = [member.mt_idx for member in group_members]
        
        # 카운트 데이터를 한 번에 조회
        count_query = text("""
            SELECT mt_idx, COUNT(*) as log_count
            FROM member_location_log_t 
            WHERE mt_idx IN :member_ids
            AND DATE(mlt_gps_time) = :target_date
            GROUP BY mt_idx
        """)
        
        count_results = db.execute(count_query, {
            "member_ids": tuple(member_ids),
            "target_date": target_date
        }).fetchall()
        
        # 첫 번째와 마지막 로그 시간을 한 번에 조회
        time_query = text("""
            SELECT 
                mt_idx,
                MIN(mlt_gps_time) as first_log_time,
                MAX(mlt_gps_time) as last_log_time
            FROM member_location_log_t 
            WHERE mt_idx IN :member_ids
            AND DATE(mlt_gps_time) = :target_date
            GROUP BY mt_idx
        """)
        
        time_results = db.execute(time_query, {
            "member_ids": tuple(member_ids),
            "target_date": target_date
        }).fetchall()
        
        # 결과를 딕셔너리로 변환
        count_dict = {row.mt_idx: row.log_count for row in count_results}
        time_dict = {row.mt_idx: {"first": row.first_log_time, "last": row.last_log_time} for row in time_results}
        
        member_activities = []
        for member in group_members:
            count = count_dict.get(member.mt_idx, 0)
            time_data = time_dict.get(member.mt_idx, {"first": None, "last": None})
            
            member_activities.append({
                "member_id": member.mt_idx,
                "member_name": member.mt_name,
                "mt_nickname": getattr(member, 'mt_nickname', None), # Unified nickname field
                "member_photo": getattr(member, 'mt_file1', None),
                "member_gender": getattr(member, 'mt_gender', None),
                "log_count": count,
                "first_log_time": time_data["first"].isoformat() if time_data["first"] else None,
                "last_log_time": time_data["last"].isoformat() if time_data["last"] else None,
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