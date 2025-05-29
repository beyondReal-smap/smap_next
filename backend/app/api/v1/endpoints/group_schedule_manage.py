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

@router.get("/owner-groups/all-schedules")
def get_owner_groups_all_schedules(
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    days: Optional[int] = Query(7, description="조회할 일수 (기본값: 7일)"),
    db: Session = Depends(deps.get_db)
):
    """
    현재 사용자가 오너인 그룹들의 모든 멤버 스케줄을 조회합니다.
    """
    try:
        # 단계 1: 현재 사용자 그룹 목록 먼저 조회
        owner_groups_query = text("""
            SELECT sg.sgt_idx, sg.sgt_title 
            FROM smap_group_t sg
            JOIN smap_group_detail_t sgd ON sg.sgt_idx = sgd.sgt_idx
            WHERE sgd.mt_idx = :current_user_id 
            AND sg.sgt_show = 'Y'
        """)
        
        owner_groups = db.execute(owner_groups_query, {"current_user_id": current_user_id}).fetchall()
        
        groups = [
            {
                "sgt_idx": group.sgt_idx,
                "sgt_title": group.sgt_title
            }
            for group in owner_groups
        ]
        
        # 단계 2: 오너 그룹이 있는 경우에만 스케줄 조회
        schedules = []
        if groups:
            # 그룹 ID 목록 생성
            group_ids = [str(group["sgt_idx"]) for group in groups]
            group_ids_str = ",".join(group_ids)
            
            # 간단한 스케줄 조회 쿼리
            schedule_query = text(f"""
                SELECT
                    sst.sst_idx,
                    sst.sst_pidx,
                    sst.mt_idx,
                    sst.sst_title,
                    sst.sst_sdate,
                    sst.sst_edate,
                    sst.sst_location_title,
                    sst.sst_memo,
                    sst.sgt_idx,
                    m.mt_name as member_name,
                    m.mt_file1 as member_photo,
                    sg.sgt_title as group_title
                FROM
                    smap_schedule_t sst
                JOIN member_t m ON sst.mt_idx = m.mt_idx
                JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
                WHERE
                    sst.sgt_idx IN ({group_ids_str})
                    AND sst.sst_show = 'Y'
                    AND sst.sst_sdate >= NOW() - INTERVAL 1 DAY
                    AND sst.sst_sdate <= NOW() + INTERVAL :days DAY
                ORDER BY
                    sst.sst_sdate
                LIMIT 50
            """)
            
            schedule_results = db.execute(schedule_query, {"days": days}).fetchall()
            
            # 스케줄 데이터 변환 (기본 필드만)
            for row in schedule_results:
                schedule_data = {
                    "sst_idx": row.sst_idx,
                    "sst_pidx": row.sst_pidx,
                    "mt_idx": row.mt_idx,
                    "sst_title": row.sst_title,
                    "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                    "sst_edate": str(row.sst_edate) if row.sst_edate else None,
                    "sst_location_title": row.sst_location_title,
                    "sst_memo": row.sst_memo,
                    "sgt_idx": row.sgt_idx,
                    "member_name": row.member_name,
                    "member_photo": row.member_photo,
                    "group_title": row.group_title,
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
    그룹 스케줄 생성 (권한 기반)
    """
    try:
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 필수 필드 확인
        required_fields = ["sst_title", "sst_sdate", "sst_edate"]
        for field in required_fields:
            if not schedule_data.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # 대상 멤버 ID 결정
        target_member_id = schedule_data.get("targetMemberId", current_user_id)
        
        # 다른 멤버 스케줄 생성 시 권한 확인
        if target_member_id != current_user_id:
            if not GroupScheduleManager.has_manage_permission(member_auth):
                raise HTTPException(
                    status_code=403, 
                    detail="Only group owner or leader can create schedules for other members"
                )
            
            # 대상 멤버가 같은 그룹에 속하는지 확인
            target_member_auth = GroupScheduleManager.check_group_permission(db, target_member_id, group_id)
            if not target_member_auth:
                raise HTTPException(status_code=400, detail="Target member is not in the same group")
        
        # 스케줄 생성 쿼리
        insert_query = text("""
            INSERT INTO smap_schedule_t (
                mt_idx, sst_title, sst_sdate, sst_edate, sst_all_day,
                sgt_idx, sgdt_idx, sst_location_title, sst_location_add,
                sst_location_lat, sst_location_long, sst_memo, sst_supplies,
                sst_alram, sst_schedule_alarm_chk, sst_show, sst_wdate
            ) VALUES (
                :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_all_day,
                :sgt_idx, :sgdt_idx, :sst_location_title, :sst_location_add,
                :sst_location_lat, :sst_location_long, :sst_memo, :sst_supplies,
                :sst_alram, :sst_schedule_alarm_chk, 'Y', NOW()
            )
        """)
        
        insert_params = {
            "mt_idx": target_member_id,
            "sst_title": schedule_data["sst_title"],
            "sst_sdate": schedule_data["sst_sdate"],
            "sst_edate": schedule_data["sst_edate"],
            "sst_all_day": schedule_data.get("sst_all_day", "Y"),
            "sgt_idx": group_id,
            "sgdt_idx": member_auth["sgdt_idx"],
            "sst_location_title": schedule_data.get("sst_location_title"),
            "sst_location_add": schedule_data.get("sst_location_add"),
            "sst_location_lat": schedule_data.get("sst_location_lat"),
            "sst_location_long": schedule_data.get("sst_location_long"),
            "sst_memo": schedule_data.get("sst_memo"),
            "sst_supplies": schedule_data.get("sst_supplies"),
            "sst_alram": schedule_data.get("sst_alram"),
            "sst_schedule_alarm_chk": schedule_data.get("sst_schedule_alarm_chk", "Y")
        }
        
        result = db.execute(insert_query, insert_params)
        db.commit()
        
        return {
            "success": True,
            "data": {
                "sst_idx": result.lastrowid,
                "message": "Schedule created successfully"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"스케줄 생성 오류: {e}")
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
    그룹 스케줄 수정 (권한 기반)
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
        
        # 권한 확인: 본인 스케줄이거나 오너/리더인 경우만 수정 가능
        can_edit = (
            schedule_result.mt_idx == current_user_id or 
            GroupScheduleManager.has_manage_permission(member_auth)
        )
        
        if not can_edit:
            raise HTTPException(
                status_code=403, 
                detail="You can only edit your own schedules or you need owner/leader permission"
            )
        
        # 업데이트 쿼리 구성
        update_fields = []
        update_params = {"schedule_id": schedule_id}
        
        updatable_fields = [
            "sst_title", "sst_sdate", "sst_edate", "sst_all_day",
            "sst_location_title", "sst_location_add", "sst_location_lat", "sst_location_long",
            "sst_memo", "sst_supplies", "sst_alram", "sst_schedule_alarm_chk"
        ]
        
        for field in updatable_fields:
            if field in schedule_data:
                update_fields.append(f"{field} = :{field}")
                update_params[field] = schedule_data[field]
        
        if update_fields:
            update_fields.append("sst_udate = NOW()")
            
            update_query = text(f"""
                UPDATE smap_schedule_t SET {', '.join(update_fields)}
                WHERE sst_idx = :schedule_id
            """)
            
            db.execute(update_query, update_params)
            db.commit()
        
        return {
            "success": True,
            "data": {
                "message": "Schedule updated successfully"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"스케줄 수정 오류: {e}")
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