from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.api import deps
from app.core.config import settings
from app.models.member import Member
from app.models.group_detail import GroupDetail
from app.models.group import Group
from app.models.location import Location
from app.models.enums import ShowEnum
from app.crud import crud_refresh_token
from app.schemas.member import (
    MemberCreate,
    MemberUpdate,
    MemberResponse,
    RegisterRequest,
    RegisterResponse,
    MemberLogin,
    MemberLoginResponse,
    GoogleLoginRequest,
    GoogleLoginResponse,
    VerifyPasswordRequest,
    VerifyPasswordResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    UpdateContactRequest,
    UpdateContactResponse,
    WithdrawRequest,
    WithdrawResponse,
    ConsentUpdate,
    ConsentUpdateAll,
    ConsentResponse,
    ConsentUpdateResponse,
    TermInfo,
    TermsListResponse
)
from app.services.member_service import member_service
from app.crud import crud_auth
from app.crud.crud_member import crud_member
from app.models.enums import StatusEnum
from datetime import datetime
import logging
import os
import uuid
import shutil
from pathlib import Path

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-password", dependencies=[Depends(deps.get_required_user_id)])
def verify_password(
    request: VerifyPasswordRequest,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    현재 비밀번호를 확인합니다.
    """
    logger.info("[VERIFY_PASSWORD] 비밀번호 확인 요청 시작")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[VERIFY_PASSWORD] 인증 토큰이 없거나 유효하지 않음")
            return {
                "result": "N",
                "message": "인증이 필요합니다.",
                "success": False
            }

        logger.info(f"[VERIFY_PASSWORD] 비밀번호 확인 요청 - user_id: {user_id}")

        # 현재 비밀번호 확인
        is_valid = crud_auth.verify_user_password(db, user_id, request.currentPassword)

        if is_valid:
            logger.info(f"[VERIFY_PASSWORD] 비밀번호 확인 성공 - user_id: {user_id}")
            return {
                "result": "Y",
                "message": "비밀번호가 확인되었습니다.",
                "success": True
            }
        else:
            logger.warning(f"[VERIFY_PASSWORD] 비밀번호 확인 실패 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "현재 비밀번호가 올바르지 않습니다.",
                "success": False
            }

    except Exception as e:
        logger.error(f"[VERIFY_PASSWORD] 서버 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "result": "N",
            "message": "서버 오류가 발생했습니다.",
            "success": False
        }

@router.post("/change-password", dependencies=[Depends(deps.get_required_user_id)])
def change_password(
    request: ChangePasswordRequest,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    비밀번호를 변경합니다.
    """
    logger.info("[CHANGE_PASSWORD] 비밀번호 변경 요청 시작")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[CHANGE_PASSWORD] 인증 토큰이 없거나 유효하지 않음")
            return {
                "result": "N",
                "message": "인증이 필요합니다.",
                "success": False
            }

        logger.info(f"[CHANGE_PASSWORD] 비밀번호 변경 요청 - user_id: {user_id}")

        # 사용자 정보 확인
        user = crud_auth.get_user_by_idx(db, user_id)
        if not user:
            logger.warning(f"[CHANGE_PASSWORD] 사용자를 찾을 수 없음 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "사용자를 찾을 수 없습니다.",
                "success": False
            }

        logger.info(f"[CHANGE_PASSWORD] 사용자 확인됨 - user_id: {user_id}, name: {user.mt_name}, id: {user.mt_id}")

        # 현재 비밀번호 확인
        logger.info(f"[CHANGE_PASSWORD] 현재 비밀번호 확인 시작 - user_id: {user_id}")
        is_current_valid = crud_auth.verify_user_password(db, user_id, request.currentPassword)
        logger.info(f"[CHANGE_PASSWORD] 현재 비밀번호 확인 결과 - user_id: {user_id}, valid: {is_current_valid}")

        if not is_current_valid:
            logger.warning(f"[CHANGE_PASSWORD] 현재 비밀번호 불일치 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "현재 비밀번호가 올바르지 않습니다.",
                "success": False
            }

        # 새 비밀번호로 변경
        is_changed = crud_auth.change_user_password(db, user_id, request.newPassword)

        if is_changed:
            logger.info(f"[CHANGE_PASSWORD] 비밀번호 변경 성공 - user_id: {user_id}")
            return {
                "result": "Y",
                "message": "비밀번호가 성공적으로 변경되었습니다.",
                "success": True
            }
        else:
            logger.error(f"[CHANGE_PASSWORD] 비밀번호 변경 실패 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "비밀번호 변경에 실패했습니다.",
                "success": False
            }

    except ValueError as e:
        # 비밀번호 검증 오류
        logger.warning(f"[CHANGE_PASSWORD] 비밀번호 검증 오류 - user_id: {user_id if 'user_id' in locals() else 'unknown'}, error: {str(e)}")
        return {
            "result": "N",
            "message": str(e),
            "success": False
        }

    except Exception as e:
        logger.error(f"[CHANGE_PASSWORD] 서버 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "result": "N",
            "message": "서버 오류가 발생했습니다.",
            "success": False
        }

@router.post("/register", response_model=RegisterResponse, dependencies=[Depends(deps.get_required_admin_id)])
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
    request: Request,
    db: Session = Depends(deps.get_db)
):
    """
    로그인
    """
    from app.api.v1.endpoints.auth import login_for_home_page
    from app.schemas.auth import LoginRequestHome
    result = login_for_home_page(LoginRequestHome(mt_id=login_data.mt_id, mt_pwd=login_data.mt_pwd), request, db)
    return MemberLoginResponse(success=result.success, message=result.message, data={"user": result.data["user"]} if result.success else None)

@router.post("/google-login", response_model=GoogleLoginResponse)
def google_login(
    google_data: GoogleLoginRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Google 로그인
    """
    return member_service.google_login(db, google_data)

def _limit_account_lookup(request: Request) -> None:
    from app.api.v1.endpoints.email_auth import _redis, _client_ip
    import hashlib
    client = _redis()
    key = 'member:lookup:ip:' + hashlib.sha256(_client_ip(request).encode()).hexdigest()
    try:
        count = client.incr(key)
        if count == 1:
            client.expire(key, 3600)
        if count > 20:
            raise HTTPException(status_code=429, detail="요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("계정 조회 제한 저장소 오류: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="계정 조회 서비스를 사용할 수 없습니다.") from exc


@router.get("/check/phone/{phone}")
def check_phone_availability(
    phone: str,
    request: Request,
    db: Session = Depends(deps.get_db)
):
    """
    전화번호 사용 가능 여부 확인
    """
    _limit_account_lookup(request)
    is_available = member_service.check_phone_availability(db, phone)
    return {
        "available": is_available,
        "message": "사용 가능한 전화번호입니다." if is_available else "이미 가입된 전화번호입니다."
    }

@router.get("/check/email/{email}", dependencies=[Depends(deps.get_required_admin_id)])
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

@router.get("/check/nickname/{nickname}", dependencies=[Depends(deps.get_required_admin_id)])
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

@router.get("/", dependencies=[Depends(deps.get_required_admin_id)])
def get_members(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 10000,
    id: Optional[int] = Query(None, description="특정 멤버 ID로 필터링")
):
    """
    멤버 목록을 조회합니다.
    특정 ID가 제공되면 해당 멤버만 반환합니다.
    """
    try:
        if id:
            member = db.query(Member).filter(Member.mt_idx == id).first()
            if not member:
                return []
            # 단일 멤버를 안전하게 변환
            return [_member_to_dict(member)]

        members = db.query(Member).offset(skip).limit(limit).all()
        # 각 멤버를 안전하게 딕셔너리로 변환
        return [_member_to_dict(m) for m in members]
    except Exception as e:
        logger.error(f"[GET_MEMBERS] 회원 목록 조회 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"회원 목록 조회 실패: {str(e)}")


def _member_to_dict(member: Member) -> dict:
    """Member 모델을 안전하게 딕셔너리로 변환 (None 값 처리)"""
    def safe_date(val):
        """날짜 값을 안전하게 문자열로 변환"""
        if val is None:
            return None
        if isinstance(val, str):
            return val
        if hasattr(val, 'isoformat'):
            return val.isoformat()
        return str(val)

    return {
        "mt_idx": member.mt_idx,
        "mt_type": member.mt_type or 1,
        "mt_level": member.mt_level or 2,
        "mt_status": member.mt_status or 1,
        "mt_id": member.mt_id or "",
        "mt_name": member.mt_name or "",
        "mt_nickname": member.mt_nickname or "",
        "mt_hp": member.mt_hp or "",
        "mt_email": member.mt_email or "",
        "mt_birth": safe_date(member.mt_birth),
        "mt_gender": member.mt_gender or 1,
        "mt_file1": member.mt_file1 or "",
        "mt_show": member.mt_show or "Y",
        "mt_agree1": member.mt_agree1 or "N",
        "mt_agree2": member.mt_agree2 or "N",
        "mt_agree3": member.mt_agree3 or "N",
        "mt_agree4": member.mt_agree4 or "N",
        "mt_agree5": member.mt_agree5 or "N",
        "mt_lat": float(member.mt_lat) if member.mt_lat else None,
        "mt_long": float(member.mt_long) if member.mt_long else None,
        "mt_wdate": safe_date(member.mt_wdate),
        "mt_ldate": safe_date(member.mt_ldate),
        "mt_udate": safe_date(member.mt_udate),
    }

@router.get("/me", dependencies=[Depends(deps.get_required_user_id)])
def get_user_profile(
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    현재 로그인한 사용자의 프로필 정보를 조회합니다.
    """
    logger.info("[GET_PROFILE] 사용자 프로필 조회 요청 시작")
    logger.info(f"[GET_PROFILE] Authorization 헤더: {authorization[:50] if authorization else 'None'}...")

    try:
        # JWT 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[GET_PROFILE] 인증 토큰이 없거나 유효하지 않음")
            return {
                "result": "N",
                "message": "인증이 필요합니다.",
                "success": False
            }

        logger.info(f"[GET_PROFILE] 토큰에서 추출한 user_id: {user_id}")

        # 데이터베이스에서 최신 사용자 정보 조회
        user = crud_auth.get_user_by_idx(db, user_id)
        if not user:
            logger.warning(f"[GET_PROFILE] 사용자를 찾을 수 없음 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "사용자를 찾을 수 없습니다.",
                "success": False
            }

        # 응답 데이터 구성
        profile_data = {
            "mt_idx": user.mt_idx,
            "mt_id": user.mt_id,
            "mt_name": user.mt_name,
            "mt_nickname": user.mt_nickname,
            "mt_hp": user.mt_hp,
            "mt_email": user.mt_email,
            "mt_birth": user.mt_birth.strftime('%Y-%m-%d') if user.mt_birth else None,
            "mt_gender": user.mt_gender,
            "mt_type": user.mt_type,
            "mt_level": user.mt_level,
            "mt_file1": user.mt_file1,  # 프로필 이미지 URL
            "mt_wdate": user.mt_wdate.isoformat() if user.mt_wdate else None
        }

        logger.info(f"[GET_PROFILE] 프로필 조회 성공 - user_id: {user_id}, name: {user.mt_name}, nickname: {user.mt_nickname}")
        return {
            "result": "Y",
            "data": profile_data,
            "message": "프로필 조회가 성공했습니다.",
            "success": True
        }

    except Exception as e:
        logger.error(f"[GET_PROFILE] 서버 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "result": "N",
            "message": "서버 오류가 발생했습니다.",
            "success": False
        }

@router.get("/terms", response_model=TermsListResponse)
def get_terms_list():
    """
    약관 목록을 조회합니다.
    """
    logger.info("[TERMS] 약관 목록 조회 요청")

    try:
        terms = [
            TermInfo(
                id="service",
                title="서비스 이용약관",
                description="SMAP 서비스 이용에 관한 약관",
                version="1.0",
                last_updated="2024-01-01",
                is_required=True,
                db_field="mt_agree1"
            ),
            TermInfo(
                id="privacy",
                title="개인정보 처리방침",
                description="개인정보 수집 및 이용에 관한 방침",
                version="1.0",
                last_updated="2024-01-01",
                is_required=True,
                db_field="mt_agree2"
            ),
            TermInfo(
                id="location",
                title="위치기반서비스 이용약관",
                description="위치정보 수집 및 이용에 관한 약관",
                version="1.0",
                last_updated="2024-01-01",
                is_required=True,
                db_field="mt_agree3"
            ),
            TermInfo(
                id="third_party",
                title="개인정보 제3자 제공",
                description="개인정보 제3자 제공에 관한 동의",
                version="1.0",
                last_updated="2024-01-01",
                is_required=False,
                db_field="mt_agree4"
            ),
            TermInfo(
                id="marketing",
                title="마케팅 정보 수신",
                description="마케팅 정보 수집 및 이용에 관한 동의",
                version="1.0",
                last_updated="2024-01-01",
                is_required=False,
                db_field="mt_agree5"
            )
        ]

        logger.info(f"[TERMS] 약관 목록 조회 성공 - 총 {len(terms)}개")
        return TermsListResponse(
            success=True,
            message="약관 목록 조회 성공",
            data=terms
        )

    except Exception as e:
        logger.error(f"[TERMS] 약관 목록 조회 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="서버 오류가 발생했습니다.")



@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: int,
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    특정 ID의 멤버를 조회합니다.
    AuthContext의 getUserProfile에서 사용
    """
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if int(user_id) != member_id:
        deps.require_same_group_or_self(db, user_id, member_id)
        return {"mt_idx": member.mt_idx, "mt_id": "", "mt_name": member.mt_name or "", "mt_nickname": member.mt_nickname or "", "mt_file1": member.mt_file1}

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
        "mt_birth": member.mt_birth.isoformat() if member.mt_birth else None,
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
        "mt_wdate": member.mt_wdate.isoformat() if member.mt_wdate else datetime.utcnow().isoformat(),
        "mt_ldate": member.mt_ldate.isoformat() if member.mt_ldate else datetime.utcnow().isoformat(),
        "mt_adate": member.mt_adate.isoformat() if member.mt_adate else datetime.utcnow().isoformat()
    }

    return member_data

@router.get("/group/{group_id}", response_model=List[dict])
def get_group_members(
    group_id: int,
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹의 멤버 목록을 조회합니다.
    home/page.tsx의 memberService.getGroupMembers()에서 사용
    Member 정보와 GroupDetail 정보를 합쳐서 반환
    """
    # 그룹에 속한 멤버들과 그룹 상세 정보를 조인하여 조회
    deps.require_group_member(db, user_id, group_id)
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
            "mt_birth": member.mt_birth.isoformat() if member.mt_birth else None,
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
        if int(member.mt_idx) != int(user_id):
            for field in ('mt_id', 'mt_hp', 'mt_email', 'mt_birth'):
                member_data.pop(field, None)
        result.append(member_data)

    return result

@router.post("/", response_model=MemberResponse, dependencies=[Depends(deps.get_required_admin_id)])
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
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    멤버 정보를 업데이트합니다.
    AuthContext의 updateUserProfile에서 사용
    """
    if int(user_id) != member_id:
        raise HTTPException(status_code=403, detail="본인의 정보만 수정할 수 있습니다.")
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = member_in.dict(exclude_unset=True)
    if 'mt_email' in update_data and (update_data['mt_email'] or '').strip().lower() != (member.mt_email or '').strip().lower():
        raise HTTPException(status_code=400, detail="이메일 변경은 이메일 인증 API를 이용해주세요.")
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
        "mt_birth": member.mt_birth.isoformat() if member.mt_birth else None,
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
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    멤버를 삭제합니다.
    """
    if int(user_id) != member_id:
        raise HTTPException(status_code=403, detail="본인의 계정만 비활성화할 수 있습니다.")
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.mt_status = 2  # 실제 삭제 대신 상태 변경
    db.add(member)
    db.commit()
    return {"success": True, "message": "Member deleted successfully"}

@router.patch("/{member_id}/location", response_model=MemberResponse)
def update_member_location(
    member_id: int,
    lat: float,
    lng: float,
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    멤버의 위치 정보를 업데이트합니다.
    """
    if int(user_id) != member_id:
        raise HTTPException(status_code=403, detail="본인의 위치만 수정할 수 있습니다.")
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.mt_lat = str(lat)
    member.mt_long = str(lng)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@router.post("/update-profile", dependencies=[Depends(deps.get_required_user_id)])
def update_profile(
    request: UpdateProfileRequest,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    사용자 프로필을 업데이트합니다.
    """
    logger.info("[UPDATE_PROFILE] 프로필 업데이트 요청 시작")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[UPDATE_PROFILE] 인증 토큰이 없거나 유효하지 않음")
            return {
                "result": "N",
                "message": "인증이 필요합니다.",
                "success": False
            }

        logger.info(f"[UPDATE_PROFILE] 프로필 업데이트 요청 - user_id: {user_id}")

        # 닉네임 중복 확인
        if crud_auth.check_nickname_duplicate(db, user_id, request.mt_nickname):
            logger.warning(f"[UPDATE_PROFILE] 닉네임 중복 - user_id: {user_id}, nickname: {request.mt_nickname}")
            return {
                "result": "N",
                "message": "이미 사용 중인 닉네임입니다.",
                "success": False
            }

        # 프로필 정보 업데이트
        profile_data = {
            "mt_name": request.mt_name,
            "mt_nickname": request.mt_nickname,
            "mt_birth": request.mt_birth,
            "mt_gender": request.mt_gender
        }

        is_updated = crud_auth.update_user_profile(db, user_id, profile_data)

        if is_updated:
            logger.info(f"[UPDATE_PROFILE] 프로필 업데이트 성공 - user_id: {user_id}")
            return {
                "result": "Y",
                "message": "프로필이 성공적으로 업데이트되었습니다.",
                "success": True
            }
        else:
            logger.error(f"[UPDATE_PROFILE] 프로필 업데이트 실패 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "프로필 업데이트에 실패했습니다.",
                "success": False
            }

    except Exception as e:
        logger.error(f"[UPDATE_PROFILE] 서버 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "result": "N",
            "message": "서버 오류가 발생했습니다.",
            "success": False
        }

@router.post("/update-contact", dependencies=[Depends(deps.get_required_user_id)])
def update_contact(
    request: UpdateContactRequest,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    사용자 연락처를 업데이트합니다.
    """
    logger.info("[UPDATE_CONTACT] 연락처 업데이트 요청 시작")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[UPDATE_CONTACT] 인증 토큰이 없거나 유효하지 않음")
            return {
                "result": "N",
                "message": "인증이 필요합니다.",
                "success": False
            }

        logger.info(f"[UPDATE_CONTACT] 연락처 업데이트 요청 - user_id: {user_id}")

        current = crud_auth.get_user_by_idx(db, user_id)
        if not current:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        if request.mt_email.strip().lower() != (current.mt_email or '').strip().lower():
            raise HTTPException(status_code=400, detail="이메일 변경은 이메일 인증 API를 이용해주세요.")

        # 전화번호 중복 확인
        if crud_auth.check_phone_duplicate(db, user_id, request.mt_hp):
            logger.warning(f"[UPDATE_CONTACT] 전화번호 중복 - user_id: {user_id}, phone: {request.mt_hp}")
            return {
                "result": "N",
                "message": "이미 사용 중인 전화번호입니다.",
                "success": False
            }

        # 이메일 중복 확인
        if crud_auth.check_email_duplicate(db, user_id, request.mt_email):
            logger.warning(f"[UPDATE_CONTACT] 이메일 중복 - user_id: {user_id}, email: {request.mt_email}")
            return {
                "result": "N",
                "message": "이미 사용 중인 이메일입니다.",
                "success": False
            }

        # 연락처 정보 업데이트
        contact_data = {
            "mt_hp": request.mt_hp,
            "mt_email": request.mt_email
        }

        is_updated = crud_auth.update_user_contact(db, user_id, contact_data)

        if is_updated:
            logger.info(f"[UPDATE_CONTACT] 연락처 업데이트 성공 - user_id: {user_id}")
            return {
                "result": "Y",
                "message": "연락처가 성공적으로 업데이트되었습니다.",
                "success": True
            }
        else:
            logger.error(f"[UPDATE_CONTACT] 연락처 업데이트 실패 - user_id: {user_id}")
            return {
                "result": "N",
                "message": "연락처 업데이트에 실패했습니다.",
                "success": False
            }

    except Exception as e:
        logger.error(f"[UPDATE_CONTACT] 서버 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "result": "N",
            "message": "서버 오류가 발생했습니다.",
            "success": False
        }

@router.post("/withdraw")
def withdraw_member(
    request: WithdrawRequest,
    user_id: int = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db),
):
    try:
        user = db.query(Member).filter(Member.mt_idx == user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")
        now = datetime.utcnow()
        # 기존 그룹 삭제와 동일하게 소유 그룹을 비노출 처리합니다.
        owned_ids = db.query(GroupDetail.sgt_idx).filter(
            GroupDetail.mt_idx == user_id, GroupDetail.sgdt_owner_chk == "Y", GroupDetail.sgdt_show == "Y"
        )
        db.query(Group).filter(or_(Group.mt_idx == user_id, Group.sgt_idx.in_(owned_ids))).update(
            {Group.sgt_show: ShowEnum.N, Group.sgt_udate: now}, synchronize_session=False
        )
        db.query(GroupDetail).filter(GroupDetail.mt_idx == user_id).update(
            {GroupDetail.sgdt_show: "N", GroupDetail.sgdt_exit: "Y", GroupDetail.sgdt_udate: now}, synchronize_session=False
        )
        db.query(Location).filter(Location.mt_idx == user_id).update(
            {Location.slt_show: ShowEnum.N, Location.slt_udate: now}, synchronize_session=False
        )
        crud_refresh_token.revoke_all_for_member(db, user_id, commit=False)
        user.mt_retire_level = user.mt_level
        user.mt_level = 1
        user.mt_show = "N"
        user.mt_retire_chk = request.mt_retire_chk
        user.mt_retire_etc = request.mt_retire_etc
        user.mt_rdate = now
        user.mt_id_retire = user.mt_id
        user.mt_id = f"retired_{user_id}_{uuid.uuid4().hex}"
        user.mt_email = None
        user.mt_hp = None
        user.mt_google_id = None
        user.mt_apple_id = None
        user.mt_kakao_id = None
        user.mt_token_id = None
        user.mt_token_updated_at = None
        user.mt_token_expiry_date = None
        user.mt_udate = now
        db.commit()
        return {"result": "Y", "message": "회원 탈퇴가 완료되었습니다.", "success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("회원 탈퇴 처리 실패")
        raise HTTPException(status_code=500, detail="회원 탈퇴 처리에 실패했습니다.")

# ==================== 동의 관리 엔드포인트 ====================

@router.get("/consent/{member_id}", response_model=ConsentResponse, dependencies=[Depends(deps.get_required_user_id)])
def get_consent_info(
    member_id: int,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    사용자의 동의 정보를 조회합니다.
    """
    logger.info(f"[CONSENT] 동의 정보 조회 요청 - member_id: {member_id}")

    try:
        # 토큰에서 사용자 ID 추출
        current_user_id = deps.get_current_user_id(authorization)
        if not current_user_id:
            logger.warning("[CONSENT] 인증 토큰이 없거나 유효하지 않음")
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")

        # 본인 정보만 조회 가능 (관리자 권한 추가 가능)
        if current_user_id != member_id:
            logger.warning(f"[CONSENT] 권한 없음 - current_user: {current_user_id}, requested: {member_id}")
            raise HTTPException(status_code=403, detail="본인의 동의 정보만 조회할 수 있습니다.")

        # 동의 정보 조회
        consent_info = crud_member.get_consent_info(db, user_id=member_id)
        if not consent_info:
            logger.warning(f"[CONSENT] 사용자를 찾을 수 없음 - member_id: {member_id}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        logger.info(f"[CONSENT] 동의 정보 조회 성공 - member_id: {member_id}")
        from app.schemas.member import ConsentInfo

        consent_data = ConsentInfo(**consent_info)
        return ConsentResponse(
            success=True,
            message="동의 정보 조회 성공",
            data=consent_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONSENT] 동의 정보 조회 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="서버 오류가 발생했습니다.")

@router.post("/consent", response_model=ConsentUpdateResponse, dependencies=[Depends(deps.get_required_user_id)])
def update_consent(
    request: ConsentUpdate,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    개별 동의 상태를 변경합니다.
    """
    logger.info(f"[CONSENT] 개별 동의 상태 변경 요청 - field: {request.field}, value: {request.value}")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[CONSENT] 인증 토큰이 없거나 유효하지 않음")
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")

        # 동의 상태 업데이트
        is_updated = crud_member.update_consent(db, user_id=user_id, field=request.field, value=request.value)

        if is_updated:
            logger.info(f"[CONSENT] 개별 동의 상태 변경 성공 - user_id: {user_id}, field: {request.field}")
            return ConsentUpdateResponse(
                success=True,
                message="동의 상태가 성공적으로 변경되었습니다.",
                field=request.field,
                value=request.value
            )
        else:
            logger.error(f"[CONSENT] 개별 동의 상태 변경 실패 - user_id: {user_id}, field: {request.field}")
            raise HTTPException(status_code=400, detail="동의 상태 변경에 실패했습니다.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONSENT] 개별 동의 상태 변경 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="서버 오류가 발생했습니다.")

@router.post("/consent/all", response_model=ConsentUpdateResponse, dependencies=[Depends(deps.get_required_user_id)])
def update_all_consent(
    request: ConsentUpdateAll,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db)
):
    """
    전체 동의 상태를 변경합니다.
    """
    logger.info("[CONSENT] 전체 동의 상태 변경 요청")

    try:
        # 토큰에서 사용자 ID 추출
        user_id = deps.get_current_user_id(authorization)
        if not user_id:
            logger.warning("[CONSENT] 인증 토큰이 없거나 유효하지 않음")
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")

        # 전체 동의 상태 업데이트
        consent_data = {
            "mt_agree1": request.mt_agree1,
            "mt_agree2": request.mt_agree2,
            "mt_agree3": request.mt_agree3,
            "mt_agree4": request.mt_agree4,
            "mt_agree5": request.mt_agree5
        }

        is_updated = crud_member.update_all_consent(db, user_id=user_id, consent_data=consent_data)

        if is_updated:
            logger.info(f"[CONSENT] 전체 동의 상태 변경 성공 - user_id: {user_id}")
            return ConsentUpdateResponse(
                success=True,
                message="전체 동의 상태가 성공적으로 변경되었습니다.",
                field="all",
                value="updated"
            )
        else:
            logger.error(f"[CONSENT] 전체 동의 상태 변경 실패 - user_id: {user_id}")
            raise HTTPException(status_code=400, detail="전체 동의 상태 변경에 실패했습니다.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONSENT] 전체 동의 상태 변경 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="서버 오류가 발생했습니다.")

# 프로필 사진 업로드 디렉토리 설정
UPLOAD_DIR = Path("public/images")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

@router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user_id: Optional[int] = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    프로필 사진 업로드 API
    - 파일을 public/images 폴더에 저장
    - 파일명을 mt_idx로 변경
    - member_t.mt_file1에 파일 경로 저장
    """
    try:
        # 사용자 인증 확인
        if not current_user_id:
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")

        # 파일 유효성 검사
        if not file:
            raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

        # 파일 타입 검사
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

        # 파일 크기 제한 (5MB)
        file_size = 0
        content = await file.read()
        file_size = len(content)

        if file_size > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="파일 크기는 5MB를 초과할 수 없습니다.")

        # 파일명 생성 (mt_idx.jpg)
        file_extension = ".jpg"  # 크롭된 이미지는 항상 JPG
        new_filename = f"{current_user_id}{file_extension}"
        file_path = UPLOAD_DIR / new_filename

        # 파일 저장
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # DB 업데이트 - mt_file1 필드에 파일 경로 저장
        file_url = f"/images/{new_filename}"

        # 사용자 정보 업데이트
        member = db.query(Member).filter(Member.mt_idx == current_user_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        member.mt_file1 = file_url
        db.commit()

        logger.info(f"[PROFILE_IMAGE] 프로필 사진 업로드 성공 - 사용자: {current_user_id}, 파일: {new_filename}")

        return {
            "success": True,
            "message": "프로필 사진이 성공적으로 업로드되었습니다.",
            "data": {
                "file_path": file_url,
                "file_name": new_filename,
                "file_size": file_size
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PROFILE_IMAGE] 프로필 사진 업로드 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="프로필 사진 업로드 중 오류가 발생했습니다.")


@router.delete("/delete-profile-image")
def delete_profile_image(
    current_user_id: Optional[int] = Depends(deps.get_required_user_id),
    db: Session = Depends(deps.get_db)
):
    """
    프로필 사진 삭제 API
    - public/images 폴더에서 파일 삭제
    - member_t.mt_file1 필드 초기화
    """
    try:
        # 사용자 인증 확인
        if not current_user_id:
            raise HTTPException(status_code=401, detail="인증이 필요합니다.")

        # 사용자 정보 조회
        member = db.query(Member).filter(Member.mt_idx == current_user_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        # 기존 파일이 있는지 확인
        if member.mt_file1:
            # 파일 경로에서 파일명 추출
            file_path = member.mt_file1.replace('/images/', '')
            full_path = UPLOAD_DIR / file_path

            # 파일 삭제
            if full_path.exists():
                os.remove(full_path)
                logger.info(f"[PROFILE_IMAGE] 기존 프로필 사진 파일 삭제: {file_path}")

        # DB 업데이트 - mt_file1 필드 초기화
        member.mt_file1 = None
        db.commit()

        logger.info(f"[PROFILE_IMAGE] 프로필 사진 삭제 성공 - 사용자: {current_user_id}")

        return {
            "success": True,
            "message": "프로필 사진이 성공적으로 삭제되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PROFILE_IMAGE] 프로필 사진 삭제 실패: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="프로필 사진 삭제 중 오류가 발생했습니다.")
