from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.group_detail import GroupDetail
from app.schemas.group_detail import GroupDetailCreate, GroupDetailUpdate, GroupDetailResponse

router = APIRouter()

@router.get("/", response_model=List[GroupDetailResponse])
def get_group_details(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    그룹 상세 목록을 조회합니다.
    """
    group_details = db.query(GroupDetail).offset(skip).limit(limit).all()
    return group_details

@router.get("/{group_detail_id}", response_model=GroupDetailResponse)
def get_group_detail(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹 상세를 조회합니다.
    """
    group_detail = GroupDetail.find_by_idx(db, group_detail_id)
    if not group_detail:
        raise HTTPException(status_code=404, detail="Group detail not found")
    return group_detail

@router.get("/member/{member_id}", response_model=List[GroupDetailResponse])
def get_member_group_details(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 그룹 상세 목록을 조회합니다.
    """
    group_details = GroupDetail.find_by_member(db, member_id)
    return group_details

@router.get("/group/{group_id}/owner", response_model=List[GroupDetailResponse])
def get_group_owners(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹의 소유자 목록을 조회합니다.
    """
    group_details = GroupDetail.find_owner(db, group_id)
    return group_details

@router.get("/group/{group_id}/leader", response_model=List[GroupDetailResponse])
def get_group_leaders(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹의 리더 목록을 조회합니다.
    """
    group_details = GroupDetail.find_leader(db, group_id)
    return group_details

@router.get("/group/{group_id}/members", response_model=List[GroupDetailResponse])
def get_group_members(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹의 멤버 목록을 조회합니다.
    """
    group_details = GroupDetail.get_member_list(db, group_id)
    return group_details

@router.post("/", response_model=GroupDetailResponse)
def create_group_detail(
    group_detail_in: GroupDetailCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 그룹 상세를 생성합니다.
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
    group_detail = GroupDetail.find_by_idx(db, group_detail_id)
    if not group_detail:
        raise HTTPException(status_code=404, detail="Group detail not found")
    
    for field, value in group_detail_in.dict(exclude_unset=True).items():
        setattr(group_detail, field, value)
    
    db.add(group_detail)
    db.commit()
    db.refresh(group_detail)
    return group_detail

@router.delete("/{group_detail_id}")
def delete_group_detail(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹 상세를 삭제합니다.
    """
    group_detail = GroupDetail.find_by_idx(db, group_detail_id)
    if not group_detail:
        raise HTTPException(status_code=404, detail="Group detail not found")
    
    db.delete(group_detail)
    db.commit()
    return {"message": "Group detail deleted successfully"} 