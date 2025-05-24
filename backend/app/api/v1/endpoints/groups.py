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
    그룹 목록을 조회합니다.
    """
    groups = db.query(Group.__table__).offset(skip).limit(limit).all()
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
    
    # 사용자가 속한 그룹들을 GroupDetail과 Group을 조인하여 조회
    user_groups = db.query(Group, GroupDetail).join(
        GroupDetail, Group.sgt_idx == GroupDetail.sgt_idx
    ).filter(
        and_(
            GroupDetail.mt_idx == user_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N',
            Group.sgt_show == 'Y'
        )
    ).all()
    
    result = []
    for group, group_detail in user_groups:
        group_data = {
            "sgt_idx": group.sgt_idx,
            "mt_idx": group.mt_idx,  # 그룹 오너 ID
            "sgt_title": group.sgt_title or f"그룹 {group.sgt_idx}",
            "sgt_code": group.sgt_code or "",
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
    group = db.query(Group.__table__).filter(Group.sgt_idx == group_id).first()
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
    groups = Group.find_by_member(db, member_id)
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
    group = db.query(Group.__table__).filter(Group.sgt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    for field, value in group_in.dict(exclude_unset=True).items():
        setattr(group, field, value)
    
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/{group_id}", response_model=GroupResponse)
def delete_group(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹을 삭제합니다.
    """
    group = db.query(Group.__table__).filter(Group.sgt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    db.delete(group)
    db.commit()
    return group 