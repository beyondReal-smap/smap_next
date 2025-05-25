from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_
from jose import jwt, JWTError
import hashlib
import random
import string
from app.api import deps
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse
from app.core.config import settings
from datetime import datetime
from app.models.enums import ShowEnum
import traceback
import logging

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()

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

@router.get("/", response_model=List[GroupResponse])
def get_groups(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    그룹 목록을 조회합니다. (sgt_show = 'Y'인 그룹만)
    """
    groups = db.query(Group).filter(Group.sgt_show == 'Y').offset(skip).limit(limit).all()
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
    그룹 정보를 업데이트합니다.
    """
    try:
        # 먼저 그룹이 존재하는지 확인
        group = db.query(Group).filter(Group.sgt_idx == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # 업데이트할 필드들을 개별적으로 처리
        updated = False
        
        if group_in.sgt_title is not None:
            group.sgt_title = group_in.sgt_title
            updated = True
            
        if group_in.sgt_memo is not None:
            group.sgt_memo = group_in.sgt_memo
            updated = True
            
        if group_in.sgt_code is not None:
            group.sgt_code = group_in.sgt_code
            updated = True
            
        if group_in.mt_idx is not None:
            group.mt_idx = group_in.mt_idx
            updated = True
            
        if group_in.sgt_show is not None:
            group.sgt_show = group_in.sgt_show
            updated = True
        
        # 업데이트된 필드가 있으면 업데이트 시간 설정
        if updated:
            group.sgt_udate = datetime.utcnow()
            db.commit()
            db.refresh(group)
        
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

@router.delete("/{group_id}", response_model=GroupResponse)
def delete_group(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹을 삭제합니다. (실제로는 sgt_show를 'N'으로 변경하여 숨김 처리)
    """
    logger.info(f"[DELETE_GROUP] 그룹 삭제 요청 시작 - group_id: {group_id}")
    
    group = db.query(Group).filter(Group.sgt_idx == group_id).first()
    if not group:
        logger.error(f"[DELETE_GROUP] 그룹을 찾을 수 없음 - group_id: {group_id}")
        raise HTTPException(status_code=404, detail="Group not found")
    
    logger.info(f"[DELETE_GROUP] 삭제 전 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
    
    # 실제 삭제 대신 sgt_show를 'N'으로 변경
    group.sgt_show = 'N'
    group.sgt_udate = datetime.utcnow()  # 업데이트 시간 설정
    
    logger.info(f"[DELETE_GROUP] 소프트 삭제 실행 - sgt_show를 'N'으로 변경")
    
    db.commit()
    db.refresh(group)
    
    logger.info(f"[DELETE_GROUP] 삭제 후 그룹 상태 - sgt_show: {group.sgt_show}, sgt_title: {group.sgt_title}")
    logger.info(f"[DELETE_GROUP] 그룹 소프트 삭제 완료 - group_id: {group_id}")
    
    return group 