from sqlalchemy.orm import Session
from app.crud.crud_member import crud_member
from app.schemas.member import (
    MemberCreate, 
    MemberUpdate, 
    MemberResponse, 
    RegisterRequest, 
    RegisterResponse,
    MemberLoginResponse
)
from app.models.member import Member
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class MemberService:
    def __init__(self):
        self.crud = crud_member

    def register_member(self, db: Session, register_data: RegisterRequest) -> RegisterResponse:
        """회원가입 처리"""
        try:
            # 1. 전화번호 중복 확인
            existing_member = self.crud.get_by_phone(db, register_data.mt_id)
            if existing_member:
                return RegisterResponse(
                    success=False,
                    message="이미 가입된 전화번호입니다."
                )

            # 2. 이메일 중복 확인 (이메일이 있는 경우)
            if register_data.mt_email:
                existing_email = self.crud.get_by_email(db, register_data.mt_email)
                if existing_email:
                    return RegisterResponse(
                        success=False,
                        message="이미 가입된 이메일입니다."
                    )

            # 3. 닉네임 중복 확인
            existing_nickname = db.query(Member).filter(
                Member.mt_nickname == register_data.mt_nickname
            ).first()
            if existing_nickname:
                return RegisterResponse(
                    success=False,
                    message="이미 사용 중인 닉네임입니다."
                )

            # 4. 회원 생성
            new_member = self.crud.create_from_register(db, obj_in=register_data)
            
            # 5. 응답 데이터 구성
            member_data = {
                "mt_idx": new_member.mt_idx,
                "mt_id": new_member.mt_id,
                "mt_name": new_member.mt_name,
                "mt_nickname": new_member.mt_nickname,
                "mt_email": new_member.mt_email,
                "mt_wdate": new_member.mt_wdate.isoformat() if new_member.mt_wdate else None
            }

            logger.info(f"회원가입 성공: {new_member.mt_id} ({new_member.mt_name})")
            
            return RegisterResponse(
                success=True,
                message="회원가입이 완료되었습니다.",
                data=member_data
            )

        except Exception as e:
            logger.error(f"회원가입 실패: {str(e)}")
            return RegisterResponse(
                success=False,
                message="회원가입 처리 중 오류가 발생했습니다."
            )

    def login_member(self, db: Session, phone_or_email: str, password: str) -> MemberLoginResponse:
        """로그인 처리"""
        try:
            # 1. 사용자 인증
            user = self.crud.authenticate(db, phone_or_email=phone_or_email, password=password)
            if not user:
                return MemberLoginResponse(
                    success=False,
                    message="아이디 또는 비밀번호가 올바르지 않습니다."
                )

            # 2. 계정 상태 확인
            if not self.crud.is_active(user):
                return MemberLoginResponse(
                    success=False,
                    message="비활성화된 계정입니다. 고객센터에 문의해주세요."
                )

            # 3. 로그인 시간 업데이트
            self.crud.update_login_time(db, user=user)

            # 4. 사용자 정보 구성 (home/page.tsx의 Member 타입에 맞춤)
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

            logger.info(f"로그인 성공: {user.mt_id} ({user.mt_name})")

            return MemberLoginResponse(
                success=True,
                message="로그인 성공",
                data={"user": user_data}
            )

        except Exception as e:
            logger.error(f"로그인 실패: {str(e)}")
            return MemberLoginResponse(
                success=False,
                message="로그인 처리 중 오류가 발생했습니다."
            )

    def get_member(self, db: Session, member_id: int) -> Optional[Member]:
        """회원 정보 조회"""
        return self.crud.get(db, member_id)

    def get_member_by_phone(self, db: Session, phone: str) -> Optional[Member]:
        """전화번호로 회원 조회"""
        return self.crud.get_by_phone(db, phone)

    def get_member_by_email(self, db: Session, email: str) -> Optional[Member]:
        """이메일로 회원 조회"""
        return self.crud.get_by_email(db, email)

    def update_member(self, db: Session, member_id: int, update_data: MemberUpdate) -> Optional[Member]:
        """회원 정보 수정"""
        try:
            member = self.crud.get(db, member_id)
            if not member:
                return None
            
            updated_member = self.crud.update(db, db_obj=member, obj_in=update_data)
            logger.info(f"회원 정보 수정: {member.mt_id} ({member.mt_name})")
            return updated_member
            
        except Exception as e:
            logger.error(f"회원 정보 수정 실패: {str(e)}")
            return None

    def delete_member(self, db: Session, member_id: int) -> bool:
        """회원 탈퇴 처리"""
        try:
            member = self.crud.get(db, member_id)
            if not member:
                return False
            
            self.crud.delete(db, id=member_id)
            logger.info(f"회원 탈퇴: {member.mt_id} ({member.mt_name})")
            return True
            
        except Exception as e:
            logger.error(f"회원 탈퇴 실패: {str(e)}")
            return False

    def search_members(self, db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Member]:
        """회원 검색"""
        return self.crud.search(db, query=query, skip=skip, limit=limit)

    def get_members_list(
        self, 
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[int] = None,
        level: Optional[int] = None
    ) -> List[Member]:
        """회원 목록 조회"""
        return self.crud.get_multi(db, skip=skip, limit=limit, status=status, level=level)

    def update_member_location(self, db: Session, member_id: int, lat: float, lng: float) -> Optional[Member]:
        """회원 위치 정보 업데이트"""
        try:
            member = self.crud.get(db, member_id)
            if not member:
                return None
            
            updated_member = self.crud.update_location(db, user=member, lat=lat, lng=lng)
            return updated_member
            
        except Exception as e:
            logger.error(f"위치 정보 업데이트 실패: {str(e)}")
            return None

    def check_phone_availability(self, db: Session, phone: str) -> bool:
        """전화번호 사용 가능 여부 확인"""
        existing_member = self.crud.get_by_phone(db, phone)
        return existing_member is None

    def check_email_availability(self, db: Session, email: str) -> bool:
        """이메일 사용 가능 여부 확인"""
        existing_member = self.crud.get_by_email(db, email)
        return existing_member is None

    def check_nickname_availability(self, db: Session, nickname: str) -> bool:
        """닉네임 사용 가능 여부 확인"""
        existing_member = db.query(Member).filter(Member.mt_nickname == nickname).first()
        return existing_member is None

# 서비스 인스턴스 생성
member_service = MemberService() 