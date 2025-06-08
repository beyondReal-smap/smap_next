from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.api import deps
from app.models.member import Member
from app.models.group_detail import GroupDetail
from app.schemas.member import (
    MemberCreate, 
    MemberUpdate, 
    MemberResponse, 
    RegisterRequest, 
    RegisterResponse,
    MemberLogin,
    MemberLoginResponse,
    GoogleLoginRequest,
    GoogleLoginResponse
)
from app.services.member_service import member_service
from app.models.enums import StatusEnum
from datetime import datetime

router = APIRouter()

@router.post("/register", response_model=RegisterResponse)
def register_member(
    register_data: RegisterRequest,
    db: Session = Depends(deps.get_db)
):
    """
    회원가입
    """
    return member_service.register_member(db, register_data)

@router.post("/login", response_model=MemberLoginResponse)
def login_member(
    login_data: MemberLogin,
    db: Session = Depends(deps.get_db)
):
    """
    로그인
    """
    return member_service.login_member(db, login_data.mt_id, login_data.mt_pwd)

@router.post("/google-login", response_model=GoogleLoginResponse)
def google_login(
    google_data: GoogleLoginRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Google 로그인
    """
    return member_service.google_login(db, google_data)

@router.get("/check/phone/{phone}")
def check_phone_availability(
    phone: str,
    db: Session = Depends(deps.get_db)
):
    """
    전화번호 사용 가능 여부 확인
    """
    is_available = member_service.check_phone_availability(db, phone)
    return {
        "available": is_available,
        "message": "사용 가능한 전화번호입니다." if is_available else "이미 가입된 전화번호입니다."
    }

@router.get("/check/email/{email}")
def check_email_availability(
    email: str,
    db: Session = Depends(deps.get_db)
):
    """
    이메일 사용 가능 여부 확인
    """
    is_available = member_service.check_email_availability(db, email)
    return {
        "available": is_available,
        "message": "사용 가능한 이메일입니다." if is_available else "이미 가입된 이메일입니다."
    }

@router.get("/check/nickname/{nickname}")
def check_nickname_availability(
    nickname: str,
    db: Session = Depends(deps.get_db)
):
    """
    닉네임 사용 가능 여부 확인
    """
    is_available = member_service.check_nickname_availability(db, nickname)
    return {
        "available": is_available,
        "message": "사용 가능한 닉네임입니다." if is_available else "이미 사용 중인 닉네임입니다."
    }

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
    AuthContext의 getUserProfile에서 사용
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # home/page.tsx의 Member 타입에 맞게 데이터 변환
    member_data = {
        "mt_idx": member.mt_idx,
        "mt_type": member.mt_type or 1,
        "mt_level": member.mt_level or 2,
        "mt_status": member.mt_status or 1,
        "mt_id": member.mt_id or "",
        "mt_name": member.mt_name or "",
        "mt_nickname": member.mt_nickname or "",
        "mt_hp": member.mt_hp or "",
        "mt_email": member.mt_email or "",
        "mt_birth": member.mt_birth.isoformat() if member.mt_birth else "",
        "mt_gender": member.mt_gender or 1,
        "mt_file1": member.mt_file1 or "",
        "mt_lat": float(member.mt_lat) if member.mt_lat else 37.5642,
        "mt_long": float(member.mt_long) if member.mt_long else 127.0016,
        "mt_sido": member.mt_sido or "",
        "mt_gu": member.mt_gu or "",
        "mt_dong": member.mt_dong or "",
        "mt_onboarding": member.mt_onboarding or 'Y',
        "mt_push1": member.mt_push1 or 'Y',
        "mt_plan_check": member.mt_plan_check or 'N',
        "mt_plan_date": member.mt_plan_date.isoformat() if member.mt_plan_date else "",
        "mt_weather_pop": member.mt_weather_pop or "",
        "mt_weather_sky": member.mt_weather_sky or 8,
        "mt_weather_tmn": member.mt_weather_tmn or 18,
        "mt_weather_tmx": member.mt_weather_tmx or 25,
        "mt_weather_date": member.mt_weather_date.isoformat() if member.mt_weather_date else datetime.utcnow().isoformat(),
        "mt_ldate": member.mt_ldate.isoformat() if member.mt_ldate else datetime.utcnow().isoformat(),
        "mt_adate": member.mt_adate.isoformat() if member.mt_adate else datetime.utcnow().isoformat()
    }
    
    return member_data

@router.get("/group/{group_id}", response_model=List[dict])
def get_group_members(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹의 멤버 목록을 조회합니다.
    home/page.tsx의 memberService.getGroupMembers()에서 사용
    Member 정보와 GroupDetail 정보를 합쳐서 반환
    """
    # 그룹에 속한 멤버들과 그룹 상세 정보를 조인하여 조회
    members_with_details = db.query(Member, GroupDetail).join(
        GroupDetail, Member.mt_idx == GroupDetail.mt_idx
    ).filter(
        and_(
            GroupDetail.sgt_idx == group_id,
            GroupDetail.sgdt_show == 'Y',
            GroupDetail.sgdt_exit == 'N',
            GroupDetail.sgdt_discharge == 'N'
        )
    ).all()
    
    result = []
    for member, group_detail in members_with_details:
        member_data = {
            # Member 정보
            "mt_idx": member.mt_idx,
            "mt_type": member.mt_type or 1,
            "mt_level": member.mt_level or 2,
            "mt_status": member.mt_status or 1,
            "mt_id": member.mt_id or "",
            "mt_name": member.mt_name or "",
            "mt_nickname": member.mt_nickname or "",
            "mt_hp": member.mt_hp or "",
            "mt_email": member.mt_email or "",
            "mt_birth": member.mt_birth.isoformat() if member.mt_birth else "",
            "mt_gender": member.mt_gender or 1,
            "mt_file1": member.mt_file1 or "",
            "mt_lat": float(member.mt_lat) if member.mt_lat else 37.5642,
            "mt_long": float(member.mt_long) if member.mt_long else 127.0016,
            "mt_sido": member.mt_sido or "",
            "mt_gu": member.mt_gu or "",
            "mt_dong": member.mt_dong or "",
            "mt_onboarding": member.mt_onboarding or 'Y',
            "mt_push1": member.mt_push1 or 'Y',
            "mt_plan_check": member.mt_plan_check or 'N',
            "mt_plan_date": member.mt_plan_date.isoformat() if member.mt_plan_date else "",
            "mt_weather_pop": member.mt_weather_pop or "",
            "mt_weather_sky": member.mt_weather_sky or 8,
            "mt_weather_tmn": member.mt_weather_tmn or 18,
            "mt_weather_tmx": member.mt_weather_tmx or 25,
            "mt_weather_date": member.mt_weather_date.isoformat() if member.mt_weather_date else datetime.utcnow().isoformat(),
            "mt_ldate": member.mt_ldate.isoformat() if member.mt_ldate else datetime.utcnow().isoformat(),
            "mt_adate": member.mt_adate.isoformat() if member.mt_adate else datetime.utcnow().isoformat(),
            # GroupDetail 정보
            "sgdt_idx": group_detail.sgdt_idx,
            "sgt_idx": group_detail.sgt_idx,
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
        result.append(member_data)
    
    return result

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
    AuthContext의 updateUserProfile에서 사용
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
    
    # home/page.tsx의 Member 타입에 맞게 데이터 변환하여 반환
    member_data = {
        "mt_idx": member.mt_idx,
        "mt_type": member.mt_type or 1,
        "mt_level": member.mt_level or 2,
        "mt_status": member.mt_status or 1,
        "mt_id": member.mt_id or "",
        "mt_name": member.mt_name or "",
        "mt_nickname": member.mt_nickname or "",
        "mt_hp": member.mt_hp or "",
        "mt_email": member.mt_email or "",
        "mt_birth": member.mt_birth.isoformat() if member.mt_birth else "",
        "mt_gender": member.mt_gender or 1,
        "mt_file1": member.mt_file1 or "",
        "mt_lat": float(member.mt_lat) if member.mt_lat else 37.5642,
        "mt_long": float(member.mt_long) if member.mt_long else 127.0016,
        "mt_sido": member.mt_sido or "",
        "mt_gu": member.mt_gu or "",
        "mt_dong": member.mt_dong or "",
        "mt_onboarding": member.mt_onboarding or 'Y',
        "mt_push1": member.mt_push1 or 'Y',
        "mt_plan_check": member.mt_plan_check or 'N',
        "mt_plan_date": member.mt_plan_date.isoformat() if member.mt_plan_date else "",
        "mt_weather_pop": member.mt_weather_pop or "",
        "mt_weather_sky": member.mt_weather_sky or 8,
        "mt_weather_tmn": member.mt_weather_tmn or 18,
        "mt_weather_tmx": member.mt_weather_tmx or 25,
        "mt_weather_date": member.mt_weather_date.isoformat() if member.mt_weather_date else datetime.utcnow().isoformat(),
        "mt_ldate": member.mt_ldate.isoformat() if member.mt_ldate else datetime.utcnow().isoformat(),
        "mt_adate": member.mt_adate.isoformat() if member.mt_adate else datetime.utcnow().isoformat()
    }
    
    return member_data

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