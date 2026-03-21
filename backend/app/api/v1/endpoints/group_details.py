from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.api import deps
from app.models.group_detail import GroupDetail
from app.schemas.group_detail import GroupDetailCreate, GroupDetailUpdate, GroupDetailResponse
from app.models.enums import LeaderCheckEnum, ShowEnum, ExitEnum
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# 멤버 역할 변경을 위한 스키마
class MemberRoleUpdate(BaseModel):
    sgdt_leader_chk: str

# 멤버 탈퇴를 위한 스키마  
class MemberRemove(BaseModel):
    sgdt_show: str = 'N'
    sgdt_exit: str = 'Y'

@router.get("/", response_model=List[GroupDetailResponse])
def get_group_details(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    그룹 상세 정보 목록을 조회합니다.
    """
    group_details = db.query(GroupDetail).offset(skip).limit(limit).all()
    return group_details

@router.get("/{group_detail_id}", response_model=GroupDetailResponse)
def get_group_detail(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹 상세 정보를 조회합니다.
    """
    group_detail = db.query(GroupDetail).filter(GroupDetail.sgdt_idx == group_detail_id).first()
    if not group_detail:
        raise HTTPException(status_code=404, detail="GroupDetail not found")
    return group_detail

@router.get("/member/{member_id}", response_model=List[dict])
def get_member_group_details(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 멤버가 속한 그룹 상세 정보 목록을 조회합니다.
    home/page.tsx의 AuthContext에서 사용
    """
    group_details = db.query(GroupDetail).filter(
        and_(
            GroupDetail.mt_idx == member_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N'
        )
    ).all()
    
    result = []
    for group_detail in group_details:
        detail_data = {
            "sgdt_idx": group_detail.sgdt_idx,
            "sgt_idx": group_detail.sgt_idx,
            "mt_idx": group_detail.mt_idx,
            "sgdt_owner_chk": group_detail.sgdt_owner_chk or 'N',
            "sgdt_leader_chk": group_detail.sgdt_leader_chk or 'N',
            "sgdt_discharge": group_detail.sgdt_discharge or 'N',
            "sgdt_group_chk": group_detail.sgdt_group_chk or 'Y',
            "sgdt_exit": group_detail.sgdt_exit or 'N',
            "sgdt_show": group_detail.sgdt_show or 'Y',
            "sgdt_push_chk": group_detail.sgdt_push_chk or 'Y',
            "sgdt_wdate": group_detail.sgdt_wdate.isoformat() if group_detail.sgdt_wdate else datetime.utcnow().isoformat(),
            "sgdt_udate": group_detail.sgdt_udate.isoformat() if group_detail.sgdt_udate else datetime.utcnow().isoformat(),
            "sgdt_ddate": group_detail.sgdt_ddate.isoformat() if group_detail.sgdt_ddate else "",
            "sgdt_xdate": group_detail.sgdt_xdate.isoformat() if group_detail.sgdt_xdate else "",
            "sgdt_adate": group_detail.sgdt_adate.isoformat() if group_detail.sgdt_adate else ""
        }
        result.append(detail_data)
    
    return result

@router.get("/group/{group_id}", response_model=List[GroupDetailResponse])
def get_group_member_details(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹의 멤버 상세 정보 목록을 조회합니다.
    """
    group_details = db.query(GroupDetail).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N'
        )
    ).all()
    return group_details

@router.post("/", response_model=GroupDetailResponse)
def create_group_detail(
    group_detail_in: GroupDetailCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 그룹 상세 정보를 생성합니다.
    """
    group_detail = GroupDetail(**group_detail_in.dict())
    db.add(group_detail)
    db.commit()
    db.refresh(group_detail)
    return group_detail

@router.put("/{group_detail_id}", response_model=GroupDetailResponse)
def update_group_detail(
    group_detail_id: int,
    group_detail_in: GroupDetailUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 상세 정보를 업데이트합니다.
    """
    group_detail = db.query(GroupDetail).filter(GroupDetail.sgdt_idx == group_detail_id).first()
    if not group_detail:
        raise HTTPException(status_code=404, detail="GroupDetail not found")
    
    update_data = group_detail_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group_detail, field, value)
    
    db.add(group_detail)
    db.commit()
    db.refresh(group_detail)
    return group_detail

@router.put("/{group_detail_id}/role")
def update_member_role(
    group_detail_id: int,
    role_update: MemberRoleUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    멤버의 역할을 변경합니다 (리더 ↔ 일반멤버).
    """
    group_detail = db.query(GroupDetail).filter(GroupDetail.sgdt_idx == group_detail_id).first()
    if not group_detail:
        raise HTTPException(status_code=404, detail="GroupDetail not found")
    
    # 역할 변경
    group_detail.sgdt_leader_chk = LeaderCheckEnum.Y if role_update.sgdt_leader_chk == 'Y' else LeaderCheckEnum.N
    group_detail.sgdt_udate = datetime.utcnow()
    
    db.add(group_detail)
    db.commit()
    db.refresh(group_detail)
    
    return {
        "success": True,
        "message": "멤버 역할이 성공적으로 변경되었습니다.",
        "data": {
            "sgdt_idx": group_detail.sgdt_idx,
            "sgdt_leader_chk": group_detail.sgdt_leader_chk,
            "sgdt_udate": group_detail.sgdt_udate.isoformat()
        }
    }

@router.put("/{group_detail_id}/remove")
def remove_member_from_group(
    group_detail_id: int,
    remove_data: MemberRemove,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에서 멤버를 탈퇴시킵니다 (소프트 삭제).
    """
    group_detail = db.query(GroupDetail).filter(GroupDetail.sgdt_idx == group_detail_id).first()
    if not group_detail:
        raise HTTPException(status_code=404, detail="GroupDetail not found")
    
    # 소프트 삭제 처리
    group_detail.sgdt_show = ShowEnum.N
    group_detail.sgdt_exit = ExitEnum.Y
    group_detail.sgdt_udate = datetime.utcnow()
    
    db.add(group_detail)
    db.commit()
    db.refresh(group_detail)
    
    return {
        "success": True,
        "message": "멤버가 그룹에서 탈퇴되었습니다.",
        "data": {
            "sgdt_idx": group_detail.sgdt_idx,
            "sgdt_show": group_detail.sgdt_show,
            "sgdt_exit": group_detail.sgdt_exit,
            "sgdt_udate": group_detail.sgdt_udate.isoformat()
        }
    }

@router.delete("/{group_detail_id}")
def delete_group_detail(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 상세 정보를 삭제합니다.
    """
    group_detail = db.query(GroupDetail).filter(GroupDetail.sgdt_idx == group_detail_id).first()
    if not group_detail:
        raise HTTPException(status_code=404, detail="GroupDetail not found")
    
    # 실제 삭제 대신 상태 변경
    group_detail.sgdt_exit = 'Y'
    group_detail.sgdt_show = 'N'
    db.add(group_detail)
    db.commit()
    return {"success": True, "message": "GroupDetail deleted successfully"} 