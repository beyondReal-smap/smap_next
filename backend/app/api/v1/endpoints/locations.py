from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter()

@router.get("/", response_model=List[LocationResponse])
def get_locations(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    위치 목록을 조회합니다.
    """
    locations = db.query(Location.__table__).offset(skip).limit(limit).all()
    return locations

@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 위치를 조회합니다.
    """
    location = db.query(Location.__table__).filter(Location.lt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@router.get("/member/{member_id}", response_model=List[LocationResponse])
def get_member_locations(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_member(db, member_id)
    return locations

@router.get("/group-detail/{group_detail_id}", response_model=List[LocationResponse])
def get_group_detail_locations(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹 상세의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_group_detail(db, group_detail_id)
    return locations

@router.get("/myplays/in", response_model=List[LocationResponse])
def get_in_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 내부 위치 목록을 조회합니다.
    """
    locations = Location.get_in_myplays_list(db)
    return locations

@router.get("/myplays/out", response_model=List[LocationResponse])
def get_out_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 외부 위치 목록을 조회합니다.
    """
    locations = Location.get_out_myplays_list(db)
    return locations

@router.post("/", response_model=LocationResponse)
def create_location(
    location_in: LocationCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 위치를 생성합니다.
    """
    location = Location(**location_in.dict())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location

@router.put("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    location_in: LocationUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    위치 정보를 업데이트합니다.
    """
    location = db.query(Location.__table__).filter(Location.lt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    
    for field, value in location_in.dict(exclude_unset=True).items():
        setattr(location, field, value)
    
    db.commit()
    db.refresh(location)
    return location

@router.delete("/{location_id}", response_model=LocationResponse)
def delete_location(
    location_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    위치를 삭제합니다.
    """
    location = db.query(Location.__table__).filter(Location.lt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    
    db.delete(location)
    db.commit()
    return location 