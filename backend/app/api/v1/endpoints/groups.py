from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_, text
from jose import jwt, JWTError
from app.api import deps
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.models.member import Member
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

@router.post("/", response_model=GroupResponse)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 그룹을 생성합니다.
    """
    group = Group(**group_in.dict())
    db.add(group)
    db.commit()
    db.refresh(group)
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

@router.get("/{group_id}/members-with-details", response_model=List[dict])
def get_group_members_with_details(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 멤버들의 완전한 정보를 조회합니다 (member_t + smap_group_detail_t 조인).
    프론트엔드에서 사용자 요청에 따라 새로 추가된 엔드포인트입니다.
    """
    try:
        # Raw SQL을 사용하여 두 테이블을 조인
        sql = text("""
            SELECT 
                -- member_t의 모든 컬럼
                m.mt_idx,
                m.mt_type,
                m.mt_level,
                m.mt_status,
                m.mt_id,
                m.mt_name,
                m.mt_nickname,
                m.mt_hp,
                m.mt_email,
                m.mt_show,
                m.mt_wdate,
                m.mt_ldate,
                m.mt_udate,
                m.mt_lang,
                m.mt_lat,
                m.mt_long,
                m.mt_sido,
                m.mt_gu,
                m.mt_dong,
                m.mt_file1,
                m.mt_gender,
                m.mt_weather_pop,
                m.mt_weather_tmn,
                m.mt_weather_tmx,
                m.mt_weather_sky,
                m.mt_weather_date,
                
                -- smap_group_detail_t의 모든 컬럼
                sgd.sgdt_idx,
                sgd.sgt_idx,
                sgd.sgdt_owner_chk,
                sgd.sgdt_leader_chk,
                sgd.sgdt_discharge,
                sgd.sgdt_group_chk,
                sgd.sgdt_exit,
                sgd.sgdt_show as sgdt_show,
                sgd.sgdt_push_chk,
                sgd.sgdt_wdate,
                sgd.sgdt_udate,
                sgd.sgdt_ddate,
                sgd.sgdt_xdate,
                sgd.sgdt_adate
                
            FROM smap_group_detail_t sgd
            INNER JOIN member_t m ON sgd.mt_idx = m.mt_idx
            WHERE sgd.sgt_idx = :group_id
              AND (sgd.sgdt_exit IS NULL OR sgd.sgdt_exit != 'Y')
              AND (sgd.sgdt_discharge IS NULL OR sgd.sgdt_discharge != 'Y')
              AND (sgd.sgdt_show IS NULL OR sgd.sgdt_show = 'Y')
            ORDER BY sgd.sgdt_owner_chk DESC, sgd.sgdt_leader_chk DESC, m.mt_name ASC
        """)
        
        result = db.execute(sql, {"group_id": group_id}).fetchall()
        
        # 결과를 딕셔너리 형태로 변환
        members_with_details = []
        for row in result:
            member_data = {
                # member_t 필드들
                "mt_idx": row.mt_idx,
                "mt_type": row.mt_type,
                "mt_level": row.mt_level,
                "mt_status": row.mt_status,
                "mt_id": row.mt_id,
                "mt_name": row.mt_name,
                "mt_nickname": row.mt_nickname,
                "mt_hp": row.mt_hp,
                "mt_email": row.mt_email,
                "mt_show": row.mt_show,
                "mt_wdate": str(row.mt_wdate) if row.mt_wdate else None,
                "mt_ldate": str(row.mt_ldate) if row.mt_ldate else None,
                "mt_udate": str(row.mt_udate) if row.mt_udate else None,
                "mt_lang": row.mt_lang,
                "mt_lat": float(row.mt_lat) if row.mt_lat else None,
                "mt_long": float(row.mt_long) if row.mt_long else None,
                "mt_sido": row.mt_sido,
                "mt_gu": row.mt_gu,
                "mt_dong": row.mt_dong,
                "mt_file1": row.mt_file1,
                "mt_gender": row.mt_gender,
                "mt_weather_pop": row.mt_weather_pop,
                "mt_weather_tmn": row.mt_weather_tmn,
                "mt_weather_tmx": row.mt_weather_tmx,
                "mt_weather_sky": row.mt_weather_sky,
                "mt_weather_date": str(row.mt_weather_date) if row.mt_weather_date else None,
                
                # smap_group_detail_t 필드들
                "sgdt_idx": row.sgdt_idx,
                "sgt_idx": row.sgt_idx,
                "sgdt_owner_chk": row.sgdt_owner_chk,
                "sgdt_leader_chk": row.sgdt_leader_chk,
                "sgdt_discharge_chk": row.sgdt_discharge,
                "sgdt_group_chk": row.sgdt_group_chk,
                "sgdt_exit_chk": row.sgdt_exit,
                "sgdt_show": row.sgdt_show,
                "sgdt_push_chk": row.sgdt_push_chk,
                "sgdt_wdate": str(row.sgdt_wdate) if row.sgdt_wdate else None,
                "sgdt_udate": str(row.sgdt_udate) if row.sgdt_udate else None,
                "sgdt_ddate": str(row.sgdt_ddate) if row.sgdt_ddate else None,
                "sgdt_xdate": str(row.sgdt_xdate) if row.sgdt_xdate else None,
                "sgdt_adate": str(row.sgdt_adate) if row.sgdt_adate else None,
            }
            members_with_details.append(member_data)
        
        return members_with_details
        
    except Exception as e:
        print(f"Error in get_group_members_with_details: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 