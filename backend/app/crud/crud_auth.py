from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime # mt_wdate 등 날짜 필드용
from app.models.member import Member  # member_t 테이블에 매핑된 모델
from app.schemas.auth import UserIdentity, RegisterRequest # RegisterRequest 임포트
from typing import Optional

def get_user_by_phone(db: Session, phone_number: str) -> Optional[Member]:
    """전화번호(mt_id)로 사용자를 조회합니다."""
    return db.query(Member).filter(
        Member.mt_id == phone_number,
        Member.mt_type == '1', # 일반회원
        Member.mt_level >= 2, # 정상회원 레벨 이상
        Member.mt_status == '1', # 정상상태
        Member.mt_show == 'Y' # 노출여부
    ).first()

def get_user_by_email(db: Session, email: str) -> Optional[Member]:
    """이메일로 사용자를 조회합니다 (중복 체크용)."""
    return db.query(Member).filter(Member.mt_email == email).first()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """입력된 비밀번호와 해시된 비밀번호를 비교합니다."""
    if not hashed_password: # DB에 비밀번호가 없는 경우 (예: 소셜 로그인 사용자)
        return False
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_hashed_password(password: str) -> str:
    """비밀번호를 해싱합니다."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


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
    return db_user

# 사용자 정보를 UserIdentity 스키마로 변환하는 헬퍼 함수
def create_user_identity_from_member(member: Member) -> UserIdentity:
    return UserIdentity(
        mt_idx=member.mt_idx,
        mt_id=member.mt_id,
        mt_name=member.mt_name,
        mt_level=member.mt_level
    ) 