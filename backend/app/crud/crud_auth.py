from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime # mt_wdate 등 날짜 필드용
from app.models.member import Member  # member_t 테이블에 매핑된 모델
from app.schemas.auth import UserIdentity, RegisterRequest # RegisterRequest 임포트
from app.config import Config  # 설정 파일 import
from typing import Optional
import re

# FastAPI 의존성: 현재 회원 조회를 위해 사용
from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from app.api.deps import get_db

def get_user_by_phone(db: Session, phone_number: str) -> Optional[Member]:
    """전화번호(mt_id)로 사용자를 조회합니다."""
    return db.query(Member).filter(Member.mt_id == phone_number).first()

def get_user_by_email(db: Session, email: str) -> Optional[Member]:
    """이메일로 사용자를 조회합니다 (중복 체크용)."""
    return db.query(Member).filter(Member.mt_email == email).first()

def get_user_by_kakao_id(db: Session, kakao_id: str) -> Optional[Member]:
    """카카오 ID로 사용자를 조회합니다."""
    return db.query(Member).filter(
        Member.mt_kakao_id == kakao_id,
        Member.mt_level >= 2, # 정상회원 레벨 이상 (탈퇴회원 mt_level=1 제외)
        Member.mt_status == '1', # 정상상태
        Member.mt_show == 'Y' # 노출여부
    ).first()

def get_user_by_idx(db: Session, mt_idx: int) -> Optional[Member]:
    """사용자 인덱스로 사용자를 조회합니다."""
    return db.query(Member).filter(
        Member.mt_idx == mt_idx,
        Member.mt_level >= 2, # 정상회원 레벨 이상 (탈퇴회원 mt_level=1 제외)
        Member.mt_status == '1', # 정상상태
        Member.mt_show == 'Y' # 노출여부
    ).first()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """입력된 비밀번호와 해시된 비밀번호를 비교합니다."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[VERIFY_PASSWORD] 비밀번호 검증 시작 - plain_password_length: {len(plain_password)}, hashed_password_exists: {bool(hashed_password)}")
    
    if not hashed_password: # DB에 비밀번호가 없는 경우 (예: 소셜 로그인 사용자)
        logger.warning("[VERIFY_PASSWORD] 해시된 비밀번호가 없음")
        return False
    
    try:
        result = bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        logger.info(f"[VERIFY_PASSWORD] 비밀번호 검증 결과: {result}")
        return result
    except Exception as e:
        logger.error(f"[VERIFY_PASSWORD] 비밀번호 검증 중 오류: {str(e)}")
        return False

def verify_user_password(db: Session, mt_idx: int, current_password: str) -> bool:
    """사용자의 현재 비밀번호를 확인합니다."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[VERIFY_PASSWORD] 비밀번호 확인 시작 - mt_idx: {mt_idx}")
    
    user = get_user_by_idx(db, mt_idx)
    if not user:
        logger.warning(f"[VERIFY_PASSWORD] 사용자를 찾을 수 없음 - mt_idx: {mt_idx}")
        return False
    
    logger.info(f"[VERIFY_PASSWORD] 사용자 확인됨 - mt_idx: {mt_idx}, name: {user.mt_name}, type: {user.mt_type}")
    
    # 비밀번호가 없는 경우 (소셜 로그인 사용자가 비밀번호를 아직 설정하지 않은 경우)
    if not user.mt_pwd:
        logger.warning(f"[VERIFY_PASSWORD] 사용자에게 비밀번호가 없음 - mt_idx: {mt_idx}")
        return False
    
    logger.info(f"[VERIFY_PASSWORD] 비밀번호 해시 확인 시작 - mt_idx: {mt_idx}")
    result = verify_password(current_password, user.mt_pwd)
    logger.info(f"[VERIFY_PASSWORD] 비밀번호 확인 결과 - mt_idx: {mt_idx}, result: {result}")
    
    return result

def change_user_password(db: Session, mt_idx: int, new_password: str) -> bool:
    """사용자의 비밀번호를 변경합니다."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[CHANGE_PASSWORD] 비밀번호 변경 시작 - mt_idx: {mt_idx}")
    
    user = get_user_by_idx(db, mt_idx)
    if not user:
        logger.warning(f"[CHANGE_PASSWORD] 사용자를 찾을 수 없음 - mt_idx: {mt_idx}")
        return False
    
    logger.info(f"[CHANGE_PASSWORD] 사용자 확인됨 - mt_idx: {mt_idx}, name: {user.mt_name}, type: {user.mt_type}")
    
    try:
        # 새 비밀번호 해싱
        logger.info(f"[CHANGE_PASSWORD] 새 비밀번호 해싱 시작 - mt_idx: {mt_idx}")
        hashed_password = get_hashed_password(new_password)
        logger.info(f"[CHANGE_PASSWORD] 새 비밀번호 해싱 완료 - mt_idx: {mt_idx}")
        
        # 비밀번호 업데이트
        user.mt_pwd = hashed_password
        user.mt_udate = datetime.utcnow()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"[CHANGE_PASSWORD] 비밀번호 변경 성공 - mt_idx: {mt_idx}")
        return True
        
    except Exception as e:
        logger.error(f"[CHANGE_PASSWORD] 비밀번호 변경 실패 - mt_idx: {mt_idx}, error: {str(e)}")
        db.rollback()
        return False

def validate_password_policy(password: str) -> tuple[bool, list[str]]:
    """비밀번호 정책을 검증합니다."""
    errors = []
    
    # 최소 길이 검사
    if len(password) < Config.PASSWORD_MIN_LENGTH:
        errors.append(f"비밀번호는 최소 {Config.PASSWORD_MIN_LENGTH}자 이상이어야 합니다.")
    
    # 대문자 검사
    if Config.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        errors.append("비밀번호에 대문자가 포함되어야 합니다.")
    
    # 소문자 검사
    if Config.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        errors.append("비밀번호에 소문자가 포함되어야 합니다.")
    
    # 숫자 검사
    if Config.PASSWORD_REQUIRE_NUMBERS and not re.search(r'\d', password):
        errors.append("비밀번호에 숫자가 포함되어야 합니다.")
    
    # 특수문자 검사
    if Config.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("비밀번호에 특수문자가 포함되어야 합니다.")
    
    return len(errors) == 0, errors

def get_hashed_password(password: str) -> str:
    """비밀번호를 해싱합니다. (PHP PASSWORD_DEFAULT와 유사한 방식)"""
    # 비밀번호 정책 검증
    is_valid, errors = validate_password_policy(password)
    if not is_valid:
        raise ValueError(f"비밀번호 정책 위반: {', '.join(errors)}")
    
    # bcrypt 비용 설정 (PHP의 PASSWORD_DEFAULT와 동일한 방식)
    cost = Config.PASSWORD_BCRYPT_COST
    salt = bcrypt.gensalt(rounds=cost)
    
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_user(db: Session, user_in: RegisterRequest) -> Member:
    """새로운 사용자를 생성합니다."""
    hashed_password = get_hashed_password(user_in.mt_pwd)
    db_user = Member(
        mt_id=user_in.mt_id.replace("-", ""), # 하이픈 제거
        mt_pwd=hashed_password,
        mt_name=user_in.mt_name,
        mt_email=user_in.mt_email,
        mt_hp=user_in.mt_hp.replace("-", ""), # 하이픈 제거
        mt_type=1,  # 기본값: 일반회원
        mt_level=2, # 기본값: 일반(무료)
        mt_status=1, # 기본값: 정상
        mt_show='Y', # 기본값: 노출
        mt_wdate=datetime.utcnow(), # 등록일시
        mt_ldate=datetime.utcnow(), # 마지막 로그인 일시 (회원가입 시 현재로)
        mt_agree1='Y', # 필수 약관 동의로 가정 (실제로는 요청에서 받아야 함)
        mt_agree2='Y',
        mt_agree3='Y',
        # ... 기타 필요한 기본값 설정 ...
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    # 회원가입 시 전달된 FCM 토큰 저장
    try:
        if getattr(user_in, 'fcm_token', None):
            db_user.mt_token_id = user_in.fcm_token
            db.commit()
            db.refresh(db_user)
    except Exception:
        db.rollback()
    return db_user

def create_kakao_user(db: Session, kakao_data) -> Member:
    """카카오 로그인으로 새로운 사용자를 생성합니다."""
    # 카카오 ID를 기반으로 임시 mt_id 생성
    temp_id = f"kakao_{kakao_data.kakao_id}"
    
    db_user = Member(
        mt_id=temp_id,
        mt_kakao_id=kakao_data.kakao_id,
        mt_name=kakao_data.nickname,
        mt_nickname=kakao_data.nickname,
        mt_email=kakao_data.email,
        mt_file1=kakao_data.profile_image,
        mt_type=2,  # 카카오 로그인
        mt_level=2, # 기본값: 일반(무료)
        mt_status=1, # 기본값: 정상
        mt_show='Y', # 기본값: 노출
        mt_wdate=datetime.utcnow(), # 등록일시
        mt_ldate=datetime.utcnow(), # 마지막 로그인 일시
        mt_agree1='Y', # 필수 약관 동의로 가정
        mt_agree2='Y',
        mt_agree3='Y',
        # 기본 위치 (서울시청)
        mt_lat=37.5642,
        mt_long=127.0016,
        mt_sido='서울특별시',
        mt_gu='중구',
        mt_dong='태평로1가',
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# 사용자 정보를 UserIdentity 스키마로 변환하는 헬퍼 함수
def create_user_identity_from_member(member: Member) -> UserIdentity:
    return UserIdentity(
        mt_idx=member.mt_idx,
        mt_id=member.mt_id,
        mt_name=member.mt_name,
        mt_level=member.mt_level
    )

def update_user_profile(db: Session, mt_idx: int, profile_data: dict) -> bool:
    """사용자의 프로필 정보를 업데이트합니다."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[UPDATE_PROFILE] 프로필 업데이트 시작 - mt_idx: {mt_idx}")
    
    user = get_user_by_idx(db, mt_idx)
    if not user:
        logger.warning(f"[UPDATE_PROFILE] 사용자를 찾을 수 없음 - mt_idx: {mt_idx}")
        return False
    
    logger.info(f"[UPDATE_PROFILE] 사용자 확인됨 - mt_idx: {mt_idx}, name: {user.mt_name}")
    
    try:
        # 프로필 정보 업데이트
        if 'mt_name' in profile_data:
            user.mt_name = profile_data['mt_name']
        if 'mt_nickname' in profile_data:
            user.mt_nickname = profile_data['mt_nickname']
        if 'mt_birth' in profile_data and profile_data['mt_birth']:
            try:
                user.mt_birth = datetime.strptime(profile_data['mt_birth'], '%Y-%m-%d').date()
            except ValueError:
                logger.warning(f"[UPDATE_PROFILE] 잘못된 생년월일 형식 - mt_idx: {mt_idx}")
        if 'mt_gender' in profile_data:
            user.mt_gender = profile_data['mt_gender']
        
        user.mt_udate = datetime.utcnow()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"[UPDATE_PROFILE] 프로필 업데이트 성공 - mt_idx: {mt_idx}")
        return True
        
    except Exception as e:
        logger.error(f"[UPDATE_PROFILE] 프로필 업데이트 실패 - mt_idx: {mt_idx}, error: {str(e)}")
        db.rollback()
        return False

def update_user_contact(db: Session, mt_idx: int, contact_data: dict) -> bool:
    """사용자의 연락처 정보를 업데이트합니다."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[UPDATE_CONTACT] 연락처 업데이트 시작 - mt_idx: {mt_idx}")
    
    user = get_user_by_idx(db, mt_idx)
    if not user:
        logger.warning(f"[UPDATE_CONTACT] 사용자를 찾을 수 없음 - mt_idx: {mt_idx}")
        return False
    
    logger.info(f"[UPDATE_CONTACT] 사용자 확인됨 - mt_idx: {mt_idx}, name: {user.mt_name}")
    
    try:
        # 연락처 정보 업데이트
        if 'mt_hp' in contact_data:
            # 전화번호 형식 정리 (하이픈 제거)
            clean_phone = contact_data['mt_hp'].replace('-', '')
            user.mt_hp = clean_phone
        if 'mt_email' in contact_data:
            user.mt_email = contact_data['mt_email']
        
        user.mt_udate = datetime.utcnow()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"[UPDATE_CONTACT] 연락처 업데이트 성공 - mt_idx: {mt_idx}")
        return True
        
    except Exception as e:
        logger.error(f"[UPDATE_CONTACT] 연락처 업데이트 실패 - mt_idx: {mt_idx}, error: {str(e)}")
        db.rollback()
        return False

def check_phone_duplicate(db: Session, mt_idx: int, phone: str) -> bool:
    """전화번호 중복 확인 (자신 제외)"""
    clean_phone = phone.replace('-', '')
    existing_user = db.query(Member).filter(
        Member.mt_hp == clean_phone,
        Member.mt_idx != mt_idx,
        Member.mt_status == '1',
        Member.mt_show == 'Y'
    ).first()
    return existing_user is not None

def check_email_duplicate(db: Session, mt_idx: int, email: str) -> bool:
    """이메일 중복 확인 (자신 제외)"""
    existing_user = db.query(Member).filter(
        Member.mt_email == email,
        Member.mt_idx != mt_idx,
        Member.mt_status == '1',
        Member.mt_show == 'Y'
    ).first()
    return existing_user is not None

def check_nickname_duplicate(db: Session, mt_idx: int, nickname: str) -> bool:
    """닉네임 중복 확인 (자신 제외)"""
    existing_user = db.query(Member).filter(
        Member.mt_nickname == nickname,
        Member.mt_idx != mt_idx,
        Member.mt_status == '1',
        Member.mt_show == 'Y'
    ).first()
    return existing_user is not None

def update_user_password(db: Session, mt_idx: int, new_password: str) -> bool:
    """사용자 비밀번호 업데이트"""
    try:
        # 새 비밀번호 해시화
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # 사용자 조회
        user = db.query(Member).filter(Member.mt_idx == mt_idx).first()
        if not user:
            return False
        
        # 비밀번호 업데이트
        user.mt_pwd = hashed_password
        user.mt_udate = datetime.utcnow()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(user)
        
        return True
        
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"비밀번호 업데이트 실패: {str(e)}")
        return False 


def get_current_member(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> Member:
    """Authorization Bearer 토큰에서 mt_idx를 추출해 현재 회원 엔터티를 반환합니다.

    - 프론트엔드와 동일한 하드코딩 키/알고리즘을 사용합니다.
    - 유효하지 않으면 401 오류를 발생시킵니다.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")

    token = authorization.split(" ")[1]

    try:
        secret_key = 'smap!@super-secret'
        algorithm = 'HS256'
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        mt_idx: Optional[int] = payload.get("mt_idx")
        if not mt_idx:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

        user = db.query(Member).filter(Member.mt_idx == mt_idx).first()
        if not user:
            raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다.")