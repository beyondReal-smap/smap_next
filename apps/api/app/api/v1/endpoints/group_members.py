from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api import deps
from app.models.member import Member
from app.models.group_detail import GroupDetail
from app.schemas.member import MemberResponse
from app.models.enums import StatusEnum, ShowEnum
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/member/{group_id}", response_model=List[dict])
def get_group_members(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에 속한 멤버 목록과 그룹 상세 정보, 최신 위치 정보를 조회합니다.
    """
    try:
        logger.info(f"📋 [GET_GROUP_MEMBERS] 그룹 멤버 조회 시작 - group_id: {group_id}")
        
        # 1단계: 그룹 멤버 기본 정보 조회 (빠른 쿼리)
        basic_query = text("""
            SELECT 
                sgd.sgdt_idx,
                sgd.sgt_idx,
                sgd.mt_idx,
                sgd.sgdt_owner_chk,
                sgd.sgdt_leader_chk,
                m.mt_name,
                m.mt_nickname,
                m.mt_birth,
                m.mt_file1,
                m.mt_gender,
                m.mt_status,
                m.mt_weather_pop,
                m.mt_weather_tmn,
                m.mt_weather_tmx,
                m.mt_weather_sky,
                m.mt_weather_date
            FROM smap_group_detail_t sgd
            JOIN member_t m ON sgd.mt_idx = m.mt_idx
            WHERE sgd.sgt_idx = :group_id 
                AND sgd.sgdt_show = 'Y'
                AND sgd.sgdt_discharge = 'N'
                AND sgd.sgdt_exit = 'N'
                AND m.mt_status = 1
            ORDER BY 
                CASE sgd.sgdt_owner_chk WHEN 'Y' THEN 1 ELSE 2 END,
                CASE sgd.sgdt_leader_chk WHEN 'Y' THEN 1 ELSE 2 END,
                m.mt_name
        """)
        
        basic_result = db.execute(basic_query, {"group_id": group_id}).fetchall()
        logger.info(f"📊 [GET_GROUP_MEMBERS] 기본 정보 조회 완료 - 멤버 수: {len(basic_result)}")
        
        # 2단계: 모든 멤버의 최신 위치 정보를 한 번에 조회 (더 효율적)
        member_ids = [row.mt_idx for row in basic_result]
        location_data = {}
        
        logger.info(f"📍 [GET_GROUP_MEMBERS] 위치 조회 대상 멤버 IDs: {member_ids}")
        
        if member_ids:
            # IN 절의 tuple 바인딩 문제를 해결하기 위해 동적 SQL 생성
            placeholders = ", ".join([str(mid) for mid in member_ids])
            
            # member_location_log_t에서 최신 위치 조회
            location_query = text(f"""
                SELECT DISTINCT
                    mll1.mt_idx,
                    mll1.mlt_lat,
                    mll1.mlt_long,
                    mll1.mlt_speed,
                    mll1.mlt_battery,
                    mll1.mlt_gps_time
                FROM member_location_log_t mll1
                INNER JOIN (
                    SELECT mt_idx, MAX(mlt_gps_time) as max_time
                    FROM member_location_log_t
                    WHERE mt_idx IN ({placeholders}) 
                        AND mlt_gps_time IS NOT NULL
                    GROUP BY mt_idx
                ) mll2 ON mll1.mt_idx = mll2.mt_idx AND mll1.mlt_gps_time = mll2.max_time
            """)
            
            location_results = db.execute(location_query).fetchall()
            logger.info(f"📍 [GET_GROUP_MEMBERS] member_location_log_t 조회 결과: {len(location_results)}건")
            
            # 위치 데이터를 딕셔너리로 변환
            for loc in location_results:
                location_data[loc.mt_idx] = {
                    "mlt_lat": float(loc.mlt_lat) if loc.mlt_lat else None,
                    "mlt_long": float(loc.mlt_long) if loc.mlt_long else None,
                    "mlt_speed": float(loc.mlt_speed) if loc.mlt_speed else None,
                    "mlt_battery": int(loc.mlt_battery) if loc.mlt_battery else None,
                    "mlt_gps_time": str(loc.mlt_gps_time) if loc.mlt_gps_time else None,
                }
            
            # 3단계: member_location_log_t에 데이터가 없는 멤버는 member_t의 mt_lat, mt_long을 fallback으로 사용
            missing_members = [mid for mid in member_ids if mid not in location_data]
            if missing_members:
                logger.info(f"📍 [GET_GROUP_MEMBERS] 위치 로그 없는 멤버 {len(missing_members)}명, member_t에서 fallback 조회")
                missing_placeholders = ", ".join([str(mid) for mid in missing_members])
                fallback_query = text(f"""
                    SELECT mt_idx, mt_lat, mt_long
                    FROM member_t
                    WHERE mt_idx IN ({missing_placeholders})
                        AND mt_lat IS NOT NULL 
                        AND mt_long IS NOT NULL
                """)
                fallback_results = db.execute(fallback_query).fetchall()
                
                for member in fallback_results:
                    location_data[member.mt_idx] = {
                        "mlt_lat": float(member.mt_lat) if member.mt_lat else None,
                        "mlt_long": float(member.mt_long) if member.mt_long else None,
                        "mlt_speed": None,
                        "mlt_battery": None,
                        "mlt_gps_time": None,  # fallback이므로 시간 정보 없음
                    }
                logger.info(f"📍 [GET_GROUP_MEMBERS] member_t fallback 결과: {len(fallback_results)}건")
        
        # 4단계: 결과 데이터 조합
        members = []
        for row in basic_result:
            # 해당 멤버의 위치 정보 가져오기
            location_info = location_data.get(row.mt_idx, {})
            
            member_data = {
                # 그룹 상세 정보
                "sgdt_idx": row.sgdt_idx,
                "sgt_idx": row.sgt_idx,
                "mt_idx": row.mt_idx,
                "sgdt_owner_chk": row.sgdt_owner_chk,
                "sgdt_leader_chk": row.sgdt_leader_chk,
                
                # 멤버 기본 정보
                "mt_name": row.mt_name,
                "mt_nickname": row.mt_nickname,
                "mt_birth": str(row.mt_birth) if row.mt_birth else None,
                "mt_file1": row.mt_file1,
                "mt_gender": row.mt_gender,
                "mt_status": row.mt_status,
                "mt_weather_pop": row.mt_weather_pop,
                "mt_weather_tmn": row.mt_weather_tmn,
                "mt_weather_tmx": row.mt_weather_tmx,
                "mt_weather_sky": row.mt_weather_sky,
                "mt_weather_date": row.mt_weather_date,
                
                # 최신 위치 정보
                "mlt_lat": location_info.get("mlt_lat"),
                "mlt_long": location_info.get("mlt_long"),
                "mlt_speed": location_info.get("mlt_speed"),
                "mlt_battery": location_info.get("mlt_battery"),
                "mlt_gps_time": location_info.get("mlt_gps_time"),
                
                # 호환성을 위한 추가 필드
                "id": str(row.mt_idx),
                "name": row.mt_name,
                "photo": row.mt_file1,
                "isSelected": False
            }
            
            members.append(member_data)
            
            logger.info(f"👤 [GET_GROUP_MEMBERS] 멤버 정보 - ID: {row.mt_idx}, 이름: {row.mt_name}, 권한: O={row.sgdt_owner_chk}/L={row.sgdt_leader_chk}")
        
        logger.info(f"✅ [GET_GROUP_MEMBERS] 그룹 멤버 조회 완료 - 총 {len(members)}명")
        return members
        
    except Exception as e:
        logger.error(f"💥 [GET_GROUP_MEMBERS] 그룹 멤버 조회 오류: {e}")
        import traceback
        logger.error(f"💥 [GET_GROUP_MEMBERS] 상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/add")
def add_member_to_group(
    group_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에 멤버를 추가합니다.
    """
    # 그룹과 멤버가 존재하는지 확인
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # 이미 그룹에 멤버가 존재하는지 확인
    exists = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.Y
    ).first()
    
    if exists:
        return {"success": False, "message": "Member is already in the group"}
    
    # 이전에 삭제된 멤버인 경우 상태만 업데이트
    deleted_member = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.N
    ).first()
    
    if deleted_member:
        deleted_member.sgdt_show = ShowEnum.Y
        db.add(deleted_member)
        db.commit()
    else:
        # 새 그룹 멤버 생성
        group_detail = GroupDetail(
            sgt_idx=group_id,
            mt_idx=member_id,
            sgdt_show=ShowEnum.Y
        )
        db.add(group_detail)
        db.commit()
    
    return {"success": True, "message": "Member added to group successfully"}

@router.delete("/remove")
def remove_member_from_group(
    group_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에서 멤버를 제거합니다.
    """
    group_detail = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.Y
    ).first()
    
    if not group_detail:
        raise HTTPException(status_code=404, detail="Member not found in the group")
    
    group_detail.sgdt_show = ShowEnum.N
    db.add(group_detail)
    db.commit()
    
    return {"success": True, "message": "Member removed from group successfully"}

@router.delete("/{group_id}/member/{member_id}")
def remove_member_from_group_path(
    group_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에서 멤버를 제거합니다. (경로 파라미터 버전)
    """
    logger.info(f"[REMOVE_MEMBER] 멤버 내보내기 요청 - group_id: {group_id}, member_id: {member_id}")
    
    group_detail = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == 'Y'
    ).first()
    
    if not group_detail:
        logger.warning(f"[REMOVE_MEMBER] 멤버를 찾을 수 없음 - group_id: {group_id}, member_id: {member_id}")
        raise HTTPException(status_code=404, detail="Member not found in the group")
    
    # 소프트 삭제 처리
    group_detail.sgdt_show = 'N'
    group_detail.sgdt_exit = 'Y'
    db.add(group_detail)
    db.commit()
    
    logger.info(f"[REMOVE_MEMBER] 멤버 내보내기 완료 - group_id: {group_id}, member_id: {member_id}")
    
    return {"success": True, "message": "멤버가 그룹에서 내보내졌습니다."}

@router.put("/{group_id}/role")
def update_member_role(
    group_id: int,
    role_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 멤버의 역할(리더)을 변경합니다.
    """
    # member_id 추출 (키 존재 여부로 체크)
    member_id = role_data.get("member_id") if "member_id" in role_data else role_data.get("mt_idx")
    
    # is_leader 추출 (False 값도 올바르게 처리)
    is_leader = None
    if "is_leader" in role_data:
        is_leader = role_data.get("is_leader")
    elif "sgdt_leader_chk" in role_data:
        is_leader = role_data.get("sgdt_leader_chk")
    
    logger.info(f"[UPDATE_ROLE] 역할 변경 요청 - group_id: {group_id}, member_id: {member_id}, is_leader: {is_leader}, raw_data: {role_data}")
    
    if not member_id:
        raise HTTPException(status_code=400, detail="member_id or mt_idx is required")
    
    group_detail = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == 'Y',
        GroupDetail.sgdt_exit == 'N'
    ).first()
    
    if not group_detail:
        logger.warning(f"[UPDATE_ROLE] 멤버를 찾을 수 없음 - group_id: {group_id}, member_id: {member_id}")
        raise HTTPException(status_code=404, detail="Member not found in the group")
    
    # 리더 여부 변경
    if is_leader is not None:
        if isinstance(is_leader, bool):
            group_detail.sgdt_leader_chk = 'Y' if is_leader else 'N'
        else:
            group_detail.sgdt_leader_chk = str(is_leader).upper()  # 'Y' or 'N' string
    
    db.add(group_detail)
    db.commit()
    
    logger.info(f"[UPDATE_ROLE] 역할 변경 완료 - member_id: {member_id}, sgdt_leader_chk: {group_detail.sgdt_leader_chk}")
    
    return {
        "success": True, 
        "message": "멤버 역할이 변경되었습니다.",
        "data": {
            "sgdt_idx": group_detail.sgdt_idx,
            "sgt_idx": group_id,
            "mt_idx": member_id,
            "sgdt_leader_chk": group_detail.sgdt_leader_chk
        }
    }