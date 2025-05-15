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

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=LoginResponse)
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