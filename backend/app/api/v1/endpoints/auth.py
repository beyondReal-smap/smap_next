import os
import uuid
import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from jose import JWTError
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.crud import crud_auth
from app.schemas.auth import *
from app.schemas.member import AppleLoginRequest, AppleLoginResponse
from app.core.config import settings
from app.models.member import Member

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 로거 설정
logger = logging.getLogger(__name__)

# home/page.tsx의 AuthContext에서 사용하는 로그인 요청 모델
class LoginRequestHome(BaseModel):
    mt_id: str  # 아이디 (전화번호 또는 이메일)
    mt_pwd: str  # 비밀번호
    fcm_token: Optional[str] = None  # 선택적 FCM 토큰

# home/page.tsx의 AuthContext에서 사용하는 로그인 응답 모델
class LoginResponseHome(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 카카오 로그인 요청 모델
class KakaoLoginRequest(BaseModel):
    kakao_id: str
    email: Optional[str] = None
    nickname: str
    profile_image: Optional[str] = None
    access_token: str
    fcm_token: Optional[str] = None  # 선택적 FCM 토큰

# 카카오 로그인 응답 모델
class KakaoLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# Google 로그인 사용자 데이터 조회 모델
class GoogleUserDataRequest(BaseModel):
    email: str
    google_id: Optional[str] = None

class PhoneUserDataRequest(BaseModel):
    phone: str
    google_id: Optional[str] = None

class GoogleUserDataResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# Google 로그인 요청 모델 (완전히 유연하게 변경)
class GoogleLoginRequest(BaseModel):
    google_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    image: Optional[str] = None
    id_token: Optional[str] = None
    # 기타 모든 필드도 옵셔널로 처리
    lookup_strategy: Optional[str] = "email_first"
    search_by_email: Optional[bool] = True
    verify_email_match: Optional[bool] = True
    email_first_lookup: Optional[bool] = True
    lookup_priority: Optional[str] = "email"

    class Config:
        # 추가 필드도 허용하여 엄격한 검증 방지
        extra = "allow"

# Google 로그인 응답 모델
class GoogleLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 레거시/공용 로그인 요청/응답 스키마
class LoginRequest(BaseModel):
    mt_hp: str
    mt_pass: str
    fcm_token: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    user: "UserIdentity"

# 비밀번호 관련 요청/응답 스키마
class ForgotPasswordRequest(BaseModel):
    type: str  # "phone" | "email"
    contact: str

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 전화번호 기반 비밀번호 재설정 요청 (네이티브 앱용)
class ResetPasswordByPhoneRequest(BaseModel):
    phone: str  # 전화번호 (하이픈 포함 가능)
    new_password: str  # 새 비밀번호

class VerifyResetTokenRequest(BaseModel):
    token: str

class VerifyResetTokenResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ResetPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=LoginResponseHome)
async def login_for_home_page(
    login_request: LoginRequestHome,
    db: Session = Depends(get_db)
):
    """
    home/page.tsx의 AuthContext에서 사용하는 로그인 API
    """
    try:
        # 이메일 또는 전화번호로 사용자 조회
        user = None
        if "@" in login_request.mt_id:
            # 이메일로 조회
            user = crud_auth.get_user_by_email(db, login_request.mt_id)
        else:
            # 전화번호로 조회 (하이픈 제거)
            user = crud_auth.get_user_by_phone(db, login_request.mt_id.replace("-", ""))
        
        logger.info(f"[LOGIN] 사용자 조회 결과: {user.mt_idx if user else 'None'}, mt_id: {login_request.mt_id}")
        
        if not user:
            logger.warning(f"[LOGIN] 사용자를 찾을 수 없음: {login_request.mt_id}")
            return LoginResponseHome(
                success=False,
                message="아이디 또는 비밀번호가 올바르지 않습니다."
            )
        
        logger.info(f"[LOGIN] 사용자 확인됨: mt_idx={user.mt_idx}, mt_name={user.mt_name}, mt_pwd_exists={bool(user.mt_pwd)}")
        
        # 비밀번호 검증
        password_verified = crud_auth.verify_password(login_request.mt_pwd, user.mt_pwd) if user.mt_pwd else False
        logger.info(f"[LOGIN] 비밀번호 검증 결과: {password_verified}")
        
        if not user.mt_pwd or not password_verified:
            logger.warning(f"[LOGIN] 비밀번호 검증 실패: mt_idx={user.mt_idx}, mt_pwd_exists={bool(user.mt_pwd)}")
            return LoginResponseHome(
                success=False,
                message="아이디 또는 비밀번호가 올바르지 않습니다."
            )

        # 토큰 생성
        access_token = create_access_token(
            data={
                "mt_idx": user.mt_idx,
                "mt_id": user.mt_id,
                "mt_name": user.mt_name
            }
        )
        
        # 로그인 시간 업데이트 (FCM 토큰은 별도 API에서만 업데이트)
        user.mt_ldate = datetime.utcnow()
        # FCM 토큰 자동 업데이트 제거 - Swift에서 명시적 요청 시에만 업데이트
        # if getattr(login_request, 'fcm_token', None):
        #     if not user.mt_token_id or user.mt_token_id != login_request.fcm_token:
        #         user.mt_token_id = login_request.fcm_token
        db.commit()

        # home/page.tsx의 Member 타입에 맞는 사용자 정보 구성
        user_data = {
            "mt_idx": user.mt_idx,
            "mt_type": user.mt_type or 1,
            "mt_level": user.mt_level or 2,
            "mt_status": user.mt_status or 1,
            "mt_id": user.mt_id or "",
            "mt_name": user.mt_name or "",
            "mt_nickname": user.mt_nickname or "",
            "mt_hp": user.mt_hp or "",
            "mt_email": user.mt_email or "",
            "mt_birth": user.mt_birth.isoformat() if user.mt_birth else None,
            "mt_gender": user.mt_gender or 1,
            "mt_file1": user.mt_file1 or "",
            "mt_lat": float(user.mt_lat) if user.mt_lat else 37.5642,
            "mt_long": float(user.mt_long) if user.mt_long else 127.0016,
            "mt_sido": user.mt_sido or "",
            "mt_gu": user.mt_gu or "",
            "mt_dong": user.mt_dong or "",
            "mt_onboarding": user.mt_onboarding or 'Y',
            "mt_push1": user.mt_push1 or 'Y',
            "mt_plan_check": user.mt_plan_check or 'N',
            "mt_plan_date": user.mt_plan_date.isoformat() if user.mt_plan_date else "",
            "mt_weather_pop": user.mt_weather_pop or "",
            "mt_weather_sky": user.mt_weather_sky or 8,
            "mt_weather_tmn": user.mt_weather_tmn or 18,
            "mt_weather_tmx": user.mt_weather_tmx or 25,
            "mt_weather_date": user.mt_weather_date.isoformat() if user.mt_weather_date else datetime.utcnow().isoformat(),
            "mt_wdate": user.mt_wdate.isoformat() if user.mt_wdate else datetime.utcnow().isoformat(),
            "mt_ldate": user.mt_ldate.isoformat() if user.mt_ldate else datetime.utcnow().isoformat(),
            "mt_adate": user.mt_adate.isoformat() if user.mt_adate else datetime.utcnow().isoformat()
        }

        return LoginResponseHome(
            success=True,
            message="로그인 성공",
            data={
                "token": access_token,
                "user": user_data
            }
        )

    except Exception as e:
        return LoginResponseHome(
            success=False,
            message="서버 오류가 발생했습니다."
        )

@router.post("/logout")
async def logout():
    """
    로그아웃 (클라이언트에서 토큰 제거)
    """
    return {
        "success": True,
        "message": "로그아웃되었습니다."
    }

@router.post("/refresh")
async def refresh_token(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    토큰 갱신
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx: Optional[int] = payload.get("mt_idx")
        
        if mt_idx is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="토큰이 유효하지 않습니다."
            )
        
        # 새로운 토큰 생성
        new_token = create_access_token(
            data={
                "mt_idx": mt_idx,
                "mt_id": payload.get("mt_id"),
                "mt_name": payload.get("mt_name")
            }
        )
        
        return {
            "success": True,
            "token": new_token,
            "message": "토큰이 갱신되었습니다."
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 갱신에 실패했습니다."
        )

# 기존 로그인 API (하위 호환성을 위해 유지)
@router.post("/login-original", response_model=LoginResponse)
async def login_for_access_token_custom(
    db: Session = Depends(get_db),
    login_request: LoginRequest = Body(...)
):
    user = crud_auth.get_user_by_phone(db, login_request.mt_hp.replace("-", ""))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호를 잘못 입력했습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.mt_pwd or not crud_auth.verify_password(login_request.mt_pass, user.mt_pwd):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호를 잘못 입력했습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_identity = crud_auth.create_user_identity_from_member(user)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=user_identity.model_dump()
    )
    
    # 로그인 시간 업데이트 (FCM 토큰은 별도 API에서만 업데이트)
    user.mt_ldate = datetime.utcnow()
    # FCM 토큰 자동 업데이트 제거 - Swift에서 명시적 요청 시에만 업데이트
    # if getattr(login_request, 'fcm_token', None):
    #     if not user.mt_token_id or user.mt_token_id != login_request.fcm_token:
    #         user.mt_token_id = login_request.fcm_token
    db.commit()

    return LoginResponse(
        access_token=access_token,
        user=user_identity
    )

@router.post("/register", response_model=LoginResponseHome, status_code=status.HTTP_201_CREATED)
async def register_user(
    request: Request,
    db: Session = Depends(get_db)
):
    # 요청 본문 로깅
    try:
        body = await request.json()
        logger.info(f"📝 Register request body: {body}")
    except Exception as e:
        logger.error(f"❌ Failed to parse request body: {e}")
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    # 수동으로 RegisterRequest 생성
    try:
        user_in = RegisterRequest(**body)
    except Exception as e:
        logger.error(f"❌ Pydantic validation error: {e}")
        raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")
    
    existing_user_by_phone = crud_auth.get_user_by_phone(db, user_in.mt_id.replace("-", ""))
    if existing_user_by_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 전화번호입니다.",
        )
    
    existing_user_by_email = crud_auth.get_user_by_email(db, user_in.mt_email)
    if existing_user_by_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 이메일입니다.",
        )
    
    try:
        created_user = crud_auth.create_user(db=db, user_in=user_in)
        
        # 토큰 생성
        access_token = create_access_token(
            data={
                "mt_idx": created_user.mt_idx,
                "mt_id": created_user.mt_id,
                "mt_name": created_user.mt_name
            }
        )
        
        # 사용자 정보 구성 (login_for_home_page와 동일)
        user_data = {
            "mt_idx": created_user.mt_idx,
            "mt_type": created_user.mt_type or 1,
            "mt_level": created_user.mt_level or 2,
            "mt_status": created_user.mt_status or 1,
            "mt_id": created_user.mt_id or "",
            "mt_name": created_user.mt_name or "",
            "mt_nickname": created_user.mt_nickname or "",
            "mt_hp": created_user.mt_hp or "",
            "mt_email": created_user.mt_email or "",
            "mt_birth": created_user.mt_birth.isoformat() if created_user.mt_birth else None,
            "mt_gender": created_user.mt_gender or 1,
            "mt_file1": created_user.mt_file1 or "",
            "mt_lat": float(created_user.mt_lat) if created_user.mt_lat else 37.5642,
            "mt_long": float(created_user.mt_long) if created_user.mt_long else 127.0016,
            "mt_sido": created_user.mt_sido or "",
            "mt_gu": created_user.mt_gu or "",
            "mt_dong": created_user.mt_dong or "",
            "mt_onboarding": created_user.mt_onboarding or 'Y',
            "mt_plan_check": created_user.mt_plan_check or 'N',
            "mt_plan_date": created_user.mt_plan_date.isoformat() if created_user.mt_plan_date else "",
            "mt_weather_pop": created_user.mt_weather_pop or "",
            "mt_weather_sky": created_user.mt_weather_sky or 8,
            "mt_weather_tmn": created_user.mt_weather_tmn or 18,
            "mt_weather_tmx": created_user.mt_weather_tmx or 25,
            "mt_weather_date": created_user.mt_weather_date.isoformat() if created_user.mt_weather_date else datetime.utcnow().isoformat(),
            "mt_wdate": created_user.mt_wdate.isoformat() if created_user.mt_wdate else datetime.utcnow().isoformat(),
            "mt_ldate": created_user.mt_ldate.isoformat() if created_user.mt_ldate else datetime.utcnow().isoformat(),
            "mt_adate": created_user.mt_adate.isoformat() if created_user.mt_adate else datetime.utcnow().isoformat()
        }
        
        return LoginResponseHome(
            success=True,
            message="회원가입 성공",
            data={
                "token": access_token,
                "user": user_data
            }
        )

    except Exception as e:
        import traceback
        logger.error(f"Registration Error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 생성 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/me", response_model=UserIdentity)
async def read_users_me(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_id: Optional[str] = payload.get("mt_id")
        if mt_id is None:
            raise credentials_exception
        
        user = crud_auth.get_user_by_phone(db, mt_id)
        if user is None:
            raise credentials_exception
        
        user_identity = crud_auth.create_user_identity_from_member(user)
        return user_identity
        
    except JWTError:
        raise credentials_exception 

@router.post("/kakao-login", response_model=KakaoLoginResponse)
async def kakao_login(
    kakao_request: KakaoLoginRequest,
    db: Session = Depends(get_db)
):
    """
    카카오 로그인 API
    """
    try:
        logger.info(f"[KAKAO LOGIN] 카카오 로그인 요청: kakao_id={kakao_request.kakao_id}")
        
        # 기존 카카오 사용자 조회
        existing_user = crud_auth.get_user_by_kakao_id(db, kakao_request.kakao_id)
        
        is_new_user = False
        
        if existing_user:
            # 탈퇴한 사용자인지 확인
            if existing_user.mt_level == 1:
                logger.warning(f"[KAKAO LOGIN] 탈퇴한 사용자 로그인 시도: mt_idx={existing_user.mt_idx}")
                return KakaoLoginResponse(
                    success=False,
                    message="탈퇴한 계정입니다. 새로운 계정으로 가입해주세요."
                )
            
            # 기존 사용자 로그인
            logger.info(f"[KAKAO LOGIN] 기존 카카오 사용자 로그인: mt_idx={existing_user.mt_idx}")
            user = existing_user
        else:
            # 이메일로 기존 계정 조회 (이메일이 있는 경우)
            if kakao_request.email:
                email_user = crud_auth.get_user_by_email(db, kakao_request.email)
                if email_user:
                    # 탈퇴한 사용자인지 확인
                    if email_user.mt_level == 1:
                        logger.warning(f"[KAKAO LOGIN] 탈퇴한 이메일 계정 로그인 시도: mt_idx={email_user.mt_idx}")
                        return KakaoLoginResponse(
                            success=False,
                            message="탈퇴한 계정입니다. 새로운 계정으로 가입해주세요."
                        )
                    
                    # 기존 계정에 카카오 ID 연결
                    logger.info(f"[KAKAO LOGIN] 기존 이메일 계정에 카카오 연결: mt_idx={email_user.mt_idx}")
                    email_user.mt_kakao_id = kakao_request.kakao_id
                    email_user.mt_type = 2  # 카카오 로그인
                    if kakao_request.profile_image:
                        email_user.mt_file1 = kakao_request.profile_image
                    db.commit()
                    user = email_user
                else:
                    # 새 사용자 생성
                    user = crud_auth.create_kakao_user(db, kakao_request)
                    is_new_user = True
                    logger.info(f"[KAKAO LOGIN] 새 카카오 사용자 생성: mt_idx={user.mt_idx}")
            else:
                # 이메일 없이 새 사용자 생성
                user = crud_auth.create_kakao_user(db, kakao_request)
                is_new_user = True
                logger.info(f"[KAKAO LOGIN] 새 카카오 사용자 생성 (이메일 없음): mt_idx={user.mt_idx}")

        # 로그인 시간 업데이트 (FCM 토큰은 별도 API에서만 업데이트)
        user.mt_ldate = datetime.utcnow()
        # FCM 토큰 자동 업데이트 제거 - Swift에서 명시적 요청 시에만 업데이트
        # if getattr(kakao_request, 'fcm_token', None):
        #     if not user.mt_token_id or user.mt_token_id != kakao_request.fcm_token:
        #         user.mt_token_id = kakao_request.fcm_token
        db.commit()

        # 사용자 정보 구성
        user_data = {
            "mt_idx": user.mt_idx,
            "mt_type": user.mt_type or 2,
            "mt_level": user.mt_level or 2,
            "mt_status": user.mt_status or 1,
            "mt_id": user.mt_id or "",
            "mt_name": user.mt_name or "",
            "mt_nickname": user.mt_nickname or "",
            "mt_hp": user.mt_hp or "",
            "mt_email": user.mt_email or "",
            "mt_birth": user.mt_birth.isoformat() if user.mt_birth else None,
            "mt_gender": user.mt_gender or 1,
            "mt_file1": user.mt_file1 or "",
            "mt_kakao_id": user.mt_kakao_id or "",
            "mt_lat": float(user.mt_lat) if user.mt_lat else 37.5642,
            "mt_long": float(user.mt_long) if user.mt_long else 127.0016,
            "mt_sido": user.mt_sido or "",
            "mt_gu": user.mt_gu or "",
            "mt_dong": user.mt_dong or "",
            "mt_onboarding": user.mt_onboarding or 'Y',
            "mt_push1": user.mt_push1 or 'Y',
            "mt_plan_check": user.mt_plan_check or 'N',
            "mt_plan_date": user.mt_plan_date.isoformat() if user.mt_plan_date else "",
            "mt_weather_pop": user.mt_weather_pop or "",
            "mt_weather_sky": user.mt_weather_sky or 8,
            "mt_weather_tmn": user.mt_weather_tmn or 18,
            "mt_weather_tmx": user.mt_weather_tmx or 25,
            "mt_weather_date": user.mt_weather_date.isoformat() if user.mt_weather_date else datetime.utcnow().isoformat(),
            "mt_wdate": user.mt_wdate.isoformat() if user.mt_wdate else datetime.utcnow().isoformat(),
            "mt_ldate": user.mt_ldate.isoformat() if user.mt_ldate else datetime.utcnow().isoformat(),
            "mt_adate": user.mt_adate.isoformat() if user.mt_adate else datetime.utcnow().isoformat()
        }

        logger.info(f"[KAKAO LOGIN] 카카오 로그인 성공: mt_idx={user.mt_idx}, is_new_user={is_new_user}")
        
        return KakaoLoginResponse(
            success=True,
            message="카카오 로그인 성공" if not is_new_user else "카카오 계정으로 회원가입되었습니다.",
            data={
                "user": user_data,
                "isNewUser": is_new_user
            }
        )

    except Exception as e:
        logger.error(f"[KAKAO LOGIN] 카카오 로그인 오류: {str(e)}")
        return KakaoLoginResponse(
            success=False,
            message="카카오 로그인 처리 중 오류가 발생했습니다."
        ) 

@router.post("/find-user-by-email", response_model=GoogleUserDataResponse)
async def find_user_by_email(
    request: GoogleUserDataRequest,
    db: Session = Depends(get_db)
):
    """
    이메일로 사용자를 조회하고 관련 데이터를 함께 반환합니다.
    Google 로그인 후 기존 사용자 확인 및 데이터 조회용
    """
    try:
        from sqlalchemy import text
        from datetime import datetime, timedelta
        
        logger.info(f"🔍 이메일 기반 사용자 조회 시작: {request.email}")
        
        # 1. 이메일로 사용자 조회
        user = crud_auth.get_user_by_email(db, request.email)
        
        if not user:
            logger.info(f"❌ 이메일로 사용자를 찾을 수 없음: {request.email}")
            return GoogleUserDataResponse(
                success=False,
                message="사용자를 찾을 수 없습니다.",
                data={
                    "found": False,
                    "is_new_user": True
                }
            )
        
        # 2. 계정 상태 확인
        if user.mt_level == 1:  # 탈퇴한 사용자
            logger.warning(f"⚠️ 탈퇴한 사용자 조회: {user.mt_idx}")
            return GoogleUserDataResponse(
                success=False,
                message="탈퇴한 계정입니다.",
                data={
                    "found": True,
                    "is_withdrawn": True,
                    "user": {
                        "mt_idx": user.mt_idx,
                        "mt_email": user.mt_email,
                        "mt_level": user.mt_level
                    }
                }
            )
        
        # 3. Google ID 연결 확인 및 업데이트
        if request.google_id and not user.mt_google_id:
            user.mt_google_id = request.google_id
            user.mt_type = 4  # Google 로그인 타입으로 변경
            user.mt_ldate = datetime.utcnow()
            db.commit()
            logger.info(f"🔗 Google ID 연결 완료: {user.mt_idx}")
        
        # 4. 사용자의 그룹 정보 조회
        groups_query = text("""
            SELECT 
                sg.sgt_idx,
                sg.sgt_title,
                sgd.sgdt_owner_chk,
                sgd.sgdt_leader_chk,
                COUNT(DISTINCT sgd2.mt_idx) as member_count
            FROM smap_group_detail_t sgd
            JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
            LEFT JOIN smap_group_detail_t sgd2 ON sg.sgt_idx = sgd2.sgt_idx 
                AND sgd2.sgdt_discharge = 'N' 
                AND sgd2.sgdt_exit = 'N'
                AND sgd2.sgdt_show = 'Y'
            WHERE sgd.mt_idx = :mt_idx
                AND sgd.sgdt_discharge = 'N'
                AND sgd.sgdt_exit = 'N'
                AND sgd.sgdt_show = 'Y'
                AND sg.sgt_show = 'Y'
            GROUP BY sg.sgt_idx, sg.sgt_title, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk
            ORDER BY sgd.sgdt_owner_chk DESC, sgd.sgdt_leader_chk DESC
            LIMIT 10
        """)
        
        groups_result = db.execute(groups_query, {"mt_idx": user.mt_idx}).fetchall()
        groups = []
        for row in groups_result:
            groups.append({
                "sgt_idx": row.sgt_idx,
                "sgt_title": row.sgt_title,
                "sgt_file1": None,  # 컬럼이 없으므로 기본값
                "sgdt_owner_chk": row.sgdt_owner_chk,
                "sgdt_leader_chk": row.sgdt_leader_chk,
                "member_count": row.member_count,
                "is_owner": row.sgdt_owner_chk == 'Y',
                "is_leader": row.sgdt_leader_chk == 'Y'
            })
        
        # 5. 최근 스케줄 조회 (7일 전후)
        seven_days_ago = datetime.now() - timedelta(days=7)
        seven_days_later = datetime.now() + timedelta(days=7)
        
        schedules_query = text("""
            SELECT 
                sst.sst_idx,
                sst.sst_title,
                sst.sst_sdate,
                sst.sst_location_title,
                sst.sgt_idx,
                sg.sgt_title as group_title
            FROM smap_schedule_t sst
            LEFT JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
            WHERE (sst.mt_idx = :mt_idx OR sst.sgt_idx IN (
                SELECT DISTINCT sgd.sgt_idx 
                FROM smap_group_detail_t sgd 
                WHERE sgd.mt_idx = :mt_idx 
                    AND sgd.sgdt_discharge = 'N' 
                    AND sgd.sgdt_exit = 'N'
                    AND sgd.sgdt_show = 'Y'
            ))
            AND sst.sst_show = 'Y'
            AND sst.sst_sdate BETWEEN :start_date AND :end_date
            ORDER BY sst.sst_sdate ASC
            LIMIT 20
        """)
        
        schedules_result = db.execute(schedules_query, {
            "mt_idx": user.mt_idx,
            "start_date": seven_days_ago.strftime('%Y-%m-%d %H:%M:%S'),
            "end_date": seven_days_later.strftime('%Y-%m-%d %H:%M:%S')
        }).fetchall()
        
        recent_schedules = []
        for row in schedules_result:
            recent_schedules.append({
                "sst_idx": row.sst_idx,
                "sst_title": row.sst_title,
                "sst_sdate": row.sst_sdate.isoformat() if row.sst_sdate else None,
                "sst_location_title": row.sst_location_title,
                "sgt_idx": row.sgt_idx,
                "group_title": row.group_title
            })
        
        # 6. 사용자 기본 정보 구성
        user_data = {
            "mt_idx": user.mt_idx,
            "mt_type": user.mt_type or 1,
            "mt_level": user.mt_level or 2,
            "mt_status": user.mt_status or 1,
            "mt_id": user.mt_id or "",
            "mt_name": user.mt_name or "",
            "mt_nickname": user.mt_nickname or "",
            "mt_hp": user.mt_hp or "",
            "mt_email": user.mt_email or "",
            "mt_birth": user.mt_birth.isoformat() if user.mt_birth else None,
            "mt_gender": user.mt_gender or 1,
            "mt_file1": user.mt_file1 or "",
            "mt_lat": float(user.mt_lat) if user.mt_lat else 37.5642,
            "mt_long": float(user.mt_long) if user.mt_long else 127.0016,
            "mt_sido": user.mt_sido or "",
            "mt_gu": user.mt_gu or "",
            "mt_dong": user.mt_dong or "",
            "mt_onboarding": user.mt_onboarding or 'Y',
            "mt_push1": user.mt_push1 or 'Y',
            "mt_plan_check": user.mt_plan_check or 'N',
            "mt_plan_date": user.mt_plan_date.isoformat() if user.mt_plan_date else "",
            "mt_weather_pop": user.mt_weather_pop or "",
            "mt_weather_sky": user.mt_weather_sky or 8,
            "mt_weather_tmn": user.mt_weather_tmn or 18,
            "mt_weather_tmx": user.mt_weather_tmx or 25,
            "mt_weather_date": user.mt_weather_date.isoformat() if user.mt_weather_date else datetime.utcnow().isoformat(),
            "mt_ldate": user.mt_ldate.isoformat() if user.mt_ldate else datetime.utcnow().isoformat(),
            "mt_adate": user.mt_adate.isoformat() if user.mt_adate else datetime.utcnow().isoformat(),
            "mt_google_id": user.mt_google_id
        }
        
        # 7. 통계 계산
        group_count = len(groups)
        schedule_count = len(recent_schedules)
        has_data = group_count > 0 or schedule_count > 0
        
        logger.info(f"✅ 사용자 데이터 조회 완료: {user.mt_idx}, 그룹: {group_count}개, 스케줄: {schedule_count}개")
        
        return GoogleUserDataResponse(
            success=True,
            message="사용자 데이터 조회 성공",
            data={
                "found": True,
                "is_new_user": False,
                "user": user_data,
                "groups": groups,
                "recent_schedules": recent_schedules,
                "group_count": group_count,
                "schedule_count": schedule_count,
                "has_data": has_data,
                "lookup_method": "email",
                "needs_onboarding": user.mt_onboarding == 'N'
            }
        )
        
    except Exception as e:
        logger.error(f"이메일 기반 사용자 조회 실패: {str(e)}")
        return GoogleUserDataResponse(
            success=False,
            message="서버 오류가 발생했습니다."
                )

@router.post("/find-user-by-phone", response_model=GoogleUserDataResponse)
async def find_user_by_phone(
    request: PhoneUserDataRequest,
    db: Session = Depends(get_db)
):
    """
    전화번호로 사용자를 조회하고 관련 데이터를 함께 반환합니다.
    Google 로그인 후 기존 사용자 확인 및 데이터 조회용
    """
    try:
        from sqlalchemy import text
        from datetime import datetime, timedelta
        
        logger.info(f"🔍 전화번호 기반 사용자 조회 시작: {request.phone}")
        
        # 1. 전화번호로 사용자 조회 (mt_id와 mt_hp 모두 확인)
        from app.crud.crud_member import crud_member
        from app.models.member import Member
        
        # 전화번호 정리 (하이픈 제거)
        clean_phone = request.phone.replace('-', '')
        logger.info(f"🔍 정리된 전화번호: {clean_phone}")
        
        user = crud_member.get_by_phone(db, request.phone)
        
        if not user:
            logger.info(f"❌ 전화번호로 사용자를 찾을 수 없음: {request.phone} (정리된 번호: {clean_phone})")
            # 디버깅을 위해 직접 쿼리 실행
            mt_id_user = db.query(Member).filter(Member.mt_id == clean_phone).first()
            mt_hp_user = db.query(Member).filter(Member.mt_hp == clean_phone).first()
            logger.info(f"🔍 디버깅 - mt_id로 조회: {'찾음' if mt_id_user else '없음'}")
            logger.info(f"🔍 디버깅 - mt_hp로 조회: {'찾음' if mt_hp_user else '없음'}")
            return GoogleUserDataResponse(
                success=False,
                message="사용자를 찾을 수 없습니다.",
                data={
                    "found": False,
                    "is_new_user": True
                }
            )
        
        # 2. 계정 상태 확인
        if user.mt_level == 1:  # 탈퇴한 사용자
            logger.warning(f"⚠️ 탈퇴한 사용자 조회: {user.mt_idx}")
            return GoogleUserDataResponse(
                success=False,
                message="탈퇴한 계정입니다.",
                data={
                    "found": True,
                    "is_withdrawn": True,
                    "user": {
                        "mt_idx": user.mt_idx,
                        "mt_hp": user.mt_hp,
                        "mt_level": user.mt_level
                    }
                }
            )
        
        # 3. Google ID 연결 확인 및 업데이트
        if request.google_id and not user.mt_google_id:
            user.mt_google_id = request.google_id
            user.mt_type = 4  # Google 로그인 타입으로 변경
            user.mt_ldate = datetime.utcnow()
            db.commit()
            logger.info(f"🔗 Google ID 연결 완료: {user.mt_idx}")
        
        # 4. 사용자의 그룹 정보 조회
        groups_query = text("""
            SELECT 
                sg.sgt_idx,
                sg.sgt_title,
                sgd.sgdt_owner_chk,
                sgd.sgdt_leader_chk,
                COUNT(DISTINCT sgd2.mt_idx) as member_count
            FROM smap_group_detail_t sgd
            JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
            LEFT JOIN smap_group_detail_t sgd2 ON sg.sgt_idx = sgd2.sgt_idx 
                AND sgd2.sgdt_discharge = 'N' 
                AND sgd2.sgdt_exit = 'N'
                AND sgd2.sgdt_show = 'Y'
            WHERE sgd.mt_idx = :mt_idx
                AND sgd.sgdt_discharge = 'N'
                AND sgd.sgdt_exit = 'N'
                AND sgd.sgdt_show = 'Y'
                AND sg.sgt_show = 'Y'
            GROUP BY sg.sgt_idx, sg.sgt_title, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk
            ORDER BY sgd.sgdt_owner_chk DESC, sgd.sgdt_leader_chk DESC
            LIMIT 10
        """)
        
        groups_result = db.execute(groups_query, {"mt_idx": user.mt_idx}).fetchall()
        groups = []
        for row in groups_result:
            groups.append({
                "sgt_idx": row.sgt_idx,
                "sgt_title": row.sgt_title,
                "sgt_file1": None,  # 컬럼이 없으므로 기본값
                "sgdt_owner_chk": row.sgdt_owner_chk,
                "sgdt_leader_chk": row.sgdt_leader_chk,
                "member_count": row.member_count,
                "is_owner": row.sgdt_owner_chk == 'Y',
                "is_leader": row.sgdt_leader_chk == 'Y'
            })
        
        # 5. 최근 스케줄 조회 (7일 전후)
        seven_days_ago = datetime.now() - timedelta(days=7)
        seven_days_later = datetime.now() + timedelta(days=7)
        
        schedules_query = text("""
            SELECT 
                sst.sst_idx,
                sst.sst_title,
                sst.sst_sdate,
                sst.sst_edate,
                sst.sst_memo,
                sst.sgt_idx,
                sst.sst_location_title,
                sst.sst_location_add,
                sst.sst_location_lat,
                sst.sst_location_long,
                sg.sgt_title as group_title
            FROM smap_schedule_t sst
            LEFT JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
            WHERE sst.sst_show = 'Y'
                AND sst.sst_sdate BETWEEN :start_date AND :end_date
                AND EXISTS (
                    SELECT 1 FROM smap_group_detail_t sgd 
                    WHERE sgd.sgt_idx = sst.sgt_idx 
                        AND sgd.mt_idx = :mt_idx
                        AND sgd.sgdt_discharge = 'N'
                        AND sgd.sgdt_exit = 'N'
                        AND sgd.sgdt_show = 'Y'
                )
            ORDER BY sst.sst_sdate ASC
            LIMIT 20
        """)
        
        schedules_result = db.execute(schedules_query, {
            "mt_idx": user.mt_idx,
            "start_date": seven_days_ago,
            "end_date": seven_days_later
        }).fetchall()
        
        recent_schedules = []
        for row in schedules_result:
            recent_schedules.append({
                "sst_idx": row.sst_idx,
                "sst_title": row.sst_title,
                "sst_sdate": row.sst_sdate,
                "sst_edate": row.sst_edate,
                "sst_location_title": row.sst_location_title,
                "sst_location_add": row.sst_location_add,
                "sst_location_lat": row.sst_location_lat,
                "sst_location_long": row.sst_location_long,
                "sst_memo": row.sst_memo,
                "sgt_idx": row.sgt_idx,
                "group_title": row.group_title
            })
        
        # 6. 사용자 데이터 구성
        user_data = {
            "mt_idx": user.mt_idx,
            "mt_id": user.mt_id,
            "mt_name": user.mt_name,
            "mt_nickname": user.mt_nickname,
            "mt_hp": user.mt_hp,
            "mt_email": user.mt_email,
            "mt_birth": user.mt_birth,
            "mt_gender": user.mt_gender,
            "mt_type": user.mt_type,
            "mt_level": user.mt_level,
            "mt_file1": user.mt_file1,
            "mt_lat": user.mt_lat,
            "mt_long": user.mt_long,
            "mt_onboarding": user.mt_onboarding,
            "mt_ldate": user.mt_ldate,
            "mt_wdate": user.mt_wdate
        }
        
        group_count = len(groups)
        schedule_count = len(recent_schedules)
        has_data = group_count > 0 or schedule_count > 0
        
        logger.info(f"✅ 사용자 데이터 조회 완료: {user.mt_idx}, 그룹: {group_count}개, 스케줄: {schedule_count}개")
        
        return GoogleUserDataResponse(
            success=True,
            message="사용자 데이터 조회 성공",
            data={
                "found": True,
                "is_new_user": False,
                "user": user_data,
                "groups": groups,
                "recent_schedules": recent_schedules,
                "group_count": group_count,
                "schedule_count": schedule_count,
                "has_data": has_data,
                "lookup_method": "phone",
                "needs_onboarding": user.mt_onboarding == 'N'
            }
        )
        
    except Exception as e:
        logger.error(f"전화번호 기반 사용자 조회 실패: {str(e)}")
        return GoogleUserDataResponse(
            success=False,
            message="서버 오류가 발생했습니다."
        )

@router.post("/google-login", response_model=GoogleLoginResponse)
async def google_login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Google 로그인 처리 (422 에러 방지용으로 request 객체 직접 사용)
    """
    try:
        from app.services.member_service import member_service

        # 요청 본문 직접 파싱 (Pydantic 검증 우회)
        try:
            body = await request.json()
            logger.info(f"🔍 Google 로그인 원본 요청 데이터: {body}")
        except Exception as e:
            logger.error(f"요청 본문 파싱 실패: {e}")
            body = {}

        # 필수 필드 검증
        google_id = body.get('google_id')
        email = body.get('email')
        name = body.get('name')
        id_token = body.get('id_token')

        logger.info("🔍 Google 로그인 요청 데이터 검증:")
        logger.info(f"   - google_id: {'있음' if google_id else '없음'} ({len(str(google_id)) if google_id else 0}자)")
        logger.info(f"   - email: {email}")
        logger.info(f"   - name: {name}")
        logger.info(f"   - id_token: {'있음' if id_token else '없음'} ({len(str(id_token)) if id_token else 0}자)")

        # 최소한의 필수 데이터 검증
        if not google_id and not email:
            logger.error("❌ Google ID와 이메일 모두 누락")
            return GoogleLoginResponse(
                success=False,
                message="Google ID 또는 이메일이 필요합니다."
            )

        # Pydantic 모델 생성 (안전하게)
        try:
            google_data = GoogleLoginRequest(**body)
            logger.info("✅ Google 로그인 데이터 모델 생성 성공")
        except Exception as model_error:
            logger.warning(f"⚠️ 모델 생성 실패 (무시하고 진행): {model_error}")
            # 모델 생성 실패해도 계속 진행
            google_data = GoogleLoginRequest(
                google_id=google_id,
                email=email,
                name=name,
                id_token=id_token
            )

        logger.info(f"✅ Google 로그인 데이터 검증 통과: {email or '이메일 없음'}")

        # MemberService의 google_login 메소드 호출
        result = member_service.google_login(db, google_data)

        return result

    except Exception as e:
        logger.error(f"Google 로그인 실패: {str(e)}")
        logger.error(f"에러 타입: {type(e)}")
        import traceback
        logger.error(f"스택 트레이스:\n{traceback.format_exc()}")

        return GoogleLoginResponse(
            success=False,
            message="Google 로그인 처리 중 오류가 발생했습니다."
        )

@router.post("/apple-login", response_model=AppleLoginResponse)
async def apple_login(
    apple_request: AppleLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Apple 로그인 처리
    """
    try:
        from app.services.member_service import member_service
        logger.info(f"🔍 Apple 로그인 요청 수신: {apple_request.userIdentifier}")
        
        result = member_service.apple_login(db, apple_request)
        return result

    except Exception as e:
        logger.error(f"Apple 로그인 실패: {str(e)}")
        return AppleLoginResponse(
            success=False,
            message="Apple 로그인 처리 중 오류가 발생했습니다."
        )

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    forgot_data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    비밀번호 찾기 (SMS/이메일 발송)
    """
    try:
        logger.info(f"🔍 비밀번호 찾기 요청: {forgot_data.type}, {forgot_data.contact[:3]}***")
        
        # 사용자 조회
        if forgot_data.type == 'phone':
            clean_phone = forgot_data.contact.replace('-', '').replace(' ', '')
            user = crud_auth.get_user_by_phone(db, clean_phone)
        else:
            # 이메일로 사용자 조회 (탈퇴한 계정도 포함)
            user = db.query(Member).filter(Member.mt_email == forgot_data.contact).first()
        
        if not user:
            logger.warning(f"비밀번호 찾기: 존재하지 않는 사용자 {forgot_data.contact[:3]}***")
            return ForgotPasswordResponse(
                success=False,
                message="등록되지 않은 연락처입니다."
            )
        
        # 짧은 토큰 생성 (UUID 기반)
        short_token = str(uuid.uuid4())[:8]  # 8자리 짧은 토큰
        token_expires = datetime.utcnow() + timedelta(minutes=1)  # 1분으로 단축 (테스트용)
        
        # 토큰을 데이터베이스에 저장 (보안 강화)
        user.mt_reset_token = short_token
        user.mt_token_edate = token_expires
        db.commit()
        
        logger.info(f"💾 토큰 데이터베이스 저장 완료: 사용자 {user.mt_idx}, 토큰: {short_token}, 만료시간: {token_expires}")
        
        # 비밀번호 재설정 링크 생성 (운영환경 도메인 적용, URL 단축)
        reset_url = f"https://nextstep.smap.site/r?t={short_token}"
        
        logger.info(f"🔗 [테스트] 비밀번호 재설정 링크: {reset_url}")
        logger.info(f"🔗 [테스트] 토큰: {short_token}")
        
        # 실제 SMS/이메일 전송 구현
        if forgot_data.type == 'phone':
            # SMS 전송 로직
            try:
                from app.services.sms_service import sms_service
                sms_result = await sms_service.send_password_reset_sms(forgot_data.contact, reset_url)
                
                if sms_result['success']:
                    logger.info(f"✅ SMS 발송 성공: {forgot_data.contact[:3]}***")
                else:
                    logger.warning(f"⚠️ SMS 발송 실패: {sms_result['message']}")
                    
            except Exception as e:
                logger.error(f"❌ SMS 발송 중 오류: {str(e)}")
        else:
            # 이메일 전송 로직
            try:
                from app.services.email_service import email_service
                email_result = await email_service.send_password_reset_email(forgot_data.contact, reset_url)
                
                if email_result['success']:
                    logger.info(f"✅ 이메일 발송 성공: {forgot_data.contact}")
                else:
                    logger.warning(f"⚠️ 이메일 발송 실패: {email_result['message']}")
                    
            except Exception as e:
                logger.error(f"❌ 이메일 발송 중 오류: {str(e)}")
        
        logger.info(f"📱 비밀번호 재설정 링크 준비 완료: {forgot_data.type} -> {forgot_data.contact[:3]}***")
        
        return ForgotPasswordResponse(
            success=True,
            message=f"{'SMS' if forgot_data.type == 'phone' else '이메일'}로 비밀번호 재설정 링크를 발송했습니다.",
            data={
                "type": forgot_data.type,
                "contact": forgot_data.contact,
                "token_expires": "1분",  # 하드코딩으로 1분 설정
                "sent": True
            }
        )
        
    except Exception as e:
        logger.error(f"비밀번호 찾기 실패: {str(e)}")
        return ForgotPasswordResponse(
            success=False,
            message="요청 처리 중 오류가 발생했습니다."
        )

@router.post("/verify-reset-token", response_model=VerifyResetTokenResponse)
async def verify_reset_token(
    token_data: VerifyResetTokenRequest,
    db: Session = Depends(get_db)
):
    """
    비밀번호 재설정 토큰 검증
    """
    try:
        logger.info(f"🔍 토큰 검증 요청: {len(token_data.token)}자 토큰")
        
        # 짧은 토큰 검증 (UUID 기반)
        if len(token_data.token) != 8:
            logger.warning("토큰 길이가 올바르지 않음")
            return VerifyResetTokenResponse(
                success=False,
                message="유효하지 않은 토큰입니다."
            )
        
        # 데이터베이스에서 토큰으로 사용자 조회
        user = db.query(Member).filter(
            Member.mt_reset_token == token_data.token,
            Member.mt_token_edate > datetime.utcnow()
        ).first()
        
        if not user:
            logger.warning(f"토큰 검증 실패: 유효하지 않은 토큰 {token_data.token}")
            return VerifyResetTokenResponse(
                success=False,
                message="토큰이 만료되었거나 유효하지 않습니다."
            )
        
        logger.info(f"✅ 토큰 검증 성공: 사용자 {user.mt_idx}")
        
        return VerifyResetTokenResponse(
            success=True,
            message="토큰이 유효합니다.",
            data={
                "user_id": user.mt_idx,
                "type": "phone",  # 기본값
                "email": user.mt_email,
                "phone": user.mt_hp
            }
        )
        
    except Exception as e:
        logger.error(f"토큰 검증 실패: {str(e)}")
        return VerifyResetTokenResponse(
            success=False,
            message="요청 처리 중 오류가 발생했습니다."
        )

@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    비밀번호 재설정 처리
    """
    try:
        import re
        
        logger.info(f"🔄 비밀번호 재설정 요청: {len(reset_data.token)}자 토큰")
        
        # 짧은 토큰 검증 (UUID 기반)
        if len(reset_data.token) != 8:
            logger.warning("토큰 길이가 올바르지 않음")
            return ResetPasswordResponse(
                success=False,
                message="유효하지 않은 토큰입니다."
            )
        
        # 데이터베이스에서 토큰으로 사용자 조회
        user = db.query(Member).filter(
            Member.mt_reset_token == reset_data.token,
            Member.mt_token_edate > datetime.utcnow()
        ).first()
        
        if not user:
            logger.warning(f"비밀번호 재설정: 유효하지 않은 토큰 {reset_data.token}")
            return ResetPasswordResponse(
                success=False,
                message="토큰이 만료되었거나 유효하지 않습니다."
            )
        
        # 새 비밀번호 검증
        if len(reset_data.new_password) < 8:
            return ResetPasswordResponse(
                success=False,
                message="비밀번호는 8자 이상이어야 합니다."
            )
        
        # 비밀번호 강도 검증
        has_letter = bool(re.search(r'[a-zA-Z]', reset_data.new_password))
        has_number = bool(re.search(r'\d', reset_data.new_password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', reset_data.new_password))
        
        if not (has_letter and has_number and has_special):
            return ResetPasswordResponse(
                success=False,
                message="비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
            )
        
        # 비밀번호 업데이트
        success = crud_auth.update_user_password(db, user.mt_idx, reset_data.new_password)
        
        if not success:
            logger.error(f"비밀번호 업데이트 실패: 사용자 {user.mt_idx}")
            return ResetPasswordResponse(
                success=False,
                message="비밀번호 변경에 실패했습니다."
            )
        
        # 토큰 사용 후 무효화 (보안 강화)
        user.mt_reset_token = None
        user.mt_token_edate = None
        db.commit()
        
        logger.info(f"✅ 비밀번호 재설정 완료: 사용자 {user.mt_idx}")
        
        return ResetPasswordResponse(
            success=True,
            message="비밀번호가 성공적으로 변경되었습니다.",
            data={
                "user_id": user.mt_idx,
                "email": user.mt_email,
                "updated_at": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"비밀번호 재설정 실패: {str(e)}")
        return ResetPasswordResponse(
            success=False,
            message="요청 처리 중 오류가 발생했습니다."
        ) 

@router.post("/reset-password-by-phone", response_model=ResetPasswordResponse)
async def reset_password_by_phone(
    reset_data: ResetPasswordByPhoneRequest,
    db: Session = Depends(get_db)
):
    """
    전화번호 기반 비밀번호 재설정 (네이티브 앱용)
    SMS 인증이 완료된 후 호출됨
    """
    try:
        import re
        
        # 전화번호 정리
        clean_phone = reset_data.phone.replace('-', '').replace(' ', '')
        
        logger.info(f"🔄 전화번호 기반 비밀번호 재설정 요청: {clean_phone[:3]}***")
        
        # 전화번호로 사용자 조회
        user = crud_auth.get_user_by_phone(db, clean_phone)
        
        if not user:
            logger.warning(f"비밀번호 재설정: 존재하지 않는 사용자 {clean_phone[:3]}***")
            return ResetPasswordResponse(
                success=False,
                message="등록되지 않은 전화번호입니다."
            )
        
        # 새 비밀번호 검증
        if len(reset_data.new_password) < 8:
            return ResetPasswordResponse(
                success=False,
                message="비밀번호는 8자 이상이어야 합니다."
            )
        
        # 비밀번호 강도 검증
        has_letter = bool(re.search(r'[a-zA-Z]', reset_data.new_password))
        has_number = bool(re.search(r'\d', reset_data.new_password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', reset_data.new_password))
        
        if not (has_letter and has_number and has_special):
            return ResetPasswordResponse(
                success=False,
                message="비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
            )
        
        # 비밀번호 업데이트
        success = crud_auth.update_user_password(db, user.mt_idx, reset_data.new_password)
        
        if not success:
            logger.error(f"비밀번호 업데이트 실패: 사용자 {user.mt_idx}")
            return ResetPasswordResponse(
                success=False,
                message="비밀번호 변경에 실패했습니다."
            )
        
        logger.info(f"✅ 전화번호 기반 비밀번호 재설정 완료: 사용자 {user.mt_idx}")
        
        return ResetPasswordResponse(
            success=True,
            message="비밀번호가 성공적으로 변경되었습니다.",
            data={
                "user_id": user.mt_idx,
                "updated_at": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"전화번호 기반 비밀번호 재설정 실패: {str(e)}")
        return ResetPasswordResponse(
            success=False,
            message="요청 처리 중 오류가 발생했습니다."
        )