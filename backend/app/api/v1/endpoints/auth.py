from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from pydantic import BaseModel
from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth import LoginRequest, LoginResponse, UserIdentity, RegisterRequest
from app.crud import crud_auth
import logging

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 로거 설정
logger = logging.getLogger(__name__)

# home/page.tsx의 AuthContext에서 사용하는 로그인 요청 모델
class LoginRequestHome(BaseModel):
    mt_id: str  # 아이디 (전화번호 또는 이메일)
    mt_pwd: str  # 비밀번호

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

# 카카오 로그인 응답 모델
class KakaoLoginResponse(BaseModel):
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
        
        if not user:
            return LoginResponseHome(
                success=False,
                message="아이디 또는 비밀번호가 올바르지 않습니다."
            )
        
        # 비밀번호 검증
        if not user.mt_pwd or not crud_auth.verify_password(login_request.mt_pwd, user.mt_pwd):
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
        
        # 로그인 시간 업데이트
        user.mt_ldate = datetime.utcnow()
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
            "mt_birth": user.mt_birth.isoformat() if user.mt_birth else "",
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
    
    user.mt_ldate = datetime.utcnow()
    db.commit()

    return LoginResponse(
        access_token=access_token,
        user=user_identity
    )

@router.post("/register", response_model=UserIdentity, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: RegisterRequest,
    db: Session = Depends(get_db)
):
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="사용자 생성 중 오류가 발생했습니다."
        )

    return crud_auth.create_user_identity_from_member(created_user)

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
            # 기존 사용자 로그인
            logger.info(f"[KAKAO LOGIN] 기존 카카오 사용자 로그인: mt_idx={existing_user.mt_idx}")
            user = existing_user
        else:
            # 이메일로 기존 계정 조회 (이메일이 있는 경우)
            if kakao_request.email:
                email_user = crud_auth.get_user_by_email(db, kakao_request.email)
                if email_user:
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

        # 로그인 시간 업데이트
        user.mt_ldate = datetime.utcnow()
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
            "mt_birth": user.mt_birth.isoformat() if user.mt_birth else "",
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