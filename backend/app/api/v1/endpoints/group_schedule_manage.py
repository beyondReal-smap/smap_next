from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
from app.api import deps
from app.models.schedule import Schedule
from app.models.member import Member
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class GroupScheduleManager:
    """그룹 스케줄 관리 클래스"""
    
    @staticmethod
    def check_group_permission(db: Session, user_id: int, group_id: int) -> Optional[Dict[str, Any]]:
        """그룹 권한 확인"""
        try:
            query = text("""
                SELECT 
                    m.mt_idx,
                    m.mt_name,
                    sgd.sgt_idx,
                    sgd.sgdt_idx,
                    sgd.sgdt_owner_chk,
                    sgd.sgdt_leader_chk,
                    sgd.sgdt_discharge,
                    sgd.sgdt_exit
                FROM member_t m
                JOIN smap_group_detail_t sgd ON m.mt_idx = sgd.mt_idx
                JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
                WHERE m.mt_idx = :user_id 
                    AND sgd.sgt_idx = :group_id 
                    AND sgd.sgdt_discharge = 'N' 
                    AND sgd.sgdt_exit = 'N'
                    AND sg.sgt_show = 'Y'
            """)
            
            result = db.execute(query, {"user_id": user_id, "group_id": group_id}).fetchone()
            
            if result:
                return {
                    "mt_idx": result.mt_idx,
                    "mt_name": result.mt_name,
                    "sgt_idx": result.sgt_idx,
                    "sgdt_idx": result.sgdt_idx,
                    "sgdt_owner_chk": result.sgdt_owner_chk,
                    "sgdt_leader_chk": result.sgdt_leader_chk,
                    "sgdt_discharge": result.sgdt_discharge,
                    "sgdt_exit": result.sgdt_exit
                }
            return None
        except Exception as e:
            logger.error(f"그룹 권한 확인 오류: {e}")
            return None
    
    @staticmethod
    def has_manage_permission(member_auth: Dict[str, Any]) -> bool:
        """관리 권한 확인"""
        return member_auth.get("sgdt_owner_chk") == "Y" or member_auth.get("sgdt_leader_chk") == "Y"
    
    @staticmethod
    def get_group_members(db: Session, group_id: int) -> List[Dict[str, Any]]:
        """그룹 멤버 목록 조회"""
        try:
            query = text("""
                SELECT 
                    m.mt_idx,
                    m.mt_name,
                    m.mt_file1,
                    sgd.sgt_idx,
                    sgd.sgdt_idx,
                    sgd.sgdt_owner_chk,
                    sgd.sgdt_leader_chk
                FROM member_t m
                JOIN smap_group_detail_t sgd ON m.mt_idx = sgd.mt_idx
                WHERE sgd.sgt_idx = :group_id 
                    AND sgd.sgdt_discharge = 'N' 
                    AND sgd.sgdt_exit = 'N'
            """)
            
            results = db.execute(query, {"group_id": group_id}).fetchall()
            
            return [
                {
                    "mt_idx": row.mt_idx,
                    "mt_name": row.mt_name,
                    "mt_file1": row.mt_file1,
                    "sgt_idx": row.sgt_idx,
                    "sgdt_idx": row.sgdt_idx,
                    "sgdt_owner_chk": row.sgdt_owner_chk,
                    "sgdt_leader_chk": row.sgdt_leader_chk
                }
                for row in results
            ]
        except Exception as e:
            logger.error(f"그룹 멤버 조회 오류: {e}")
            return []

@router.get("/test-all-columns")
def test_all_columns(
    current_user_id: int = Query(1186, description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    모든 컬럼 테스트용 엔드포인트
    """
    try:
        # 단일 스케줄만 조회하여 모든 컬럼 확인
        schedule_query = text("""
            SELECT sst.* 
            FROM smap_schedule_t sst
            WHERE sst.mt_idx = :current_user_id 
            AND sst.sst_show = 'Y'
            LIMIT 1
        """)
        
        result = db.execute(schedule_query, {"current_user_id": current_user_id}).fetchone()
        
        if not result:
            return {"success": False, "message": "No schedule found"}
        
        # 모든 컬럼을 딕셔너리로 변환
        schedule_data = {
            "sst_idx": result.sst_idx,
            "sst_pidx": result.sst_pidx,
            "mt_idx": result.mt_idx,
            "sst_title": result.sst_title,
            "sst_sdate": str(result.sst_sdate) if result.sst_sdate else None,
            "sst_edate": str(result.sst_edate) if result.sst_edate else None,
            "sst_sedate": result.sst_sedate,
            "sst_all_day": result.sst_all_day,
            "sst_repeat_json": result.sst_repeat_json,
            "sst_repeat_json_v": result.sst_repeat_json_v,
            "sgt_idx": result.sgt_idx,
            "sgdt_idx": result.sgdt_idx,
            "sgdt_idx_t": result.sgdt_idx_t,
            "sst_alram": result.sst_alram,
            "sst_alram_t": result.sst_alram_t,
            "sst_adate": str(result.sst_adate) if result.sst_adate else None,
            "slt_idx": result.slt_idx,
            "slt_idx_t": result.slt_idx_t,
            "sst_location_title": result.sst_location_title,
            "sst_location_add": result.sst_location_add,
            "sst_location_lat": float(result.sst_location_lat) if result.sst_location_lat else None,
            "sst_location_long": float(result.sst_location_long) if result.sst_location_long else None,
            "sst_supplies": result.sst_supplies,
            "sst_memo": result.sst_memo,
            "sst_show": result.sst_show,
            "sst_location_alarm": result.sst_location_alarm,
            "sst_schedule_alarm_chk": result.sst_schedule_alarm_chk,
            "sst_pick_type": result.sst_pick_type,
            "sst_pick_result": result.sst_pick_result,
            "sst_schedule_alarm": str(result.sst_schedule_alarm) if result.sst_schedule_alarm else None,
            "sst_update_chk": result.sst_update_chk,
            "sst_wdate": str(result.sst_wdate) if result.sst_wdate else None,
            "sst_udate": str(result.sst_udate) if result.sst_udate else None,
            "sst_ddate": str(result.sst_ddate) if result.sst_ddate else None,
            "sst_in_chk": result.sst_in_chk,
            "sst_schedule_chk": result.sst_schedule_chk,
            "sst_entry_cnt": result.sst_entry_cnt,
            "sst_exit_cnt": result.sst_exit_cnt,
        }
        
        return {
            "success": True,
            "data": schedule_data,
            "total_columns": len(schedule_data),
            "column_names": list(schedule_data.keys())
        }
        
    except Exception as e:
        logger.error(f"테스트 엔드포인트 오류: {e}")
        return {"success": False, "error": str(e)}

@router.get("/owner-groups/all-schedules")
def get_owner_groups_all_schedules(
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    year: Optional[int] = Query(None, description="조회할 년도 (예: 2024)"),
    month: Optional[int] = Query(None, description="조회할 월 (1-12)"),
    db: Session = Depends(deps.get_db)
):
    """
    현재 사용자가 오너인 그룹들의 모든 멤버 스케줄을 월별로 조회합니다.
    사용자의 최근 위치와 각 스케줄 위치 간의 거리를 계산합니다.
    """
    try:
        # 기본값 설정 (현재 년월)
        from datetime import datetime
        now = datetime.now()
        
        # 요청 파라미터 로깅 및 안전한 복사
        request_year = year
        request_month = month
        print(f"[DEBUG] 원본 파라미터 - year: {request_year}, month: {request_month}")
        
        # 기본값 설정 (원본 파라미터를 변경하지 않고 새 변수 사용)
        final_year = request_year if request_year is not None else now.year
        final_month = request_month if request_month is not None else now.month
        
        print(f"[DEBUG] 처리 후 파라미터 - final_year: {final_year}, final_month: {final_month}")
        
        # 월의 시작일과 마지막일 계산
        if final_month == 12:
            next_year = final_year + 1
            next_month = 1
        else:
            next_year = final_year
            next_month = final_month + 1
            
        start_date = f"{final_year}-{final_month:02d}-01"
        end_date = f"{next_year}-{next_month:02d}-01"
        
        print(f"[DEBUG] 날짜 계산 결과 - start_date: {start_date}, end_date: {end_date}")
        print(f"[DEBUG] next_year: {next_year}, next_month: {next_month}")
        
        # 단계 0: 사용자의 최근 위치 조회
        user_location_query = text("""
            SELECT mlt_lat, mlt_long
            FROM member_location_log_t
            WHERE mt_idx = :current_user_id
            ORDER BY mlt_idx DESC
            LIMIT 1
        """)
        
        user_location = db.execute(user_location_query, {"current_user_id": current_user_id}).fetchone()
        user_lat = None
        user_lng = None
        
        if user_location:
            user_lat = float(user_location.mlt_lat) if user_location.mlt_lat else None
            user_lng = float(user_location.mlt_long) if user_location.mlt_long else None
            print(f"[DEBUG] 사용자 최근 위치: lat={user_lat}, lng={user_lng}")
        else:
            print(f"[DEBUG] 사용자 {current_user_id}의 위치 정보 없음")
        
        # 단계 1: 현재 사용자 그룹 목록 먼저 조회
        owner_groups_query = text("""
            SELECT sg.sgt_idx, sg.sgt_title, sgd.sgdt_idx, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk, sgd.mt_idx
            FROM smap_group_t sg
            JOIN smap_group_detail_t sgd ON sg.sgt_idx = sgd.sgt_idx
            WHERE sgd.mt_idx = :current_user_id 
            AND sg.sgt_show = 'Y'
        """)
        
        owner_groups = db.execute(owner_groups_query, {"current_user_id": current_user_id}).fetchall()
        
        groups = [
            {
                "sgt_idx": group.sgt_idx,
                "sgt_title": group.sgt_title,
                "sgdt_idx": group.sgdt_idx,
                "sgdt_owner_chk": group.sgdt_owner_chk,
                "sgdt_leader_chk": group.sgdt_leader_chk,
                "mt_idx": group.mt_idx
            }
            for group in owner_groups
        ]
        
        # 단계 2: 오너 그룹이 있는 경우에만 스케줄 조회
        schedules = []
        if groups:
            # 그룹 ID 목록 생성
            group_ids = [str(group["sgt_idx"]) for group in groups]
            group_ids_str = ",".join(group_ids)
            
            # 거리 계산 포함 스케줄 조회 쿼리
            distance_calc = ""
            if user_lat is not None and user_lng is not None:
                distance_calc = f"""
                    CASE 
                        WHEN sst.sst_location_lat IS NOT NULL AND sst.sst_location_long IS NOT NULL THEN
                            6371 * acos(
                                cos(radians({user_lat})) * cos(radians(sst.sst_location_lat)) * 
                                cos(radians(sst.sst_location_long) - radians({user_lng})) + 
                                sin(radians({user_lat})) * sin(radians(sst.sst_location_lat))
                            )
                        ELSE NULL
                    END AS sch_calc_dist,
                """
            else:
                distance_calc = "NULL AS sch_calc_dist,"
            
            schedule_query = text(f"""
                SELECT
                    sst.*,
                    {distance_calc}
                    m.mt_name as member_name,
                    m.mt_file1 as member_photo,
                    sg.sgt_title as group_title,
                    sgd_target.mt_idx as tgt_mt_idx,
                    sgd_target.sgdt_owner_chk as tgt_sgdt_owner_chk,
                    sgd_target.sgdt_leader_chk as tgt_sgdt_leader_chk
                FROM
                    smap_schedule_t sst
                JOIN member_t m ON sst.mt_idx = m.mt_idx
                JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
                LEFT JOIN smap_group_detail_t sgd_target ON sst.sgdt_idx = sgd_target.sgdt_idx
                WHERE
                    sst.sgt_idx IN ({group_ids_str})
                    AND sst.sst_show = 'Y'
                    AND sst.sst_sdate >= :start_date
                    AND sst.sst_sdate < :end_date
                ORDER BY
                    sst.sst_sdate
                LIMIT 100
            """)
            
            schedule_results = db.execute(schedule_query, {
                "start_date": start_date,
                "end_date": end_date
            }).fetchall()
            
            # 스케줄 데이터 변환 (모든 컬럼 포함)
            for row in schedule_results:
                schedule_data = {
                    # 모든 smap_schedule_t 컬럼
                    "sst_idx": row.sst_idx,
                    "sst_pidx": row.sst_pidx,
                    "mt_idx": row.mt_idx,
                    "sst_title": row.sst_title,
                    "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                    "sst_edate": str(row.sst_edate) if row.sst_edate else None,
                    "sst_sedate": row.sst_sedate,
                    "sst_all_day": row.sst_all_day,
                    "sst_repeat_json": row.sst_repeat_json,
                    "sst_repeat_json_v": row.sst_repeat_json_v,
                    "sgt_idx": row.sgt_idx,
                    "sgdt_idx": row.sgdt_idx,
                    "sgdt_idx_t": row.sgdt_idx_t,
                    "sst_alram": row.sst_alram,
                    "sst_alram_t": row.sst_alram_t,
                    "sst_adate": str(row.sst_adate) if row.sst_adate else None,
                    "slt_idx": row.slt_idx,
                    "slt_idx_t": row.slt_idx_t,
                    "sst_location_title": row.sst_location_title,
                    "sst_location_add": row.sst_location_add,
                    "sst_location_lat": float(row.sst_location_lat) if row.sst_location_lat else None,
                    "sst_location_long": float(row.sst_location_long) if row.sst_location_long else None,
                    "sst_supplies": row.sst_supplies,
                    "sst_memo": row.sst_memo,
                    "sst_show": row.sst_show,
                    "sst_location_alarm": row.sst_location_alarm,
                    "sst_schedule_alarm_chk": row.sst_schedule_alarm_chk,
                    "sst_pick_type": row.sst_pick_type,
                    "sst_pick_result": row.sst_pick_result,
                    "sst_schedule_alarm": str(row.sst_schedule_alarm) if row.sst_schedule_alarm else None,
                    "sst_update_chk": row.sst_update_chk,
                    "sst_wdate": str(row.sst_wdate) if row.sst_wdate else None,
                    "sst_udate": str(row.sst_udate) if row.sst_udate else None,
                    "sst_ddate": str(row.sst_ddate) if row.sst_ddate else None,
                    "sst_in_chk": row.sst_in_chk,
                    "sst_schedule_chk": row.sst_schedule_chk,
                    "sst_entry_cnt": row.sst_entry_cnt,
                    "sst_exit_cnt": row.sst_exit_cnt,
                    # 거리 계산 결과
                    "sch_calc_dist": round(float(row.sch_calc_dist), 2) if row.sch_calc_dist is not None else None,
                    # JOIN된 추가 정보
                    "member_name": row.member_name,
                    "member_photo": row.member_photo,
                    "group_title": row.group_title,
                    # 타겟 멤버 ID 추가 (sgdt_idx로 조회한 mt_idx)
                    "tgt_mt_idx": row.tgt_mt_idx,
                    "tgt_sgdt_owner_chk": row.tgt_sgdt_owner_chk,
                    "tgt_sgdt_leader_chk": row.tgt_sgdt_leader_chk,
                    # 프론트엔드 호환성을 위한 추가 필드
                    "id": str(row.sst_idx),
                    "title": row.sst_title,
                    "date": str(row.sst_sdate) if row.sst_sdate else None,
                    "location": row.sst_location_title,
                    "memberId": str(row.mt_idx)
                }
                schedules.append(schedule_data)
        
        return {
            "success": True,
            "data": {
                "schedules": schedules,
                "ownerGroups": groups,
                "totalSchedules": len(schedules),
                "queryPeriod": {
                    "year": final_year,
                    "month": final_month,
                    "startDate": start_date,
                    "endDate": end_date
                },
                "debugInfo": {
                    "originalYear": request_year,
                    "originalMonth": request_month,
                    "finalYear": final_year,
                    "finalMonth": final_month,
                    "nextYear": next_year,
                    "nextMonth": next_month,
                    "calculatedStartDate": start_date,
                    "calculatedEndDate": end_date
                },
                "userLocation": {
                    "lat": user_lat,
                    "lng": user_lng
                } if user_lat is not None and user_lng is not None else None,
                "userPermission": {
                    "canManage": True,  # 오너이므로 모든 스케줄 관리 가능
                    "isOwner": True,
                    "isLeader": False
                }
            }
        }
        
    except Exception as e:
        logger.error(f"오너 그룹 전체 스케줄 조회 오류: {e}")
        import traceback
        logger.error(f"상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/group/{group_id}/schedules")
def get_group_schedules(
    group_id: int,
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    member_id: Optional[int] = Query(None, description="특정 멤버 ID"),
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 조회 (권한 기반)
    """
    try:
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 그룹 멤버 목록 조회
        group_members = GroupScheduleManager.get_group_members(db, group_id)
        
        # 스케줄 조회 쿼리 구성
        query_params = {"group_id": group_id}
        where_conditions = ["s.sgt_idx = :group_id", "s.sst_show = 'Y'"]
        
        # 날짜 범위 조건 추가
        if start_date:
            where_conditions.append("s.sst_sdate >= :start_date")
            query_params["start_date"] = start_date
        
        if end_date:
            where_conditions.append("s.sst_edate <= :end_date")
            query_params["end_date"] = end_date
        
        # 특정 멤버 조건 추가
        if member_id:
            where_conditions.append("s.mt_idx = :member_id")
            query_params["member_id"] = member_id
        
        schedule_query = text(f"""
            SELECT 
                s.*,
                m.mt_name as member_name,
                m.mt_file1 as member_photo
            FROM smap_schedule_t s
            JOIN member_t m ON s.mt_idx = m.mt_idx
            WHERE {' AND '.join(where_conditions)}
            ORDER BY s.sst_sdate ASC
        """)
        
        schedule_results = db.execute(schedule_query, query_params).fetchall()
        
        # 스케줄 데이터 변환
        schedules = []
        for row in schedule_results:
            schedule_data = {
                "sst_idx": row.sst_idx,
                "sst_pidx": row.sst_pidx,
                "mt_idx": row.mt_idx,
                "sst_title": row.sst_title,
                "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                "sst_edate": str(row.sst_edate) if row.sst_edate else None,
                "sst_sedate": row.sst_sedate,
                "sst_all_day": row.sst_all_day,
                "sst_repeat_json": row.sst_repeat_json,
                "sst_repeat_json_v": row.sst_repeat_json_v,
                "sgt_idx": row.sgt_idx,
                "sgdt_idx": row.sgdt_idx,
                "sgdt_idx_t": row.sgdt_idx_t,
                "sst_alram": row.sst_alram,
                "sst_alram_t": row.sst_alram_t,
                "sst_adate": row.sst_adate.isoformat() if row.sst_adate else None,
                "slt_idx": row.slt_idx,
                "slt_idx_t": row.slt_idx_t,
                "sst_location_title": row.sst_location_title,
                "sst_location_add": row.sst_location_add,
                "sst_location_lat": float(row.sst_location_lat) if row.sst_location_lat else None,
                "sst_location_long": float(row.sst_location_long) if row.sst_location_long else None,
                "sst_supplies": row.sst_supplies,
                "sst_memo": row.sst_memo,
                "sst_show": row.sst_show,
                "sst_location_alarm": row.sst_location_alarm,
                "sst_schedule_alarm_chk": row.sst_schedule_alarm_chk,
                "sst_pick_type": row.sst_pick_type,
                "sst_pick_result": row.sst_pick_result,
                "sst_schedule_alarm": row.sst_schedule_alarm.isoformat() if row.sst_schedule_alarm else None,
                "sst_update_chk": row.sst_update_chk,
                "sst_wdate": row.sst_wdate.isoformat() if row.sst_wdate else None,
                "sst_udate": row.sst_udate.isoformat() if row.sst_udate else None,
                "sst_ddate": row.sst_ddate.isoformat() if row.sst_ddate else None,
                "sst_in_chk": row.sst_in_chk,
                "sst_schedule_chk": row.sst_schedule_chk,
                "sst_entry_cnt": row.sst_entry_cnt,
                "sst_exit_cnt": row.sst_exit_cnt,
                "member_name": row.member_name,
                "member_photo": row.member_photo,
                # 프론트엔드 호환성을 위한 추가 필드
                "id": str(row.sst_idx),
                "title": row.sst_title,
                "date": str(row.sst_sdate) if row.sst_sdate else None,
                "location": row.sst_location_title,
                "memberId": str(row.mt_idx)
            }
            schedules.append(schedule_data)
        
        return {
            "success": True,
            "data": {
                "schedules": schedules,
                "groupMembers": group_members,
                "userPermission": {
                    "canManage": GroupScheduleManager.has_manage_permission(member_auth),
                    "isOwner": member_auth.get("sgdt_owner_chk") == "Y",
                    "isLeader": member_auth.get("sgdt_leader_chk") == "Y"
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"그룹 스케줄 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/group/{group_id}/schedules")
def create_group_schedule(
    group_id: int,
    schedule_data: Dict[str, Any],
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 생성 (향상된 PHP 로직 기반)
    """
    try:
        logger.info(f"🔥 [CREATE_SCHEDULE] 스케줄 생성 시작 - group_id: {group_id}, user_id: {current_user_id}")
        logger.info(f"📝 [CREATE_SCHEDULE] 원본 요청 데이터: {schedule_data}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            logger.error(f"❌ [CREATE_SCHEDULE] 그룹 권한 없음 - group_id: {group_id}, user_id: {current_user_id}")
            raise HTTPException(status_code=403, detail="Group access denied")
        
        logger.info(f"✅ [CREATE_SCHEDULE] 그룹 권한 확인 완료 - member_auth: {member_auth}")
        
        # 대상 멤버 설정 (기본값: 현재 사용자)
        target_member_id = current_user_id
        
        # 다른 멤버의 스케줄을 생성하려는 경우
        if "targetMemberId" in schedule_data and schedule_data["targetMemberId"]:
            target_member_id = int(schedule_data["targetMemberId"])
            logger.info(f"👤 [CREATE_SCHEDULE] 다른 멤버 스케줄 생성 요청 - target_member_id: {target_member_id}")
            
            # 권한 확인: 오너/리더만 다른 멤버의 스케줄 생성 가능
            if not GroupScheduleManager.has_manage_permission(member_auth):
                logger.error(f"❌ [CREATE_SCHEDULE] 다른 멤버 스케줄 생성 권한 없음 - user_id: {current_user_id}")
                raise HTTPException(
                    status_code=403, 
                    detail="Only group owners or leaders can create schedules for other members"
                )
            
            # 대상 멤버가 같은 그룹에 속하는지 확인
            target_member_auth = GroupScheduleManager.check_group_permission(db, target_member_id, group_id)
            if not target_member_auth:
                logger.error(f"❌ [CREATE_SCHEDULE] 대상 멤버가 같은 그룹에 속하지 않음 - target_member_id: {target_member_id}")
                raise HTTPException(status_code=400, detail="Target member is not in the same group")
        
        logger.info(f"👤 [CREATE_SCHEDULE] 최종 대상 멤버: {target_member_id}")
        
        # 필수 필드 검증 및 기본값 설정 (PHP 로직 참고)
        if not schedule_data.get('sst_title', '').strip():
            schedule_data['sst_title'] = '제목 없음'
            logger.warning(f"⚠️ [CREATE_SCHEDULE] 제목이 비어있어 기본값으로 설정")
            
        if not schedule_data.get('sst_sdate'):
            logger.error(f"❌ [CREATE_SCHEDULE] 시작 날짜가 없음")
            raise HTTPException(status_code=400, detail="Start date is required")
            
        if not schedule_data.get('sst_edate'):
            schedule_data['sst_edate'] = schedule_data['sst_sdate']
            logger.info(f"📅 [CREATE_SCHEDULE] 종료 날짜가 없어 시작 날짜로 설정")
        
        logger.info(f"📝 [CREATE_SCHEDULE] 필수 필드 검증 완료 - title: {schedule_data['sst_title']}")
        
        # 시작/종료 날짜/시간 처리 (PHP 로직 참고)
        sst_sdate = schedule_data['sst_sdate']
        sst_edate = schedule_data['sst_edate']
        
        logger.info(f"📅 [CREATE_SCHEDULE] 원본 날짜/시간 - sdate: {sst_sdate}, edate: {sst_edate}")
        
        # 시간이 포함되지 않은 경우 시간 추가
        if 'T' not in sst_sdate and ':' not in sst_sdate:
            sst_stime = schedule_data.get('sst_stime', '00:00:00')
            sst_sdate = f"{sst_sdate}T{sst_stime}" if 'T' not in sst_stime else f"{sst_sdate} {sst_stime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 시작 시간 추가 - 결과: {sst_sdate}")
            
        if 'T' not in sst_edate and ':' not in sst_edate:
            sst_etime = schedule_data.get('sst_etime', '23:59:59')
            sst_edate = f"{sst_edate}T{sst_etime}" if 'T' not in sst_etime else f"{sst_edate} {sst_etime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 종료 시간 추가 - 결과: {sst_edate}")
        
        # 하루종일 및 반복 설정 처리 (사용자 요구사항에 맞게)
        sst_all_day = schedule_data.get('sst_all_day', 'N')
        sst_repeat_json = schedule_data.get('sst_repeat_json', '')
        sst_repeat_json_v = schedule_data.get('sst_repeat_json_v', '')
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 원본 반복 설정 - all_day: {sst_all_day}, repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 하루종일인 경우 반복을 null로 설정
        if sst_all_day == 'Y':
            sst_repeat_json = ''
            sst_repeat_json_v = ''
            logger.info("🔄 [CREATE_SCHEDULE] 하루종일 이벤트: 반복 설정을 null로 변경")
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 최종 반복 설정 - repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 알림 시간 계산 (PHP 로직 참고)
        sst_schedule_alarm = None
        logger.info(f"🔔 [CREATE_SCHEDULE] 알림 설정 시작 - alarm_chk: {schedule_data.get('sst_schedule_alarm_chk')}, pick_type: {schedule_data.get('sst_pick_type')}, pick_result: {schedule_data.get('sst_pick_result')}")
        
        if (schedule_data.get('sst_schedule_alarm_chk') == 'Y' and 
            schedule_data.get('sst_pick_type') and 
            schedule_data.get('sst_pick_result')):
            
            try:
                from datetime import datetime, timedelta
                start_datetime = datetime.fromisoformat(sst_sdate.replace('T', ' '))
                pick_result = int(schedule_data['sst_pick_result'])
                pick_type = schedule_data['sst_pick_type']
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 알림 시간 계산 - start_datetime: {start_datetime}, pick_result: {pick_result}, pick_type: {pick_type}")
                
                if pick_type == 'minute':
                    sst_schedule_alarm = start_datetime - timedelta(minutes=pick_result)
                elif pick_type == 'hour':
                    sst_schedule_alarm = start_datetime - timedelta(hours=pick_result)
                elif pick_type == 'day':
                    sst_schedule_alarm = start_datetime - timedelta(days=pick_result)
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 계산된 알림 시간: {sst_schedule_alarm}")
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ [CREATE_SCHEDULE] 알림 시간 계산 실패: {e}")
                sst_schedule_alarm = None

        # 스케줄 생성 쿼리 (PHP의 모든 필드 지원)
        logger.info(f"💾 [CREATE_SCHEDULE] 데이터베이스 삽입 시작")
        
        insert_query = text("""
            INSERT INTO smap_schedule_t (
                mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
                sgt_idx, sgdt_idx, sgdt_idx_t,
                sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
                sst_location_alarm, sst_location_detail,
                sst_memo, sst_supplies, sst_content, sst_place,
                sst_alram, sst_alram_t, sst_schedule_alarm_chk, 
                sst_pick_type, sst_pick_result, sst_schedule_alarm,
                sst_repeat_json, sst_repeat_json_v,
                slt_idx, slt_idx_t, sst_update_chk,
                sst_show, sst_wdate, sst_adate
            ) VALUES (
                :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_sedate, :sst_all_day,
                :sgt_idx, :sgdt_idx, :sgdt_idx_t,
                :sst_location_title, :sst_location_add, :sst_location_lat, :sst_location_long,
                :sst_location_alarm, :sst_location_detail,
                :sst_memo, :sst_supplies, :sst_content, :sst_place,
                :sst_alram, :sst_alram_t, :sst_schedule_alarm_chk,
                :sst_pick_type, :sst_pick_result, :sst_schedule_alarm,
                :sst_repeat_json, :sst_repeat_json_v,
                :slt_idx, :slt_idx_t, :sst_update_chk,
                'Y', NOW(), :sst_adate
            )
        """)
        
        insert_params = {
            "mt_idx": target_member_id,
            "sst_title": schedule_data.get('sst_title'),
            "sst_sdate": sst_sdate,
            "sst_edate": sst_edate,
            "sst_sedate": f"{sst_sdate} ~ {sst_edate}",
            "sst_all_day": sst_all_day,
            "sgt_idx": group_id,
            "sgdt_idx": member_auth["sgdt_idx"],
            "sgdt_idx_t": schedule_data.get("sgdt_idx_t"),
            "sst_location_title": schedule_data.get("sst_location_title"),
            "sst_location_add": schedule_data.get("sst_location_add"),
            "sst_location_lat": schedule_data.get("sst_location_lat"),
            "sst_location_long": schedule_data.get("sst_location_long"),
            "sst_location_alarm": schedule_data.get("sst_location_alarm", "N"),
            "sst_location_detail": schedule_data.get("sst_location_detail"),
            "sst_memo": schedule_data.get("sst_memo"),
            "sst_supplies": schedule_data.get("sst_supplies"),
            "sst_content": schedule_data.get("sst_content"),
            "sst_place": schedule_data.get("sst_place"),
            "sst_alram": schedule_data.get("sst_alram", "N"),
            "sst_alram_t": schedule_data.get("sst_alram_t"),
            "sst_schedule_alarm_chk": schedule_data.get("sst_schedule_alarm_chk", "N"),
            "sst_pick_type": schedule_data.get("sst_pick_type"),
            "sst_pick_result": schedule_data.get("sst_pick_result"),
            "sst_schedule_alarm": sst_schedule_alarm.strftime('%Y-%m-%d %H:%M:%S') if sst_schedule_alarm else None,
            "sst_repeat_json": sst_repeat_json,
            "sst_repeat_json_v": sst_repeat_json_v,
            "slt_idx": schedule_data.get("slt_idx"),
            "slt_idx_t": schedule_data.get("sst_location_add"), # PHP에서 location_add를 slt_idx_t로 사용
            "sst_update_chk": schedule_data.get("sst_update_chk", "Y"),
            "sst_adate": schedule_data.get("sst_adate")
        }
        
        logger.info(f"💾 [CREATE_SCHEDULE] 삽입 파라미터:")
        for key, value in insert_params.items():
            logger.info(f"    {key}: {value}")
        
        result = db.execute(insert_query, insert_params)
        db.commit()
        
        new_schedule_id = result.lastrowid
        logger.info(f"✅ [CREATE_SCHEDULE] 스케줄 생성 성공: schedule_id={new_schedule_id}, user_id={current_user_id}, target_user_id={target_member_id}")
        
        return {
            "success": True,
            "data": {
                "sst_idx": new_schedule_id,
                "message": "Schedule created successfully",
                "target_member_id": target_member_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [CREATE_SCHEDULE] 스케줄 생성 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/group/{group_id}/schedules/{schedule_id}")
def update_group_schedule(
    group_id: int,
    schedule_id: int,
    schedule_data: Dict[str, Any],
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 수정 (향상된 PHP 로직 기반)
    """
    try:
        logger.info(f"🔥 [UPDATE_SCHEDULE] 스케줄 수정 시작 - group_id: {group_id}, schedule_id: {schedule_id}, user_id: {current_user_id}")
        logger.info(f"📝 [UPDATE_SCHEDULE] 원본 요청 데이터: {schedule_data}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            logger.error(f"❌ [UPDATE_SCHEDULE] 그룹 권한 없음 - group_id: {group_id}, user_id: {current_user_id}")
            raise HTTPException(status_code=403, detail="Group access denied")
        
        logger.info(f"✅ [UPDATE_SCHEDULE] 그룹 권한 확인 완료 - member_auth: {member_auth}")
        
        # 기존 스케줄 조회
        schedule_query = text("""
            SELECT * FROM smap_schedule_t 
            WHERE sst_idx = :schedule_id AND sst_show = 'Y'
        """)
        
        schedule_result = db.execute(schedule_query, {"schedule_id": schedule_id}).fetchone()
        
        if not schedule_result:
            logger.error(f"❌ [UPDATE_SCHEDULE] 스케줄을 찾을 수 없음 - schedule_id: {schedule_id}")
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        logger.info(f"📅 [UPDATE_SCHEDULE] 기존 스케줄 확인 - 소유자: {schedule_result.mt_idx}, 제목: {schedule_result.sst_title}")
        
        # 권한 확인: 본인 스케줄이거나 오너/리더인 경우만 수정 가능
        can_edit = (
            schedule_result.mt_idx == current_user_id or 
            GroupScheduleManager.has_manage_permission(member_auth)
        )
        
        logger.info(f"👤 [UPDATE_SCHEDULE] 편집 권한 확인 - 본인스케줄: {schedule_result.mt_idx == current_user_id}, 관리권한: {GroupScheduleManager.has_manage_permission(member_auth)}, 최종권한: {can_edit}")
        
        if not can_edit:
            logger.error(f"❌ [UPDATE_SCHEDULE] 편집 권한 없음 - user_id: {current_user_id}")
            raise HTTPException(
                status_code=403, 
                detail="You can only edit your own schedules or you need owner/leader permission"
            )
        
        # 필수 필드 검증 및 기본값 설정 (PHP 로직 참고)
        if not schedule_data.get('sst_title', '').strip():
            schedule_data['sst_title'] = '제목 없음'
            logger.warning(f"⚠️ [UPDATE_SCHEDULE] 제목이 비어있어 기본값으로 설정")
            
        if not schedule_data.get('sst_sdate'):
            logger.error(f"❌ [UPDATE_SCHEDULE] 시작 날짜가 없음")
            raise HTTPException(status_code=400, detail="Start date is required")
            
        if not schedule_data.get('sst_edate'):
            schedule_data['sst_edate'] = schedule_data['sst_sdate']
            logger.info(f"📅 [UPDATE_SCHEDULE] 종료 날짜가 없어 시작 날짜로 설정")
        
        logger.info(f"📝 [UPDATE_SCHEDULE] 필수 필드 검증 완료 - title: {schedule_data['sst_title']}")
        
        # 시작/종료 날짜/시간 처리 (PHP 로직 참고)
        sst_sdate = schedule_data['sst_sdate']
        sst_edate = schedule_data['sst_edate']
        
        logger.info(f"📅 [UPDATE_SCHEDULE] 원본 날짜/시간 - sdate: {sst_sdate}, edate: {sst_edate}")
        
        # 시간이 포함되지 않은 경우 시간 추가
        if 'T' not in sst_sdate and ':' not in sst_sdate:
            sst_stime = schedule_data.get('sst_stime', '00:00:00')
            sst_sdate = f"{sst_sdate}T{sst_stime}" if 'T' not in sst_stime else f"{sst_sdate} {sst_stime}"
            logger.info(f"⏰ [UPDATE_SCHEDULE] 시작 시간 추가 - 결과: {sst_sdate}")
            
        if 'T' not in sst_edate and ':' not in sst_edate:
            sst_etime = schedule_data.get('sst_etime', '23:59:59')
            sst_edate = f"{sst_edate}T{sst_etime}" if 'T' not in sst_etime else f"{sst_edate} {sst_etime}"
            logger.info(f"⏰ [UPDATE_SCHEDULE] 종료 시간 추가 - 결과: {sst_edate}")
        
        # 하루종일 및 반복 설정 처리 (사용자 요구사항에 맞게)
        sst_all_day = schedule_data.get('sst_all_day', 'N')
        sst_repeat_json = schedule_data.get('sst_repeat_json', '')
        sst_repeat_json_v = schedule_data.get('sst_repeat_json_v', '')
        
        logger.info(f"🔄 [UPDATE_SCHEDULE] 원본 반복 설정 - all_day: {sst_all_day}, repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 하루종일인 경우 반복을 null로 설정
        if sst_all_day == 'Y':
            sst_repeat_json = ''
            sst_repeat_json_v = ''
            logger.info("🔄 [UPDATE_SCHEDULE] 하루종일 이벤트: 반복 설정을 null로 변경")
        
        logger.info(f"🔄 [UPDATE_SCHEDULE] 최종 반복 설정 - repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 알림 시간 계산 (PHP 로직 참고)
        sst_schedule_alarm = None
        logger.info(f"🔔 [UPDATE_SCHEDULE] 알림 설정 시작 - alarm_chk: {schedule_data.get('sst_schedule_alarm_chk')}, pick_type: {schedule_data.get('sst_pick_type')}, pick_result: {schedule_data.get('sst_pick_result')}")
        
        if (schedule_data.get('sst_schedule_alarm_chk') == 'Y' and 
            schedule_data.get('sst_pick_type') and 
            schedule_data.get('sst_pick_result')):
            
            try:
                from datetime import datetime, timedelta
                start_datetime = datetime.fromisoformat(sst_sdate.replace('T', ' '))
                pick_result = int(schedule_data['sst_pick_result'])
                pick_type = schedule_data['sst_pick_type']
                
                logger.info(f"🔔 [UPDATE_SCHEDULE] 알림 시간 계산 - start_datetime: {start_datetime}, pick_result: {pick_result}, pick_type: {pick_type}")
                
                if pick_type == 'minute':
                    sst_schedule_alarm = start_datetime - timedelta(minutes=pick_result)
                elif pick_type == 'hour':
                    sst_schedule_alarm = start_datetime - timedelta(hours=pick_result)
                elif pick_type == 'day':
                    sst_schedule_alarm = start_datetime - timedelta(days=pick_result)
                
                logger.info(f"🔔 [UPDATE_SCHEDULE] 계산된 알림 시간: {sst_schedule_alarm}")
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ [UPDATE_SCHEDULE] 알림 시간 계산 실패: {e}")
                sst_schedule_alarm = None

        # 업데이트할 필드 구성 (PHP의 모든 필드 지원)
        logger.info(f"💾 [UPDATE_SCHEDULE] 업데이트 필드 구성 시작")
        
        update_fields = []
        update_params = {"schedule_id": schedule_id}
        
        # 기본 필드들
        basic_fields = {
            "sst_title": schedule_data.get('sst_title'),
            "sst_sdate": sst_sdate,
            "sst_edate": sst_edate,
            "sst_sedate": f"{sst_sdate} ~ {sst_edate}",
            "sst_all_day": sst_all_day,
        }
        
        # 위치 관련 필드들
        location_fields = {
            "sst_location_title": schedule_data.get('sst_location_title'),
            "sst_location_add": schedule_data.get('sst_location_add'),
            "sst_location_lat": schedule_data.get('sst_location_lat'),
            "sst_location_long": schedule_data.get('sst_location_long'),
            "sst_location_alarm": schedule_data.get('sst_location_alarm', 'N'),
            "sst_location_detail": schedule_data.get('sst_location_detail'),
        }
        
        # 알림 관련 필드들
        alarm_fields = {
            "sst_alram": schedule_data.get('sst_alram', 'N'),
            "sst_alram_t": schedule_data.get('sst_alram_t'),
            "sst_schedule_alarm_chk": schedule_data.get('sst_schedule_alarm_chk', 'N'),
            "sst_pick_type": schedule_data.get('sst_pick_type'),
            "sst_pick_result": schedule_data.get('sst_pick_result'),
            "sst_schedule_alarm": sst_schedule_alarm.strftime('%Y-%m-%d %H:%M:%S') if sst_schedule_alarm else None,
        }
        
        # 반복 관련 필드들
        repeat_fields = {
            "sst_repeat_json": sst_repeat_json,
            "sst_repeat_json_v": sst_repeat_json_v,
        }
        
        # 기타 필드들
        other_fields = {
            "sst_memo": schedule_data.get('sst_memo'),
            "sst_supplies": schedule_data.get('sst_supplies'),
            "sst_content": schedule_data.get('sst_content'),
            "sst_place": schedule_data.get('sst_place'),
            "slt_idx": schedule_data.get('slt_idx'),
            "slt_idx_t": schedule_data.get('sst_location_add'), # PHP에서 location_add를 slt_idx_t로 사용
            "sst_update_chk": schedule_data.get('sst_update_chk', 'Y'),
        }
        
        # 모든 필드 병합
        all_fields = {**basic_fields, **location_fields, **alarm_fields, **repeat_fields, **other_fields}
        
        # None이 아닌 값만 업데이트에 포함
        for field, value in all_fields.items():
            if value is not None:
                update_fields.append(f"{field} = :{field}")
                update_params[field] = value
        
        # 업데이트 시간 추가
        update_fields.append("sst_udate = NOW()")
        
        logger.info(f"💾 [UPDATE_SCHEDULE] 업데이트 필드 수: {len(update_fields)}")
        logger.info(f"💾 [UPDATE_SCHEDULE] 업데이트 파라미터:")
        for key, value in update_params.items():
            if key != 'schedule_id':
                logger.info(f"    {key}: {value}")
        
        if update_fields:
            update_query = text(f"""
                UPDATE smap_schedule_t SET {', '.join(update_fields)}
                WHERE sst_idx = :schedule_id
            """)
            
            db.execute(update_query, update_params)
            db.commit()
            
            logger.info(f"✅ [UPDATE_SCHEDULE] 스케줄 수정 성공: schedule_id={schedule_id}, user_id={current_user_id}")
        
        return {
            "success": True,
            "data": {
                "message": "Schedule updated successfully",
                "sst_idx": schedule_id,
                "updated_fields": len(update_fields) - 1  # sst_udate 제외
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [UPDATE_SCHEDULE] 스케줄 수정 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/group/{group_id}/schedules/{schedule_id}")
def delete_group_schedule(
    group_id: int,
    schedule_id: int,
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 삭제 (권한 기반)
    """
    try:
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 기존 스케줄 조회
        schedule_query = text("""
            SELECT * FROM smap_schedule_t 
            WHERE sst_idx = :schedule_id AND sst_show = 'Y'
        """)
        
        schedule_result = db.execute(schedule_query, {"schedule_id": schedule_id}).fetchone()
        
        if not schedule_result:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # 권한 확인: 본인 스케줄이거나 오너/리더인 경우만 삭제 가능
        can_delete = (
            schedule_result.mt_idx == current_user_id or 
            GroupScheduleManager.has_manage_permission(member_auth)
        )
        
        if not can_delete:
            raise HTTPException(
                status_code=403, 
                detail="You can only delete your own schedules or you need owner/leader permission"
            )
        
        # 스케줄 소프트 삭제
        delete_query = text("""
            UPDATE smap_schedule_t 
            SET sst_show = 'N', sst_ddate = NOW() 
            WHERE sst_idx = :schedule_id
        """)
        
        db.execute(delete_query, {"schedule_id": schedule_id})
        db.commit()
        
        return {
            "success": True,
            "data": {
                "message": "Schedule deleted successfully"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"스케줄 삭제 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") 