from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.group import Group
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse

router = APIRouter()

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

@router.get("/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹을 조회합니다.
    """
    group = db.query(Group.__table__).filter(Group.gt_idx == group_id).first()
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
    group = db.query(Group.__table__).filter(Group.gt_idx == group_id).first()
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
    group = db.query(Group.__table__).filter(Group.gt_idx == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    db.delete(group)
    db.commit()
    return group 