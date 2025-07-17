from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, text
from jose import jwt, JWTError
import hashlib
import random
import string
from app.api import deps
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.models.schedule import Schedule
from app.models.location import Location
from app.models.member import Member
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse
from app.core.config import settings
from datetime import datetime, timedelta
from app.models.enums import ShowEnum
import traceback
import logging
from pydantic import BaseModel

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()

# 그룹 가입을 위한 스키마
class GroupJoinRequest(BaseModel):
    mt_idx: int
    sgt_idx: int

def get_current_user_id_from_token(authorization: str = Header(None)) -> Optional[int]:
    """
    Authorization 헤더에서 토큰을 추출하고 사용자 ID를 반환합니다.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx: Optional[int] = payload.get("mt_idx")
        return mt_idx
    except JWTError:
        return None

@router.get("/hidden", response_model=List[GroupResponse])
def get_hidden_groups(
    db: Session = Depends(deps.get_db)
):
    """
    숨겨진 그룹 목록을 조회합니다. (sgt_show = 'N'인 그룹들)
    """
    logger.info("[GET_HIDDEN_GROUPS] 숨겨진 그룹 목록 조회 시작")
    
    hidden_groups = db.query(Group).filter(Group.sgt_show == 'N').all()
    
    logger.info(f"[GET_HIDDEN_GROUPS] 숨겨진 그룹 수: {len(hidden_groups)}")
    for group in hidden_groups:
        logger.info(f"[GET_HIDDEN_GROUPS] 숨겨진 그룹 - sgt_idx: {group.sgt_idx}, sgt_title: {group.sgt_title}")
    
    return hidden_groups

@router.get("/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹을 조회합니다.
    """
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group

@router.get("/", response_model=List[GroupResponse])
def get_groups(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    show_hidden: bool = False
):
    """
    그룹 목록을 조회합니다. (sgt_show = 'Y'인 그룹만, show_hidden=True면 숨겨진 그룹도 포함)
    """
    if show_hidden:
        logger.info("[GET_GROUPS] 숨겨진 그룹 포함하여 조회")
        groups = db.query(Group).offset(skip).limit(limit).all()
    else:
        logger.info("[GET_GROUPS] 표시되는 그룹만 조회")
        groups = db.query(Group).filter(Group.sgt_show == 'Y').offset(skip).limit(limit).all()
    
    logger.info(f"[GET_GROUPS] 조회된 그룹 수: {len(groups)}")
    for group in groups:
        logger.info(f"[GET_GROUPS] 그룹 - sgt_idx: {group.sgt_idx}, sgt_title: {group.sgt_title}, sgt_show: {group.sgt_show}")
    
    return groups

@router.get("/current-user", response_model=List[dict])
def get_current_user_groups(
    db: Session = Depends(deps.get_db),
    authorization: str = Header(None)
):
    """
    현재 로그인한 사용자가 속한 그룹 목록을 조회합니다.
    home/page.tsx의 groupService.getCurrentUserGroups()에서 사용
    """
    # 토큰에서 사용자 ID 추출
    user_id = get_current_user_id_from_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    
    # 사용자가 속한 그룹 조회 (sgt_show = 'Y'인 그룹만)
    user_groups = db.query(Group, GroupDetail).join(
        GroupDetail, Group.sgt_idx == GroupDetail.sgt_idx
    ).filter(
        GroupDetail.mt_idx == user_id,
        GroupDetail.sgdt_exit == 'N',  # 탈퇴하지 않은 그룹
        Group.sgt_show == 'Y'  # 표시되는 그룹만
    ).all()
    
    result = []
    for group, group_detail in user_groups:
        group_data = {
            "sgt_idx": group.sgt_idx,
            "mt_idx": group.mt_idx,  # 그룹 오너 ID
            "sgt_title": group.sgt_title or f"그룹 {group.sgt_idx}",
            "sgt_code": group.sgt_code or "",
            "sgt_memo": group.sgt_memo or "",
            "sgt_show": group.sgt_show or 'Y',
            "sgt_wdate": group.sgt_wdate.isoformat() if group.sgt_wdate else datetime.utcnow().isoformat(),
            "sgt_udate": group.sgt_udate.isoformat() if group.sgt_udate else datetime.utcnow().isoformat(),
            # 현재 사용자의 그룹 내 역할 정보
            "is_owner": group_detail.sgdt_owner_chk == 'Y',
            "is_leader": group_detail.sgdt_leader_chk == 'Y',
            "join_date": group_detail.sgdt_wdate.isoformat() if group_detail.sgdt_wdate else datetime.utcnow().isoformat()
        }
        result.append(group_data)
    
    # 그룹 제목순으로 정렬
    result.sort(key=lambda x: x["sgt_title"])
    
    return result

@router.get("/member/{member_id}", response_model=List[GroupResponse])
def get_member_groups(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 그룹 목록을 조회합니다.
    """
    logger.info(f"[GET_MEMBER_GROUPS] 멤버 그룹 목록 조회 시작 - member_id: {member_id}")
    
    groups = Group.find_by_member(db, member_id)
    
    logger.info(f"[GET_MEMBER_GROUPS] 조회된 그룹 수: {len(groups)}")
    for group in groups:
        logger.info(f"[GET_MEMBER_GROUPS] 그룹 정보 - sgt_idx: {group.sgt_idx}, sgt_title: {group.sgt_title}, sgt_show: {group.sgt_show}")
    
    return groups

@router.get("/code/{code}", response_model=GroupResponse)
def get_group_by_code(
    code: str,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 코드로 그룹을 조회합니다.
    """
    group = Group.find_by_code(db, code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group

def generate_sgt_code(db: Session) -> str:
    """
    고유한 sgt_code를 생성합니다.
    PHP의 get_sgt_code() 함수와 동일한 로직: G + MD5(랜덤)의 첫 5자리
    """
    unique = False
    while not unique:
        # 랜덤 값 생성 후 MD5 해시
        random_value = str(random.randint(1, 999999999))
        md5_hash = hashlib.md5(random_value.encode()).hexdigest().upper()
        # G + 첫 5자리
        uid = "G" + md5_hash[:5]
        
        # 중복 확인
        existing_group = db.query(Group).filter(Group.sgt_code == uid).first()
        if not existing_group:
            unique = True
            return uid
    
    return uid

@router.post("/", response_model=GroupResponse)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 그룹을 생성합니다.
    """
    # 그룹 데이터 생성
    group_data = group_in.dict()
    
    # sgt_code 자동 생성 (고유값)
    group_data['sgt_code'] = generate_sgt_code(db)
    
    # sgt_wdate 현재 시간 설정
    group_data['sgt_wdate'] = datetime.utcnow()
    
    # sgt_show 기본값 설정
    if not group_data.get('sgt_show'):
        group_data['sgt_show'] = 'Y'
    
    # 그룹 생성
    group = Group(**group_data)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # 그룹 생성자를 GroupDetail 테이블에 그룹장으로 추가
    if group_data.get('mt_idx'):
        group_detail = GroupDetail(
            sgt_idx=group.sgt_idx,
            mt_idx=group_data['mt_idx'],
            sgdt_owner_chk='Y',  # 그룹장
            sgdt_leader_chk='N',
            sgdt_discharge='N',
            sgdt_group_chk='Y',
            sgdt_exit='N',
            sgdt_show='Y',
            sgdt_push_chk='Y',
            sgdt_wdate=datetime.utcnow()
        )
        db.add(group_detail)
        db.commit()
    
    return group

@router.put("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    group_in: GroupUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 정보를 업데이트합니다. (sgt_show='N'이면 소프트 삭제)
    """
    try:
        logger.info(f"[UPDATE_GROUP] 그룹 업데이트 요청 시작 - group_id: {group_id}, data: {group_in.dict()}")
        
        # 먼저 그룹이 존재하는지 확인
        group = db.query(Group).filter(Group.sgt_idx == group_id).first()
        if not group:
            logger.error(f"[UPDATE_GROUP] 그룹을 찾을 수 없음 - group_id: {group_id}")
            raise HTTPException(status_code=404, detail="Group not found")
        
        logger.info(f"[UPDATE_GROUP] 업데이트 전 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
        
        # 소프트 삭제 요청인지 확인
        if group_in.sgt_show == 'N':
            logger.warning(f"[UPDATE_GROUP] 🚫 소프트 삭제 요청 감지 - group_id: {group_id}")
            logger.warning(f"[UPDATE_GROUP] ⚠️ 실제 DB 삭제가 아닌 숨김 처리를 실행합니다")
            logger.warning(f"[UPDATE_GROUP] 🔍 삭제 전 그룹 상태 확인 - sgt_show: {group.sgt_show}")
            
            # 소프트 삭제 실행
            result = group.soft_delete(db)
            logger.info(f"[UPDATE_GROUP] ✅ 소프트 삭제 완료 - sgt_show: {result.sgt_show}")
            logger.warning(f"[UPDATE_GROUP] 🚨 중요: 그룹이 DB에서 실제 삭제되지 않았습니다!")
            logger.warning(f"[UPDATE_GROUP] 📊 그룹 상태: sgt_idx={result.sgt_idx}, sgt_show={result.sgt_show}")
            return result
        
        # 일반 업데이트 처리
        updated = False
        
        if group_in.sgt_title is not None:
            group.sgt_title = group_in.sgt_title
            updated = True
            logger.info(f"[UPDATE_GROUP] sgt_title 업데이트: {group_in.sgt_title}")
            
        if group_in.sgt_memo is not None:
            group.sgt_memo = group_in.sgt_memo
            updated = True
            logger.info(f"[UPDATE_GROUP] sgt_memo 업데이트: {group_in.sgt_memo}")
            
        if group_in.sgt_code is not None:
            group.sgt_code = group_in.sgt_code
            updated = True
            logger.info(f"[UPDATE_GROUP] sgt_code 업데이트: {group_in.sgt_code}")
            
        if group_in.mt_idx is not None:
            group.mt_idx = group_in.mt_idx
            updated = True
            logger.info(f"[UPDATE_GROUP] mt_idx 업데이트: {group_in.mt_idx}")
        
        # 업데이트된 필드가 있으면 업데이트 시간 설정
        if updated:
            group.sgt_udate = datetime.utcnow()
            logger.info(f"[UPDATE_GROUP] 변경사항 커밋 중...")
            db.commit()
            db.refresh(group)
            logger.info(f"[UPDATE_GROUP] 업데이트 후 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
        else:
            logger.info(f"[UPDATE_GROUP] 업데이트할 필드가 없음")
        
        logger.info(f"[UPDATE_GROUP] 그룹 업데이트 완료 - group_id: {group_id}")
        return group
        
    except HTTPException:
        # HTTPException은 그대로 재발생
        raise
    except Exception as e:
        # 다른 모든 예외는 500 에러로 처리
        db.rollback()
        logger.error(f"그룹 업데이트 오류 (group_id: {group_id}): {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"그룹 업데이트 중 오류가 발생했습니다: {str(e)}")

@router.put("/{group_id}/restore", response_model=GroupResponse)
def restore_group(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    숨겨진 그룹을 복구합니다. (sgt_show를 'Y'로 변경)
    """
    logger.info(f"[RESTORE_GROUP] 그룹 복구 요청 시작 - group_id: {group_id}")
    
    # sgt_show가 'N'인 그룹도 포함하여 조회
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        logger.error(f"[RESTORE_GROUP] 그룹을 찾을 수 없음 - group_id: {group_id}")
        raise HTTPException(status_code=404, detail="Group not found")
    
    logger.info(f"[RESTORE_GROUP] 복구 전 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
    
    # sgt_show를 'Y'로 변경하여 복구
    group.sgt_show = 'Y'
    group.sgt_udate = datetime.utcnow()
    
    logger.info(f"[RESTORE_GROUP] 그룹 복구 실행 - sgt_show를 'Y'로 변경")
    
    db.commit()
    db.refresh(group)
    
    logger.info(f"[RESTORE_GROUP] 복구 후 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
    logger.info(f"[RESTORE_GROUP] 그룹 복구 완료 - group_id: {group_id}")
    
    return group

@router.post("/emergency-restore", response_model=GroupResponse)
def emergency_restore_group(
    db: Session = Depends(deps.get_db)
):
    """
    긴급 데이터 복구: 사용자 1186을 위한 새 그룹 생성
    """
    logger.info("[EMERGENCY_RESTORE] 긴급 그룹 복구 시작")
    
    # 새 그룹 생성
    group_data = {
        'mt_idx': 1186,
        'sgt_title': '복구된 그룹',
        'sgt_memo': '삭제된 그룹 복구용',
        'sgt_code': generate_sgt_code(db),
        'sgt_show': 'Y',
        'sgt_wdate': datetime.utcnow(),
        'sgt_udate': datetime.utcnow()
    }
    
    # 그룹 생성
    group = Group(**group_data)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # 그룹 생성자를 GroupDetail 테이블에 그룹장으로 추가
    group_detail = GroupDetail(
        sgt_idx=group.sgt_idx,
        mt_idx=1186,
        sgdt_owner_chk='Y',  # 그룹장
        sgdt_leader_chk='N',
        sgdt_discharge='N',
        sgdt_group_chk='Y',
        sgdt_exit='N',
        sgdt_show='Y',
        sgdt_push_chk='Y',
        sgdt_wdate=datetime.utcnow()
    )
    db.add(group_detail)
    db.commit()
    
    logger.info(f"[EMERGENCY_RESTORE] 새 그룹 생성 완료 - sgt_idx: {group.sgt_idx}, sgt_title: {group.sgt_title}")
    
    return group

@router.get("/{group_id}/stats", response_model=dict)
def get_group_stats(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 멤버들의 통계 데이터를 조회합니다.
    - 1주일간 일정 개수
    - 위치 데이터 통계
    """
    try:
        logger.info(f"[GET_GROUP_STATS] 그룹 통계 조회 시작 - group_id: {group_id}")
        
        # 그룹이 존재하는지 확인
        group = db.query(Group).filter(Group.sgt_idx == group_id).first()
        if not group:
            logger.error(f"[GET_GROUP_STATS] 그룹을 찾을 수 없음 - group_id: {group_id}")
            raise HTTPException(status_code=404, detail="Group not found")
        
        logger.info(f"[GET_GROUP_STATS] 그룹 정보 - sgt_title: {group.sgt_title}, sgt_show: {group.sgt_show}")
        
        # 그룹 멤버 목록 조회
        group_members = db.query(GroupDetail).filter(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_show == 'Y'
        ).all()
        
        member_ids = [gm.mt_idx for gm in group_members]
        logger.info(f"[GET_GROUP_STATS] 그룹 멤버 수: {len(member_ids)}, 멤버 IDs: {member_ids}")
        
        if not member_ids:
            logger.warning(f"[GET_GROUP_STATS] 그룹에 멤버가 없음 - group_id: {group_id}")
            return {
                "group_id": group_id,
                "group_title": group.sgt_title,
                "member_count": 0,
                "weekly_schedules": 0,
                "total_locations": 0,
                "member_stats": []
            }
        
        # 1주일 전부터 현재까지의 날짜 범위
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        logger.info(f"[GET_GROUP_STATS] 조회 기간: {start_date} ~ {end_date}")
        
        # 각 멤버별 통계 데이터 수집
        member_stats = []
        total_weekly_schedules = 0
        total_locations = 0
        
        for member_id in member_ids:
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 통계 조회 시작")
            
            # 멤버 정보 조회
            member = db.query(Member).filter(Member.mt_idx == member_id).first()
            if not member:
                logger.warning(f"[GET_GROUP_STATS] 멤버 정보를 찾을 수 없음 - mt_idx: {member_id}")
                continue
            
            # 1주일간 일정 개수 조회
            weekly_schedules_query = db.query(func.count(Schedule.sst_idx)).filter(
                Schedule.mt_idx == member_id,
                Schedule.sst_show == 'Y',
                Schedule.sst_sdate >= start_date,
                Schedule.sst_sdate <= end_date
            )
            weekly_schedules = weekly_schedules_query.scalar() or 0
            
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 주간 일정 쿼리: {weekly_schedules_query}")
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 주간 일정 개수: {weekly_schedules}")
            
            # 위치 데이터 개수 조회 (전체)
            member_locations_query = db.query(func.count(Location.slt_idx)).filter(
                Location.mt_idx == member_id,
                Location.slt_show == 'Y'
            )
            member_locations = member_locations_query.scalar() or 0
            
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 전체 위치 쿼리: {member_locations_query}")
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 전체 위치 개수: {member_locations}")
            
            # 이번 주 위치 데이터 개수
            weekly_locations_query = db.query(func.count(Location.slt_idx)).filter(
                Location.mt_idx == member_id,
                Location.slt_show == 'Y',
                Location.slt_wdate >= start_date,
                Location.slt_wdate <= end_date
            )
            weekly_locations = weekly_locations_query.scalar() or 0
            
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 주간 위치 쿼리: {weekly_locations_query}")
            logger.info(f"[GET_GROUP_STATS] 멤버 {member_id} 주간 위치 개수: {weekly_locations}")
            
            member_stat = {
                "mt_idx": member_id,
                "mt_name": member.mt_name or f"멤버 {member_id}",
                "mt_nickname": member.mt_nickname or member.mt_name or f"멤버 {member_id}",
                "weekly_schedules": weekly_schedules,
                "total_locations": member_locations,
                "weekly_locations": weekly_locations,
                "is_owner": any(gm.sgdt_owner_chk == 'Y' for gm in group_members if gm.mt_idx == member_id),
                "is_leader": any(gm.sgdt_leader_chk == 'Y' for gm in group_members if gm.mt_idx == member_id)
            }
            
            member_stats.append(member_stat)
            total_weekly_schedules += weekly_schedules
            total_locations += member_locations
            
            logger.info(f"[GET_GROUP_STATS] 멤버 {member.mt_name}: 주간일정={weekly_schedules}, 전체위치={member_locations}, 주간위치={weekly_locations}")
        
        # 그룹 전체 통계
        result = {
            "group_id": group_id,
            "group_title": group.sgt_title,
            "member_count": len(member_stats),
            "weekly_schedules": total_weekly_schedules,
            "total_locations": total_locations,
            "stats_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": 7
            },
            "member_stats": member_stats
        }
        
        logger.info(f"[GET_GROUP_STATS] 통계 조회 완료 - 멤버수: {len(member_stats)}, 주간일정: {total_weekly_schedules}, 전체위치: {total_locations}")
        logger.info(f"[GET_GROUP_STATS] 최종 결과: {result}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_GROUP_STATS] 오류: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"그룹 통계 조회 중 오류가 발생했습니다: {str(e)}")

@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    join_request: GroupJoinRequest,
    db: Session = Depends(deps.get_db),
    authorization: str = Header(None)
):
    """
    그룹에 가입합니다.
    """
    logger.info(f"[JOIN_GROUP] 그룹 가입 요청 시작 - group_id: {group_id}, mt_idx: {join_request.mt_idx}")
    
    # 그룹 존재 확인
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    
    if group.sgt_show != 'Y':
        raise HTTPException(status_code=404, detail="존재하지 않는 그룹입니다.")
    
    # 사용자 존재 확인
    member = db.query(Member).filter(Member.mt_idx == join_request.mt_idx).first()
    if not member:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 이미 그룹에 가입되어 있는지 확인
    existing_membership = db.query(GroupDetail).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.mt_idx == join_request.mt_idx,
            GroupDetail.sgdt_exit == 'N'
        )
    ).first()
    
    if existing_membership:
        if existing_membership.sgdt_show == 'Y':
            raise HTTPException(status_code=400, detail="이미 그룹에 가입되어 있습니다.")
        else:
            # 이전에 탈퇴했던 경우 재가입 처리
            logger.info(f"[JOIN_GROUP] 재가입 처리 - sgdt_idx: {existing_membership.sgdt_idx}")
            existing_membership.sgdt_show = 'Y'
            existing_membership.sgdt_exit = 'N'
            existing_membership.sgdt_udate = datetime.utcnow()
            db.add(existing_membership)
            db.commit()
            
            return {
                "success": True,
                "message": "그룹에 성공적으로 재가입되었습니다.",
                "data": {
                    "sgdt_idx": existing_membership.sgdt_idx,
                    "sgt_idx": group_id,
                    "mt_idx": join_request.mt_idx,
                    "sgdt_owner_chk": existing_membership.sgdt_owner_chk,
                    "sgdt_leader_chk": existing_membership.sgdt_leader_chk,
                    "sgdt_wdate": existing_membership.sgdt_wdate.isoformat() if existing_membership.sgdt_wdate else datetime.utcnow().isoformat()
                }
            }
    
    # 새로운 그룹 멤버십 생성
    try:
        new_membership = GroupDetail(
            sgt_idx=group_id,
            mt_idx=join_request.mt_idx,
            sgdt_owner_chk='N',  # 기본값: 일반 멤버
            sgdt_leader_chk='N',  # 기본값: 일반 멤버
            sgdt_discharge='N',
            sgdt_group_chk='Y',
            sgdt_exit='N',
            sgdt_show='Y',
            sgdt_push_chk='Y',
            sgdt_wdate=datetime.utcnow(),
            sgdt_udate=datetime.utcnow()
        )
        
        db.add(new_membership)
        db.commit()
        db.refresh(new_membership)
        
        logger.info(f"[JOIN_GROUP] 그룹 가입 성공 - sgdt_idx: {new_membership.sgdt_idx}")
        
        return {
            "success": True,
            "message": "그룹에 성공적으로 가입되었습니다.",
            "data": {
                "sgdt_idx": new_membership.sgdt_idx,
                "sgt_idx": group_id,
                "mt_idx": join_request.mt_idx,
                "sgdt_owner_chk": new_membership.sgdt_owner_chk,
                "sgdt_leader_chk": new_membership.sgdt_leader_chk,
                "sgdt_wdate": new_membership.sgdt_wdate.isoformat() if new_membership.sgdt_wdate else datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"[JOIN_GROUP] 그룹 가입 실패: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="그룹 가입 중 오류가 발생했습니다.")

@router.post("/{group_id}/join-new-member")
def join_new_member_to_group(
    group_id: int,
    join_request: GroupJoinRequest,
    db: Session = Depends(deps.get_db)
):
    """
    새로 가입한 회원을 그룹에 가입시킵니다. (인증 없이 호출 가능)
    """
    logger.info(f"[JOIN_NEW_MEMBER] 새 회원 그룹 가입 요청 - group_id: {group_id}, mt_idx: {join_request.mt_idx}")
    
    # 그룹 존재 확인
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    
    if group.sgt_show != 'Y':
        raise HTTPException(status_code=404, detail="존재하지 않는 그룹입니다.")
    
    # 사용자 존재 확인
    member = db.query(Member).filter(Member.mt_idx == join_request.mt_idx).first()
    if not member:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 이미 그룹에 가입되어 있는지 확인
    existing_membership = db.query(GroupDetail).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.mt_idx == join_request.mt_idx
        )
    ).first()
    
    if existing_membership:
        if existing_membership.sgdt_show == 'Y' and existing_membership.sgdt_exit == 'N':
            raise HTTPException(status_code=400, detail="이미 그룹에 가입되어 있습니다.")
        else:
            # 이전에 탈퇴했던 경우 재가입 처리
            logger.info(f"[JOIN_NEW_MEMBER] 재가입 처리 - sgdt_idx: {existing_membership.sgdt_idx}")
            existing_membership.sgdt_show = 'Y'
            existing_membership.sgdt_exit = 'N'
            existing_membership.sgdt_discharge = 'N'
            existing_membership.sgdt_udate = datetime.utcnow()
            db.add(existing_membership)
            db.commit()
            
            return {
                "success": True,
                "message": "그룹에 성공적으로 재가입되었습니다.",
                "data": {
                    "sgdt_idx": existing_membership.sgdt_idx,
                    "sgt_idx": group_id,
                    "mt_idx": join_request.mt_idx,
                    "sgdt_owner_chk": existing_membership.sgdt_owner_chk,
                    "sgdt_leader_chk": existing_membership.sgdt_leader_chk,
                    "sgdt_wdate": existing_membership.sgdt_wdate.isoformat() if existing_membership.sgdt_wdate else datetime.utcnow().isoformat()
                }
            }
    
    # 새로운 그룹 멤버십 생성
    try:
        new_membership = GroupDetail(
            sgt_idx=group_id,
            mt_idx=join_request.mt_idx,
            sgdt_owner_chk='N',  # 기본값: 일반 멤버
            sgdt_leader_chk='N',  # 기본값: 일반 멤버
            sgdt_discharge='N',
            sgdt_group_chk='Y',
            sgdt_exit='N',
            sgdt_show='Y',
            sgdt_push_chk='Y',
            sgdt_wdate=datetime.utcnow(),
            sgdt_udate=datetime.utcnow()
        )
        
        db.add(new_membership)
        db.commit()
        db.refresh(new_membership)
        
        logger.info(f"[JOIN_NEW_MEMBER] 새 회원 그룹 가입 성공 - sgdt_idx: {new_membership.sgdt_idx}")
        
        return {
            "success": True,
            "message": "새 회원이 그룹에 성공적으로 가입되었습니다.",
            "data": {
                "sgdt_idx": new_membership.sgdt_idx,
                "sgt_idx": group_id,
                "mt_idx": join_request.mt_idx,
                "sgdt_owner_chk": new_membership.sgdt_owner_chk,
                "sgdt_leader_chk": new_membership.sgdt_leader_chk,
                "sgdt_wdate": new_membership.sgdt_wdate.isoformat() if new_membership.sgdt_wdate else datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"[JOIN_NEW_MEMBER] 새 회원 그룹 가입 실패: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="그룹 가입 중 오류가 발생했습니다.")

@router.get("/{group_id}/public")
def get_group_public_info(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹의 공개 정보를 조회합니다. (인증 없이 접근 가능)
    그룹 가입 페이지에서 사용됩니다.
    """
    logger.info(f"[GET_GROUP_PUBLIC] 공개 그룹 정보 조회 - group_id: {group_id}")
    
    # 그룹 존재 확인
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        logger.error(f"[GET_GROUP_PUBLIC] 그룹을 찾을 수 없음 - group_id: {group_id}")
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    
    # 활성화된 그룹만 공개
    if group.sgt_show != 'Y':
        logger.error(f"[GET_GROUP_PUBLIC] 비활성화된 그룹 - group_id: {group_id}")
        raise HTTPException(status_code=404, detail="존재하지 않는 그룹입니다.")
    
    # 그룹 멤버 수 조회
    member_count = db.query(GroupDetail).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N'
        )
    ).count()
    
    logger.info(f"[GET_GROUP_PUBLIC] 공개 그룹 정보 조회 성공 - group_id: {group_id}, member_count: {member_count}")
    
    # 공개 정보만 반환 (민감한 정보 제외)
    return {
        "success": True,
        "data": {
            "sgt_idx": group.sgt_idx,
            "sgt_title": group.sgt_title,
            "sgt_content": group.sgt_content,
            "sgt_memo": group.sgt_memo,
            "sgt_show": group.sgt_show,
            "sgt_wdate": group.sgt_wdate.isoformat() if group.sgt_wdate else None,
            "memberCount": member_count
        }
    } 