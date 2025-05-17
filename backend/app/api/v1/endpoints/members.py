from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.schemas.member import MemberCreate, MemberUpdate, MemberResponse
from app.models.enums import StatusEnum

router = APIRouter()

@router.get("/", response_model=List[MemberResponse])
def get_members(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    id: Optional[int] = Query(None, description="특정 멤버 ID로 필터링")
):
    """
    멤버 목록을 조회합니다.
    특정 ID가 제공되면 해당 멤버만 반환합니다.
    """
    if id:
        member = db.query(Member).filter(Member.mt_idx == id).first()
        return [member] if member else []
    
    members = db.query(Member).offset(skip).limit(limit).all()
    return members

@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 ID의 멤버를 조회합니다.
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@router.post("/", response_model=MemberResponse)
def create_member(
    member_in: MemberCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새 멤버를 생성합니다.
    """
    member = Member(**member_in.dict())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@router.put("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: int,
    member_in: MemberUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    멤버 정보를 업데이트합니다.
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_data = member_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)
    
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@router.delete("/{member_id}")
def delete_member(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    멤버를 삭제합니다.
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.mt_status = 0  # 실제 삭제 대신 상태 변경
    db.add(member)
    db.commit()
    return {"success": True, "message": "Member deleted successfully"}

@router.patch("/{member_id}/location", response_model=MemberResponse)
def update_member_location(
    member_id: int,
    lat: float,
    lng: float,
    db: Session = Depends(deps.get_db)
):
    """
    멤버의 위치 정보를 업데이트합니다.
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.mt_lat = str(lat)
    member.mt_long = str(lng)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member 