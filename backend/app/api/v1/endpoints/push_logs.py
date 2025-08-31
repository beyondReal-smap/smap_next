from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.push_log import PushLog
from app.schemas.push_log import PushLogCreate, PushLogUpdate, PushLogResponse
from app.models.enums import ShowEnum, ReadCheckEnum
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/", response_model=List[PushLogResponse])
def get_push_logs(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    푸시 로그 목록을 조회합니다.
    """
    push_logs = db.query(PushLog).offset(skip).limit(limit).all()
    return push_logs

@router.get("/{push_log_id}", response_model=PushLogResponse)
def get_push_log(
    push_log_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 푸시 로그를 조회합니다.
    """
    push_log = PushLog.find_by_idx(db, push_log_id)
    if not push_log:
        raise HTTPException(status_code=404, detail="Push log not found")
    return push_log

@router.get("/member/{member_id}", response_model=List[PushLogResponse])
def get_member_push_logs(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 푸시 로그 목록을 조회합니다. (최근 7일)
    """
    # 7일 전 날짜 계산
    seven_days_ago = datetime.now() - timedelta(days=7)

    push_logs = db.query(PushLog).filter(
        PushLog.mt_idx == member_id,
        PushLog.plt_show == ShowEnum.Y,
        PushLog.plt_status == 2,
        PushLog.plt_sdate >= seven_days_ago  # 7일 필터링 추가
    ).order_by(PushLog.plt_sdate.desc()).all()
    return push_logs

@router.get("/recent/{member_id}", response_model=List[PushLogResponse])
def get_recent_member_push_logs(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 최근 푸시 로그 목록을 조회합니다. (최근 7일)
    /member/{member_id}와 동일한 기능으로 호환성 유지
    """
    # 기존의 get_member_push_logs와 동일한 로직 사용
    return get_member_push_logs(member_id, db)

@router.get("/schedule/{schedule_id}", response_model=List[PushLogResponse])
def get_schedule_push_logs(
    schedule_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 일정의 푸시 로그 목록을 조회합니다.
    """
    push_logs = PushLog.find_by_schedule(db, schedule_id)
    return push_logs

@router.get("/member/{member_id}/unread", response_model=List[PushLogResponse])
def get_member_unread_push_logs(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 읽지 않은 푸시 로그 목록을 조회합니다.
    """
    push_logs = PushLog.find_unread(db, member_id)
    return push_logs

@router.post("/", response_model=PushLogResponse)
def create_push_log(
    push_log_in: PushLogCreate,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 푸시 로그를 생성합니다.
    """
    push_log = PushLog(**push_log_in.dict())
    db.add(push_log)
    db.commit()
    db.refresh(push_log)
    return push_log

@router.put("/{push_log_id}", response_model=PushLogResponse)
def update_push_log(
    push_log_id: int,
    push_log_in: PushLogUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    푸시 로그 정보를 업데이트합니다.
    """
    push_log = PushLog.find_by_idx(db, push_log_id)
    if not push_log:
        raise HTTPException(status_code=404, detail="Push log not found")
    
    for field, value in push_log_in.dict(exclude_unset=True).items():
        setattr(push_log, field, value)
    
    db.add(push_log)
    db.commit()
    db.refresh(push_log)
    return push_log

@router.delete("/{push_log_id}")
def delete_push_log(
    push_log_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    푸시 로그를 삭제합니다.
    """
    push_log = PushLog.find_by_idx(db, push_log_id)
    if not push_log:
        raise HTTPException(status_code=404, detail="Push log not found")
    
    db.delete(push_log)
    db.commit()
    return {"message": "Push log deleted successfully"}

@router.post("/delete-all")
def delete_all_push_logs(
    mt_idx: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 모든 푸시 로그를 삭제합니다.
    """
    try:
        # 실제로 삭제하지 않고 plt_show를 'N'으로 변경
        db.query(PushLog).filter(
            PushLog.mt_idx == mt_idx,
            PushLog.plt_show == ShowEnum.Y
        ).update({
            "plt_show": ShowEnum.N,
            "plt_rdate": datetime.now()
        })
        db.commit()
        return {"message": "All push logs deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/read-all")
def read_all_push_logs(
    mt_idx: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 모든 푸시 로그를 읽음 처리합니다.
    """
    try:
        db.query(PushLog).filter(
            PushLog.mt_idx == mt_idx,
            PushLog.plt_read_chk == ReadCheckEnum.N,
            PushLog.plt_show == ShowEnum.Y
        ).update({
            "plt_read_chk": ReadCheckEnum.Y,
            "plt_rdate": datetime.now()
        })
        db.commit()
        return {"message": "All push logs marked as read"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 