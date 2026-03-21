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
    GoogleLoginResponse,
    AppleLoginRequest,
    AppleLoginResponse
)
from app.models.member import Member
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import jwt
from app.core.config import settings

logger = logging.getLogger(__name__)

def create_access_token_for_social(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    """소셜 로그인용 JWT 토큰 생성"""
    to_encode = {"sub": str(user_id)}
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

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

            # 3. 닉네임 중복 확인 (비활성화 - 중복 닉네임 허용)
            # existing_nickname = db.query(Member).filter(
            #     Member.mt_nickname == register_data.mt_nickname
            # ).first()
            # if existing_nickname:
            #     return RegisterResponse(
            #         success=False,
            #         message="이미 사용 중인 닉네임입니다."
            #     )

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
            # 1. 이메일로 기존 사용자 우선 확인 (이메일 기반 조회 우선)
            existing_member = None
            is_new_user = True
            lookup_method = "none"
            
            logger.info(f"🔍 Google 로그인 시작 - email: {google_data.email}, google_id: {google_data.google_id}")

            # 필수 데이터 검증
            if not google_data.google_id and not google_data.email:
                logger.error("❌ Google 로그인: google_id와 email이 모두 없음")
                return GoogleLoginResponse(
                    success=False,
                    message="Google ID 또는 이메일이 필요합니다."
                )

            # 이메일로 기존 사용자 조회 (우선순위 1)
            if google_data.email:
                existing_member = self.crud.get_by_email(db, google_data.email)
                if existing_member:
                    logger.info(f"✅ 이메일로 기존 사용자 발견 - mt_idx: {existing_member.mt_idx}, email: {existing_member.mt_email}")
                    is_new_user = False
                    lookup_method = "email"

                    # Google ID가 없는 경우 추가
                    if google_data.google_id and not existing_member.mt_google_id:
                        existing_member.mt_google_id = google_data.google_id
                        existing_member.mt_type = 4  # Google 로그인 타입
                        db.commit()
                        logger.info(f"🔗 기존 사용자에 Google ID 연결 완료")

            # Google ID로 사용자 조회 (우선순위 2)
            if not existing_member and google_data.google_id:
                existing_member = db.query(Member).filter(Member.mt_google_id == google_data.google_id).first()
                if existing_member:
                    logger.info(f"✅ Google ID로 기존 사용자 발견 - mt_idx: {existing_member.mt_idx}")
                    is_new_user = False
                    lookup_method = "google_id"
            
            if existing_member:
                # 기존 사용자 로그인 처리
                logger.info(f"👤 기존 사용자 로그인 처리 시작 - mt_idx: {existing_member.mt_idx}")
                
                # 계정 상태 확인
                if not self.crud.is_active(existing_member):
                    return GoogleLoginResponse(
                        success=False,
                        message="비활성화된 계정입니다. 고객센터에 문의해주세요."
                    )

                # 로그인 시간 업데이트
                self.crud.update_login_time(db, user=existing_member)
                
                # 프로필 이미지 업데이트 (없는 경우만)
                if google_data.image and not existing_member.mt_file1:
                    existing_member.mt_file1 = google_data.image
                    db.commit()

                # 🔥 기존 사용자의 관련 데이터 자동 조회
                additional_data = self._get_user_additional_data(db, existing_member.mt_idx)
                
                # 사용자 기본 정보 구성
                user_data = self._build_user_data(existing_member)
                
                logger.info(f"✅ 기존 사용자 로그인 성공 - mt_idx: {existing_member.mt_idx}")

                return GoogleLoginResponse(
                    success=True,
                    message="Google 로그인 성공",
                    data={
                        "member": user_data,
                        "user": user_data,  # 호환성을 위해 추가
                        "token": create_access_token_for_social(existing_member.mt_idx),
                        "is_new_user": False,
                        "isNewUser": False,  # 호환성을 위해 추가
                        "lookup_method": lookup_method,
                        # 🔥 추가 데이터 포함
                        "groups": additional_data.get("groups", []),
                        "recent_schedules": additional_data.get("recent_schedules", []),
                        "group_count": additional_data.get("group_count", 0),
                        "schedule_count": additional_data.get("schedule_count", 0),
                        "has_data": additional_data.get("has_data", False)
                    }
                )
            
            else:
                # 새 사용자 - 회원가입 필요 (DB에 저장하지 않고 isNewUser=true만 반환)
                # 실제 사용자 생성은 회원가입 완료 API(/api/auth/register)에서 처리
                logger.info(f"👤 새 사용자 발견 - 회원가입 필요 (아직 DB에 저장하지 않음)")

                # 프론트엔드에서 사용할 임시 사용자 정보 (DB 저장 없음)
                temp_user_data = {
                    "mt_idx": None,  # 아직 생성되지 않음
                    "mt_id": f"google_{google_data.google_id}",
                    "mt_name": google_data.name or google_data.given_name or "",
                    "mt_nickname": google_data.given_name or google_data.name or "",
                    "mt_email": google_data.email,
                    "mt_google_id": google_data.google_id,
                    "mt_type": 4,  # Google 로그인
                    "mt_level": 2,  # 일반 회원
                    "mt_file1": google_data.image or "",
                }
                
                logger.info(f"✅ 신규 사용자 정보 반환 (DB 저장 없음) - email: {google_data.email}")
                
                return GoogleLoginResponse(
                    success=True,
                    message="신규 사용자입니다. 회원가입이 필요합니다.",
                    data={
                        "member": temp_user_data,
                        "user": temp_user_data,
                        "token": None,  # 신규 사용자는 토큰 없음
                        "is_new_user": True,
                        "isNewUser": True,
                        "lookup_method": "new_user",
                        # 새 사용자는 빈 데이터
                        "groups": [],
                        "recent_schedules": [],
                        "group_count": 0,
                        "schedule_count": 0,
                        "has_data": False,
                        "needs_onboarding": True
                    }
                )

        except Exception as e:
            logger.error(f"Google 로그인 실패: {str(e)}")
            return GoogleLoginResponse(
                success=False,
                message="Google 로그인 처리 중 오류가 발생했습니다."
            )

    def apple_login(self, db: Session, apple_data: AppleLoginRequest) -> AppleLoginResponse:
        """Apple 로그인 처리"""
        try:
            # 1. Apple ID로 기존 사용자 우선 확인
            existing_member = None
            is_new_user = True
            lookup_method = "none"
            
            logger.info(f"🔍 Apple 로그인 시작 - userIdentifier: {apple_data.userIdentifier}, email: {apple_data.email}")

            # Apple ID로 사용자 조회 (우선순위 1)
            existing_member = db.query(Member).filter(Member.mt_apple_id == apple_data.userIdentifier).first()
            if existing_member:
                logger.info(f"✅ Apple ID로 기존 사용자 발견 - mt_idx: {existing_member.mt_idx}")
                is_new_user = False
                lookup_method = "apple_id"
            
            # 이메일로 기존 사용자 조회 (우선순위 2)
            if not existing_member and apple_data.email:
                existing_member = self.crud.get_by_email(db, apple_data.email)
                if existing_member:
                    logger.info(f"✅ 이메일로 기존 사용자 발견 - mt_idx: {existing_member.mt_idx}, email: {existing_member.mt_email}")
                    is_new_user = False
                    lookup_method = "email"

                    # Apple ID 연결
                    existing_member.mt_apple_id = apple_data.userIdentifier
                    existing_member.mt_type = 5  # Apple 로그인 타입 (임의 지정, 프로젝트 규칙에 따라 조정 가능)
                    db.commit()
                    logger.info(f"🔗 기존 사용자에 Apple ID 연결 완료")

            if existing_member:
                # 기존 사용자 로그인 처리
                if not self.crud.is_active(existing_member):
                    return AppleLoginResponse(
                        success=False,
                        message="비활성화된 계정입니다. 고객센터에 문의해주세요."
                    )

                # 로그인 시간 업데이트
                self.crud.update_login_time(db, user=existing_member)
                
                # 추가 데이터 조회
                additional_data = self._get_user_additional_data(db, existing_member.mt_idx)
                
                # 사용자 기본 정보 구성
                user_data = self._build_user_data(existing_member)
                # mt_type 업데이트 (반환용)
                user_data["mt_type"] = existing_member.mt_type or 5
                
                logger.info(f"✅ 기존 사용자 로그인 성공 - mt_idx: {existing_member.mt_idx}")

                return AppleLoginResponse(
                    success=True,
                    message="Apple 로그인 성공",
                    data={
                        "member": user_data,
                        "user": user_data,
                        "token": create_access_token_for_social(existing_member.mt_idx),
                        "is_new_user": False,
                        "isNewUser": False,
                        "lookup_method": lookup_method,
                        "groups": additional_data.get("groups", []),
                        "recent_schedules": additional_data.get("recent_schedules", []),
                        "group_count": additional_data.get("group_count", 0),
                        "schedule_count": additional_data.get("schedule_count", 0),
                        "has_data": additional_data.get("has_data", False)
                    }
                )
            
            else:
                # 새 사용자 - 회원가입 필요
                logger.info(f"👤 새 사용자 발견 - 회원가입 필요")

                temp_user_data = {
                    "mt_idx": None,
                    "mt_id": f"apple_{apple_data.userIdentifier[:10]}",
                    "mt_name": apple_data.userName or "",
                    "mt_nickname": apple_data.userName or "",
                    "mt_email": apple_data.email,
                    "mt_apple_id": apple_data.userIdentifier,
                    "mt_type": 5,
                }
                
                return AppleLoginResponse(
                    success=True,
                    message="신규 사용자입니다. 회원가입이 필요합니다.",
                    data={
                        "member": temp_user_data,
                        "user": temp_user_data,
                        "token": None,
                        "is_new_user": True,
                        "isNewUser": True,
                        "lookup_method": "new_user",
                        "groups": [],
                        "recent_schedules": [],
                        "group_count": 0,
                        "schedule_count": 0,
                        "has_data": False,
                        "needs_onboarding": True
                    }
                )

        except Exception as e:
            logger.error(f"Apple 로그인 실패: {str(e)}")
            return AppleLoginResponse(
                success=False,
                message="Apple 로그인 처리 중 오류가 발생했습니다."
            )

    def _get_user_additional_data(self, db: Session, mt_idx: int) -> dict:
        """사용자의 추가 데이터를 조회합니다 (그룹, 스케줄 등)"""
        try:
            from sqlalchemy import text, func
            from datetime import datetime, timedelta
            
            logger.info(f"📊 사용자 추가 데이터 조회 시작 - mt_idx: {mt_idx}")
            
            # 1. 사용자가 속한 그룹 목록 조회
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
            
            groups_result = db.execute(groups_query, {"mt_idx": mt_idx}).fetchall()
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
            
            # 2. 최근 7일간의 스케줄 조회
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
                "mt_idx": mt_idx,
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
            
            # 3. 통계 정보
            group_count = len(groups)
            schedule_count = len(recent_schedules)
            has_data = group_count > 0 or schedule_count > 0
            
            logger.info(f"📊 추가 데이터 조회 완료 - 그룹: {group_count}개, 스케줄: {schedule_count}개")
            
            return {
                "groups": groups,
                "recent_schedules": recent_schedules,
                "group_count": group_count,
                "schedule_count": schedule_count,
                "has_data": has_data
            }
            
        except Exception as e:
            logger.error(f"사용자 추가 데이터 조회 실패: {str(e)}")
            return {
                "groups": [],
                "recent_schedules": [],
                "group_count": 0,
                "schedule_count": 0,
                "has_data": False
            }

    def _build_user_data(self, member: Member) -> dict:
        """사용자 데이터를 표준 형식으로 구성합니다"""
        return {
            "mt_idx": member.mt_idx,
            "mt_type": member.mt_type or 4,
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
            "mt_onboarding": member.mt_onboarding or 'N',
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
            "mt_adate": member.mt_adate.isoformat() if member.mt_adate else datetime.utcnow().isoformat(),
            "mt_google_id": member.mt_google_id
        }

# 서비스 인스턴스 생성
member_service = MemberService() 