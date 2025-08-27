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

@router.get("/pending/{mt_idx}", response_model=List[PushFCMResponse])
def get_pending_push_fcms(
    mt_idx: int,
    db: Session = Depends(deps.get_db),
    since_timestamp: Optional[float] = None
):
    """
    특정 회원의 보류된 FCM 푸시 메시지를 조회합니다.
    앱이 오랫동안 종료되었던 경우 누락되었을 수 있는 메시지들을 확인합니다.
    """
    try:
        # 보류된 메시지 조회 로직
        # 1. 특정 사용자를 대상으로 한 메시지들 중 아직 전송되지 않은 것들
        # 2. 일정 시간 범위 내의 메시지들 (since_timestamp 파라미터로 지정)
        push_fcms = PushFCM.find_pending_messages_for_member(
            db,
            mt_idx,
            since_timestamp=since_timestamp
        )
        return push_fcms
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보류된 메시지 조회 중 오류 발생: {str(e)}")

@router.post("/mark-delivered/{push_fcm_id}")
def mark_push_fcm_delivered(
    push_fcm_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    FCM 푸시 메시지를 전달 완료로 표시합니다.
    """
    try:
        push_fcm = PushFCM.find_by_idx(db, push_fcm_id)
        if not push_fcm:
            raise HTTPException(status_code=404, detail="Push FCM not found")

        # 메시지를 전달 완료로 표시 (필요한 경우 상태 필드 업데이트)
        # 실제 구현은 모델의 구조에 따라 다를 수 있습니다
        if hasattr(push_fcm, 'delivered_at'):
            from datetime import datetime
            push_fcm.delivered_at = datetime.utcnow()

        db.commit()
        return {"message": "메시지가 전달 완료로 표시되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"메시지 상태 업데이트 중 오류 발생: {str(e)}")

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