from sqlalchemy.orm import Session
from app.crud.crud_member import crud_member
from app.schemas.member import (
    MemberCreate, 
    MemberUpdate, 
    MemberResponse, 
    RegisterRequest, 
    RegisterResponse,
    MemberLoginResponse,
    GoogleLoginRequest,
    GoogleLoginResponse
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

    def google_login(self, db: Session, google_data: GoogleLoginRequest) -> GoogleLoginResponse:
        """Google 로그인 처리"""
        try:
            # 1. Google ID로 기존 사용자 확인
            existing_member = db.query(Member).filter(Member.mt_google_id == google_data.google_id).first()
            
            if existing_member:
                # 기존 사용자 로그인
                # 계정 상태 확인
                if not self.crud.is_active(existing_member):
                    return GoogleLoginResponse(
                        success=False,
                        message="비활성화된 계정입니다. 고객센터에 문의해주세요."
                    )

                # 로그인 시간 업데이트
                self.crud.update_login_time(db, user=existing_member)

                # 사용자 정보 구성
                user_data = {
                    "mt_idx": existing_member.mt_idx,
                    "mt_type": existing_member.mt_type or 1,
                    "mt_level": existing_member.mt_level or 2,
                    "mt_status": existing_member.mt_status or 1,
                    "mt_id": existing_member.mt_id or "",
                    "mt_name": existing_member.mt_name or "",
                    "mt_nickname": existing_member.mt_nickname or "",
                    "mt_hp": existing_member.mt_hp or "",
                    "mt_email": existing_member.mt_email or "",
                    "mt_birth": existing_member.mt_birth.isoformat() if existing_member.mt_birth else "",
                    "mt_gender": existing_member.mt_gender or 1,
                    "mt_file1": existing_member.mt_file1 or "",
                    "mt_lat": float(existing_member.mt_lat) if existing_member.mt_lat else 37.5642,
                    "mt_long": float(existing_member.mt_long) if existing_member.mt_long else 127.0016,
                    "mt_sido": existing_member.mt_sido or "",
                    "mt_gu": existing_member.mt_gu or "",
                    "mt_dong": existing_member.mt_dong or "",
                    "mt_onboarding": existing_member.mt_onboarding or 'Y',
                    "mt_push1": existing_member.mt_push1 or 'Y',
                    "mt_plan_check": existing_member.mt_plan_check or 'N',
                    "mt_plan_date": existing_member.mt_plan_date.isoformat() if existing_member.mt_plan_date else "",
                    "mt_weather_pop": existing_member.mt_weather_pop or "",
                    "mt_weather_sky": existing_member.mt_weather_sky or 8,
                    "mt_weather_tmn": existing_member.mt_weather_tmn or 18,
                    "mt_weather_tmx": existing_member.mt_weather_tmx or 25,
                    "mt_weather_date": existing_member.mt_weather_date.isoformat() if existing_member.mt_weather_date else datetime.utcnow().isoformat(),
                    "mt_ldate": existing_member.mt_ldate.isoformat() if existing_member.mt_ldate else datetime.utcnow().isoformat(),
                    "mt_adate": existing_member.mt_adate.isoformat() if existing_member.mt_adate else datetime.utcnow().isoformat()
                }

                logger.info(f"Google 로그인 성공: {existing_member.mt_email} ({existing_member.mt_name})")

                return GoogleLoginResponse(
                    success=True,
                    message="Google 로그인 성공",
                    data={
                        "member": user_data,
                        "token": f"google_token_{existing_member.mt_idx}",  # 실제 JWT 토큰으로 교체 필요
                        "is_new_user": False
                    }
                )
            else:
                # 새 사용자 회원가입
                # 이메일로 기존 계정 확인
                email_member = self.crud.get_by_email(db, google_data.email)
                if email_member:
                    # 기존 이메일 계정에 Google ID 연결
                    email_member.mt_google_id = google_data.google_id
                    email_member.mt_type = 4  # Google 로그인으로 변경
                    email_member.mt_map = 'Y'  # Google 지도 사용으로 변경
                    email_member.mt_ldate = datetime.utcnow()  # 로그인 시간 업데이트
                    email_member.mt_adate = datetime.utcnow()  # 최근접속 시간 업데이트
                    if google_data.image and not email_member.mt_file1:
                        email_member.mt_file1 = google_data.image  # 프로필 이미지가 없는 경우에만 업데이트
                    db.commit()
                    db.refresh(email_member)
                    
                    user_data = {
                        "mt_idx": email_member.mt_idx,
                        "mt_type": email_member.mt_type or 1,
                        "mt_level": email_member.mt_level or 2,
                        "mt_status": email_member.mt_status or 1,
                        "mt_id": email_member.mt_id or "",
                        "mt_name": email_member.mt_name or "",
                        "mt_nickname": email_member.mt_nickname or "",
                        "mt_hp": email_member.mt_hp or "",
                        "mt_email": email_member.mt_email or "",
                        "mt_birth": email_member.mt_birth.isoformat() if email_member.mt_birth else "",
                        "mt_gender": email_member.mt_gender or 1,
                        "mt_file1": email_member.mt_file1 or "",
                        "mt_lat": float(email_member.mt_lat) if email_member.mt_lat else 37.5642,
                        "mt_long": float(email_member.mt_long) if email_member.mt_long else 127.0016,
                        "mt_sido": email_member.mt_sido or "",
                        "mt_gu": email_member.mt_gu or "",
                        "mt_dong": email_member.mt_dong or "",
                        "mt_onboarding": email_member.mt_onboarding or 'Y',
                        "mt_push1": email_member.mt_push1 or 'Y',
                        "mt_plan_check": email_member.mt_plan_check or 'N',
                        "mt_plan_date": email_member.mt_plan_date.isoformat() if email_member.mt_plan_date else "",
                        "mt_weather_pop": email_member.mt_weather_pop or "",
                        "mt_weather_sky": email_member.mt_weather_sky or 8,
                        "mt_weather_tmn": email_member.mt_weather_tmn or 18,
                        "mt_weather_tmx": email_member.mt_weather_tmx or 25,
                        "mt_weather_date": email_member.mt_weather_date.isoformat() if email_member.mt_weather_date else datetime.utcnow().isoformat(),
                        "mt_ldate": email_member.mt_ldate.isoformat() if email_member.mt_ldate else datetime.utcnow().isoformat(),
                        "mt_adate": email_member.mt_adate.isoformat() if email_member.mt_adate else datetime.utcnow().isoformat()
                    }

                    return GoogleLoginResponse(
                        success=True,
                        message="기존 계정에 Google 연결 완료",
                        data={
                            "member": user_data,
                            "token": f"google_token_{email_member.mt_idx}",
                            "is_new_user": False
                        }
                    )
                else:
                    # 완전히 새로운 사용자 생성
                    current_time = datetime.utcnow()
                    
                    # 닉네임 중복 확인 및 고유 닉네임 생성
                    base_nickname = google_data.name
                    nickname = base_nickname
                    counter = 1
                    while db.query(Member).filter(Member.mt_nickname == nickname).first():
                        nickname = f"{base_nickname}{counter}"
                        counter += 1
                    
                    new_member = Member(
                        mt_type=4,  # Google 로그인 구분
                        mt_level=2,  # 일반(무료) 회원
                        mt_status=1,  # 정상 상태
                        mt_id=google_data.email,  # 이메일을 ID로 사용
                        mt_pwd=None,  # Google 로그인은 비밀번호 없음
                        mt_pwd_cnt=0,  # 비밀번호 체크 카운터 초기화
                        mt_name=google_data.name,
                        mt_nickname=nickname,  # 고유 닉네임
                        mt_hp=None,  # 전화번호는 나중에 입력
                        mt_email=google_data.email,
                        mt_birth=None,  # 생년월일은 나중에 입력
                        mt_gender=None,  # 성별은 나중에 입력
                        mt_file1=google_data.image or "",
                        mt_show='Y',  # 노출
                        mt_agree1='Y',  # 서비스이용약관 동의 (Google 로그인 시 기본 동의)
                        mt_agree2='Y',  # 개인정보 처리방침 동의
                        mt_agree3='Y',  # 위치기반서비스 이용약관 동의
                        mt_agree4='N',  # 개인정보 제3자 제공 동의 (선택)
                        mt_agree5='N',  # 마케팅 정보 수집 동의 (선택)
                        mt_push1='Y',  # 알림수신 동의
                        mt_lat=None,  # 위치는 나중에 설정
                        mt_long=None,
                        mt_sido=None,
                        mt_gu=None,
                        mt_dong=None,
                        mt_onboarding='N',  # 온보딩 미완료
                        mt_google_id=google_data.google_id,
                        mt_lang='ko',  # 기본 언어
                        mt_map='Y',  # Google 지도 사용
                        mt_recommend_chk='N',  # 추천인 미사용
                        mt_plan_check='N',  # 플랜 구독 안함
                        mt_os_check=0,  # 기본값 (AOS)
                        mt_weather_sky=8,  # 기본 하늘상태
                        mt_weather_tmn=18,  # 기본 최저기온
                        mt_weather_tmx=25,  # 기본 최고기온
                        mt_weather_date=current_time,
                        mt_wdate=current_time,  # 등록일시
                        mt_ldate=current_time,  # 로그인일시
                        mt_adate=current_time,  # 최근접속일시
                        mt_udate=current_time   # 수정일시
                    )
                    
                    db.add(new_member)
                    db.commit()
                    db.refresh(new_member)

                    user_data = {
                        "mt_idx": new_member.mt_idx,
                        "mt_type": new_member.mt_type or 1,
                        "mt_level": new_member.mt_level or 2,
                        "mt_status": new_member.mt_status or 1,
                        "mt_id": new_member.mt_id or "",
                        "mt_name": new_member.mt_name or "",
                        "mt_nickname": new_member.mt_nickname or "",
                        "mt_hp": new_member.mt_hp or "",
                        "mt_email": new_member.mt_email or "",
                        "mt_birth": new_member.mt_birth.isoformat() if new_member.mt_birth else "",
                        "mt_gender": new_member.mt_gender or 1,
                        "mt_file1": new_member.mt_file1 or "",
                        "mt_lat": float(new_member.mt_lat) if new_member.mt_lat else 37.5642,
                        "mt_long": float(new_member.mt_long) if new_member.mt_long else 127.0016,
                        "mt_sido": new_member.mt_sido or "",
                        "mt_gu": new_member.mt_gu or "",
                        "mt_dong": new_member.mt_dong or "",
                        "mt_onboarding": new_member.mt_onboarding or 'Y',
                        "mt_push1": new_member.mt_push1 or 'Y',
                        "mt_plan_check": new_member.mt_plan_check or 'N',
                        "mt_plan_date": new_member.mt_plan_date.isoformat() if new_member.mt_plan_date else "",
                        "mt_weather_pop": new_member.mt_weather_pop or "",
                        "mt_weather_sky": new_member.mt_weather_sky or 8,
                        "mt_weather_tmn": new_member.mt_weather_tmn or 18,
                        "mt_weather_tmx": new_member.mt_weather_tmx or 25,
                        "mt_weather_date": new_member.mt_weather_date.isoformat() if new_member.mt_weather_date else datetime.utcnow().isoformat(),
                        "mt_ldate": new_member.mt_ldate.isoformat() if new_member.mt_ldate else datetime.utcnow().isoformat(),
                        "mt_adate": new_member.mt_adate.isoformat() if new_member.mt_adate else datetime.utcnow().isoformat()
                    }

                    logger.info(f"Google 신규 회원가입: {new_member.mt_email} ({new_member.mt_name})")

                    return GoogleLoginResponse(
                        success=True,
                        message="Google 회원가입 완료",
                        data={
                            "member": user_data,
                            "token": f"google_token_{new_member.mt_idx}",
                            "is_new_user": True
                        }
                    )

        except Exception as e:
            logger.error(f"Google 로그인 실패: {str(e)}")
            return GoogleLoginResponse(
                success=False,
                message="Google 로그인 처리 중 오류가 발생했습니다."
            )

# 서비스 인스턴스 생성
member_service = MemberService() 