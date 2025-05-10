from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.push_fcm import PushFCM
from app.schemas.push_fcm import PushFCMCreate, PushFCMUpdate, PushFCMResponse

router = APIRouter()

@router.get("/", response_model=List[PushFCMResponse])
def get_push_fcms(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    FCM 푸시 목록을 조회합니다.
    """
    push_fcms = db.query(PushFCM).offset(skip).limit(limit).all()
    return push_fcms

@router.get("/{push_fcm_id}", response_model=PushFCMResponse)
def get_push_fcm(
    push_fcm_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 FCM 푸시를 조회합니다.
    """
    push_fcm = PushFCM.find_by_idx(db, push_fcm_id)
    if not push_fcm:
        raise HTTPException(status_code=404, detail="Push FCM not found")
    return push_fcm

@router.get("/member/{member_id}", response_model=List[PushFCMResponse])
def get_member_push_fcms(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 FCM 푸시 목록을 조회합니다.
    """
    push_fcms = PushFCM.find_by_member(db, member_id)
    return push_fcms

@router.get("/code/{code}", response_model=List[PushFCMResponse])
def get_push_fcms_by_code(
    code: str,
    db: Session = Depends(deps.get_db)
):
    """
    특정 코드의 FCM 푸시 목록을 조회합니다.
    """
    push_fcms = PushFCM.find_by_code(db, code)
    return push_fcms

@router.get("/now", response_model=List[PushFCMResponse])
def get_now_push_fcms(
    db: Session = Depends(deps.get_db)
):
    """
    현재 시간의 FCM 푸시 목록을 조회합니다.
    """
    push_fcms = PushFCM.find_push_list(db)
    return push_fcms

@router.post("/", response_model=PushFCMResponse)
def create_push_fcm(
    push_fcm_in: PushFCMCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 FCM 푸시를 생성합니다.
    """
    push_fcm = PushFCM(**push_fcm_in.dict())
    db.add(push_fcm)
    db.commit()
    db.refresh(push_fcm)
    return push_fcm

@router.put("/{push_fcm_id}", response_model=PushFCMResponse)
def update_push_fcm(
    push_fcm_id: int,
    push_fcm_in: PushFCMUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    FCM 푸시 정보를 업데이트합니다.
    """
    push_fcm = PushFCM.find_by_idx(db, push_fcm_id)
    if not push_fcm:
        raise HTTPException(status_code=404, detail="Push FCM not found")
    
    for field, value in push_fcm_in.dict(exclude_unset=True).items():
        setattr(push_fcm, field, value)
    
    db.add(push_fcm)
    db.commit()
    db.refresh(push_fcm)
    return push_fcm

@router.delete("/{push_fcm_id}")
def delete_push_fcm(
    push_fcm_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    FCM 푸시를 삭제합니다.
    """
    push_fcm = PushFCM.find_by_idx(db, push_fcm_id)
    if not push_fcm:
        raise HTTPException(status_code=404, detail="Push FCM not found")
    
    db.delete(push_fcm)
    db.commit()
    return {"message": "Push FCM deleted successfully"} 