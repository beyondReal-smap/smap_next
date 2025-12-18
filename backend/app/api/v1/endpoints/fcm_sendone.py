from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.models.push_log import PushLog
from app.schemas.fcm_notification import FCMSendRequest, FCMSendResponse
from app.services.firebase_service import firebase_service
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import logging
import firebase_admin
from firebase_admin import messaging

logger = logging.getLogger(__name__)

router = APIRouter()

SUCCESS = "true"
FAILURE = "false"

# 백그라운드 푸시 요청 모델
class BackgroundPushRequest(BaseModel):
    plt_type: str
    sst_idx: str
    plt_condition: str
    plt_memo: str
    mt_idx: int
    plt_title: str
    plt_content: str
    content_available: bool = True  # 백그라운드 푸시를 위한 플래그
    priority: str = "normal"  # high 또는 normal
    show_notification: bool = False  # 백그라운드 푸시에서는 기본적으로 알림 표시하지 않음
    event_url: Optional[str] = None  # 이벤트 URL
    schedule_id: Optional[str] = None  # 일정 ID

# Silent Push 요청 모델 (FCM 토큰 유지용)
class SilentPushRequest(BaseModel):
    mt_idx: int
    reason: str = "token_refresh"  # silent push 이유
    priority: str = "low"  # silent push는 낮은 우선순위

def create_response(success: str, title: str, message: str, data=None) -> dict:
    """응답 생성 헬퍼 함수"""
    return {
        "success": success,
        "title": title,
        "message": message,
        "data": data
    }

def create_push_log(args: dict, mt_idx: int, status: int, db: Session) -> PushLog:
    """푸시 로그 생성 헬퍼 함수"""
    now = datetime.now()
    push_log = PushLog(
        plt_type=args['plt_type'],
        mt_idx=mt_idx,
        sst_idx=args['sst_idx'],
        plt_condition=args['plt_condition'],
        plt_memo=args['plt_memo'],
        plt_title=args['plt_title'],
        plt_content=args['plt_content'],
        plt_sdate=now,
        plt_status=status,
        plt_read_chk='N',
        plt_show='Y',
        plt_wdate=now
    )
    return push_log

@router.post("/", response_model=FCMSendResponse)
def send_fcm_push_notification(
    request: FCMSendRequest,
    db: Session = Depends(deps.get_db)
):
    """
    FCM 푸시 알림 단건 전송
    
    Args:
        request: FCM 푸시 알림 전송 요청 데이터
        db: 데이터베이스 세션
    
    Returns:
        FCMSendResponse: 전송 결과
    """
    try:
        logger.debug("푸시 발송 요청 파라미터 파싱 중")
        args = request.dict()
        logger.debug(f"파싱된 파라미터: {args}")

        logger.debug("회원 정보 조회 중")
        # mt_idx로 회원 조회
        member = Member.find_by_idx(db, args['mt_idx'])
        
        logger.debug(f"조회된 회원 정보: {member}")

        if not member:
            logger.debug("존재하지 않는 회원 인덱스로 푸시 발송 실패")
            return create_response(
                FAILURE, 
                "푸시발송(단건) 실패", 
                "존재하지 않는 회원입니다."
            )

        if not member.mt_token_id:
            logger.debug("앱 토큰이 존재하지 않아 푸시 발송 실패")
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨
            return create_response(
                FAILURE,
                "푸시발송(단건) 실패",
                "앱토큰이 존재하지 않습니다."
            )

        # FCM 토큰 만료 여부 확인 (임시로 90일로 연장)
        now = datetime.now()
        if member.mt_token_expiry_date and now > member.mt_token_expiry_date:
            logger.warning(f"FCM 토큰이 만료됨 - 회원 ID: {member.mt_idx}, 만료일: {member.mt_token_expiry_date}")

            # 임시로 토큰 만료일을 90일 연장
            member.mt_token_expiry_date = now + timedelta(days=90)
            db.commit()
            logger.info(f"FCM 토큰 만료일 90일 연장 - 회원 ID: {member.mt_idx}")

            # 토큰 만료 검증 계속 진행
            # return create_response(
            #     FAILURE,
            #     "푸시발송(단건) 실패",
            #     "FCM 토큰이 만료되었습니다. 앱을 재시작하여 토큰을 갱신해주세요."
            # )

        # mt_token_id 상태 모니터링 (삭제 현상 추적)
        if not member.mt_token_id:
            logger.error(f"🚨 FCM 전송 시 mt_token_id 없음: 회원 {member.mt_idx}의 토큰이 사라짐")
        else:
            logger.info(f"✅ FCM 전송 시 mt_token_id 확인: 회원 {member.mt_idx} 토큰 정상 (길이: {len(member.mt_token_id)})")

        # FCM 토큰이 80일 이상 업데이트되지 않은 경우 경고 로그 (90일 만료에 맞게 조정)
        if member.mt_token_updated_at and (now - member.mt_token_updated_at).days >= 80:
            logger.warning(f"FCM 토큰이 80일 이상 업데이트되지 않음 - 회원 ID: {member.mt_idx}, 마지막 업데이트: {member.mt_token_updated_at}")

        # Firebase 사용 가능 여부 확인
        if not firebase_service.is_available():
            logger.debug("Firebase가 사용 불가능하여 푸시 발송 실패")
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨
            return create_response(
                FAILURE, 
                "푸시발송(단건) 실패", 
                "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요."
            )

        # FCM 토큰 최종 검증 (개선된 버전)
        if not member.mt_token_id or len(str(member.mt_token_id).strip()) == 0:
            logger.warning(f"🚨 [FCM] 토큰이 비어있음 - 회원: {member.mt_idx}")
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨
            return create_response(
                FAILURE,
                "푸시발송(단건) 실패 - 토큰 없음",
                "FCM 토큰이 존재하지 않습니다. 앱을 재시작하여 새로운 토큰을 받아주세요."
            )
    
        # FCM 토큰 형식 검증 (서버 레벨에서 한 번 더 검증)
        if not firebase_service._validate_fcm_token(member.mt_token_id):
            logger.warning(f"🚨 [FCM] 잘못된 토큰 형식 - 회원: {member.mt_idx}, 토큰: {member.mt_token_id[:50]}...")
            
            # 잘못된 토큰 즉시 무효화
            try:
                firebase_service._handle_token_invalidation(
                    member.mt_token_id,
                    "invalid_token_format_sendone",
                    args.get('plt_title'),
                    args.get('plt_content')
                )
            except Exception as cleanup_error:
                logger.error(f"❌ [FCM] 토큰 무효화 처리 실패: {cleanup_error}")
            
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨
            return create_response(
                FAILURE,
                "푸시발송(단건) 실패 - 잘못된 토큰",
                "FCM 토큰 형식이 올바르지 않습니다. 앱을 재시작하여 새로운 토큰을 받아주세요."
            )

        logger.info(f"📤 [FCM] 푸시 메시지 전송 시작 - 회원: {member.mt_idx}")
        logger.debug(f"📤 [FCM] 토큰: {member.mt_token_id[:30]}...")
        logger.debug(f"📤 [FCM] 제목: {args['plt_title']}")
        logger.debug(f"📤 [FCM] 내용: {args['plt_content'][:50]}...")

        try:
            # iOS 기기인지 확인하여 최적화된 전송 방식 선택
            # 1. 우선 데이터베이스의 OS 정보 사용 (mt_os_check: 0=android, 1=ios)
            db_os_check = member.mt_os_check if hasattr(member, 'mt_os_check') else None
            is_ios_from_db = db_os_check == 1

            # 2. User-Agent 정보 확인 (요청에 포함된 경우)
            user_agent_raw = args.get('user_agent', '')
            user_agent = user_agent_raw.lower() if user_agent_raw else ''
            is_ios_from_ua = 'ios' in user_agent or 'iphone' in user_agent or 'ipad' in user_agent

            # 3. 최종 iOS 감지 로직 (DB 우선, UA 보조)
            is_ios_device = is_ios_from_db or is_ios_from_ua

            logger.info(f"📱 [FCM] DB OS 체크: {db_os_check} (0=Android, 1=iOS)")
            logger.info(f"📱 [FCM] User-Agent: '{user_agent}'")
            logger.info(f"📱 [FCM] DB 기반 iOS 감지: {is_ios_from_db}")
            logger.info(f"📱 [FCM] UA 기반 iOS 감지: {is_ios_from_ua}")
            logger.info(f"📱 [FCM] 최종 iOS 감지: {is_ios_device}")

            # FCM 토큰 존재 여부 확인
            if not member.mt_token_id or member.mt_token_id.strip() == "":
                logger.warning(f"🚨 [FCM] FCM 토큰이 없음 - 회원: {member.mt_idx}, 건너뜀")
                # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
                # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨
                return create_response(
                    FAILURE,
                    "푸시발송(단건) 실패",
                    "FCM 토큰이 존재하지 않습니다."
                )

            response = firebase_service.send_push_notification(
                member.mt_token_id,
                args['plt_title'],
                args['plt_content'],
                member_id=member.mt_idx
            )

            logger.info(f"✅ [FCM] Firebase 전송 성공 - 응답: {response}")
            logger.debug(f"📊 [FCM] 메시지 ID: {response}")
            
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨

            logger.debug("푸시 발송 성공")
            return create_response(
                SUCCESS, 
                "푸시발송(단건) 성공", 
                "푸시발송(단건) 성공했습니다."
            )
            
        except messaging.UnregisteredError as firebase_error:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            logger.warning(f"🚨 [FCM POLICY 4] 일반 푸시에서 비활성 토큰 감지: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 삭제 처리됨: {firebase_error}")

            # 토큰 무효화 처리 - 즉시 DB에서 제거
            try:
                firebase_service._handle_token_invalidation(
                    member.mt_token_id,
                    "unregistered_from_sendone",
                    args.get('plt_title'),
                    args.get('plt_content')
                )
                logger.info(f"✅ [FCM TOKEN CLEANUP] 토큰 무효화 처리 완료 - 사용자: {member.mt_idx}")
            except Exception as cleanup_error:
                logger.error(f"❌ [FCM TOKEN CLEANUP] 토큰 무효화 처리 실패: {cleanup_error}")

            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨

            return create_response(
                FAILURE,
                "푸시발송(단건) 실패 - 토큰 만료",
                "FCM 토큰이 만료되었습니다. 앱을 완전히 종료하고 재시작하여 새로운 토큰을 받아주세요."
            )

        except messaging.ThirdPartyAuthError as firebase_error:
            logger.warning(f"🚨 [FCM POLICY 4] 일반 푸시에서 잘못된 토큰 형식: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식 오류: {firebase_error}")

            # 토큰 무효화 처리 - 즉시 DB에서 제거
            try:
                firebase_service._handle_token_invalidation(
                    member.mt_token_id,
                    "third_party_auth_error_from_sendone",
                    args.get('plt_title'),
                    args.get('plt_content')
                )
                logger.info(f"✅ [FCM TOKEN CLEANUP] ThirdPartyAuthError 토큰 무효화 처리 완료 - 사용자: {member.mt_idx}")
            except Exception as cleanup_error:
                logger.error(f"❌ [FCM TOKEN CLEANUP] ThirdPartyAuthError 토큰 무효화 처리 실패: {cleanup_error}")

            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨

            return create_response(
                FAILURE,
                "푸시발송(단건) 실패 - 잘못된 토큰",
                "FCM 토큰 형식이 잘못되었습니다. 앱을 완전히 종료하고 재시작하여 새로운 토큰을 받아주세요."
            )

        except Exception as firebase_error:
            logger.error(f"❌ [FCM] Firebase 푸시 전송 실패: {firebase_error}")
            logger.error(f"❌ [FCM] 에러 타입: {type(firebase_error)}")
            
            # 에러 타입에 따른 상세 로깅
            error_type = type(firebase_error).__name__
            if "messaging" in str(type(firebase_error)).lower():
                logger.error(f"❌ [FCM] Firebase Messaging 관련 에러: {firebase_error}")
                
                # 토큰 관련 에러인지 확인
                if any(keyword in str(firebase_error).lower() for keyword in ['token', 'registration', 'unregistered']):
                    logger.warning(f"🚨 [FCM] 토큰 관련 에러 감지 - 토큰 무효화 고려")
                    try:
                        firebase_service._handle_token_invalidation(
                            member.mt_token_id,
                            f"firebase_error_{error_type}",
                            args.get('plt_title'),
                            args.get('plt_content')
                        )
                    except Exception as cleanup_error:
                        logger.error(f"❌ [FCM] 토큰 무효화 처리 실패: {cleanup_error}")
            
            # 푸시 로그는 호출하는 쪽에서 저장하므로 여기서는 저장하지 않음 (중복 방지)
            # push_log는 호출하는 쪽에서 push_log_add를 통해 저장됨

            # 사용자 친화적인 에러 메시지
            user_message = "푸시 메시지 전송에 실패했습니다."
            if "token" in str(firebase_error).lower():
                user_message += " 앱을 재시작하여 새로운 토큰을 받아주세요."
            elif "network" in str(firebase_error).lower():
                user_message += " 네트워크 연결을 확인해주세요."
            else:
                user_message += " 잠시 후 다시 시도해주세요."

            return create_response(
                FAILURE,
                "푸시발송(단건) 실패",
                user_message
            )

    except Exception as e:
        logger.error(f"푸시 발송 중 오류 발생: {str(e)}")
        return create_response(
            FAILURE, 
            "푸시발송(단건) 실패", 
            str(e)
        )

@router.post("/background", response_model=FCMSendResponse)
def send_background_fcm_push_notification(
    request: BackgroundPushRequest,
    db: Session = Depends(deps.get_db)
):
    """
    백그라운드 FCM 푸시 알림 단건 전송
    앱이 백그라운드나 종료된 상태에서도 데이터를 처리할 수 있도록 함

    Args:
        request: 백그라운드 FCM 푸시 알림 전송 요청 데이터
        db: 데이터베이스 세션

    Returns:
        FCMSendResponse: 전송 결과
    """
    try:
        logger.debug("백그라운드 푸시 발송 요청 파라미터 파싱 중")
        args = request.dict()
        logger.debug(f"파싱된 파라미터: {args}")

        logger.debug("회원 정보 조회 중")
        # mt_idx로 회원 조회
        member = Member.find_by_idx(db, args['mt_idx'])

        logger.debug(f"조회된 회원 정보: {member}")

        if not member:
            logger.debug("존재하지 않는 회원 인덱스로 백그라운드 푸시 발송 실패")
            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패",
                "존재하지 않는 회원입니다."
            )

        if not member.mt_token_id:
            logger.debug("앱 토큰이 존재하지 않아 백그라운드 푸시 발송 실패")
            # 상태 4: 토큰 없음
            push_log = create_push_log(args, member.mt_idx, 4, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패",
                "앱토큰이 존재하지 않습니다."
            )

        # Firebase 사용 가능 여부 확인
        if not firebase_service.is_available():
            logger.debug("Firebase가 사용 불가능하여 백그라운드 푸시 발송 실패")
            # 상태 5: Firebase 사용 불가
            push_log = create_push_log(args, member.mt_idx, 5, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패",
                "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요."
            )

        logger.debug("백그라운드 푸시 메시지 전송 중")
        try:
            response = firebase_service.send_background_push_notification(
                member.mt_token_id,
                args['plt_title'],
                args['plt_content'],
                args.get('content_available', True),
                'high',  # 백그라운드 푸시에서도 항상 최고 우선순위로 설정
                args.get('event_url'),
                args.get('schedule_id')
            )
            logger.debug(f"Firebase 백그라운드 푸시 응답: {response}")

            # 상태 2: 전송 성공
            push_log = create_push_log(args, member.mt_idx, 2, db)
            db.add(push_log)
            db.commit()

            logger.debug("백그라운드 푸시 발송 성공")
            return create_response(
                SUCCESS,
                "백그라운드 푸시발송 성공",
                "백그라운드 푸시발송 성공했습니다."
            )

        except messaging.UnregisteredError as firebase_error:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            logger.warning(f"🚨 [FCM POLICY 4] 백그라운드 푸시에서 비활성 토큰 감지: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 삭제 처리됨: {firebase_error}")

            # 상태 6: 백그라운드 푸시 토큰 만료
            push_log = create_push_log(args, member.mt_idx, 6, db)
            db.add(push_log)
            db.commit()

            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패 - 토큰 만료",
                "FCM 토큰이 만료되었습니다. 앱 재시작으로 토큰을 갱신해주세요."
            )

        except messaging.InvalidArgumentError as firebase_error:
            logger.warning(f"🚨 [FCM POLICY 4] 백그라운드 푸시에서 잘못된 토큰 형식: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식 오류: {firebase_error}")

            # 상태 7: 백그라운드 푸시 토큰 형식 오류
            push_log = create_push_log(args, member.mt_idx, 7, db)
            db.add(push_log)
            db.commit()

            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패 - 잘못된 토큰",
                "FCM 토큰 형식이 잘못되었습니다. 앱 재시작으로 토큰을 갱신해주세요."
            )

        except Exception as firebase_error:
            logger.error(f"❌ [FCM POLICY 4] Firebase 백그라운드 푸시 전송 실패: {firebase_error}")
            # 상태 3: 전송 실패
            push_log = create_push_log(args, member.mt_idx, 3, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE,
                "백그라운드 푸시발송 실패",
                f"Firebase 전송 실패: {str(firebase_error)}"
            )

    except Exception as e:
        logger.error(f"백그라운드 푸시 발송 중 오류 발생: {str(e)}")
        return create_response(
            FAILURE,
            "백그라운드 푸시발송 실패",
            str(e)
        )

@router.post("/silent-batch", response_model=FCMSendResponse)
def send_silent_push_to_all_users(
    db: Session = Depends(deps.get_db)
):
    """
    모든 FCM 토큰 보유 사용자에게 Silent 푸시 전송
    백그라운드 앱이 푸시 수신 상태를 유지하도록 함

    Returns:
        FCMSendResponse: 전송 결과
    """
    try:
        logger.info("모든 사용자에게 Silent 푸시 발송 시작")

        # FCM 토큰이 있는 모든 사용자 조회
        members = Member.get_token_list(db)
        logger.info(f"FCM 토큰 보유 사용자 수: {len(members)}")

        success_count = 0
        fail_count = 0

        for member in members:
            try:
                # 각 사용자에게 silent push 전송
                response = firebase_service.send_silent_push_notification(
                    member.mt_token_id,
                    "batch_token_refresh",
                    "low"
                )
                success_count += 1
                logger.debug(f"Silent 푸시 전송 성공 - mt_idx: {member.mt_idx}")

            except Exception as e:
                fail_count += 1
                logger.error(f"Silent 푸시 전송 실패 - mt_idx: {member.mt_idx}, error: {str(e)}")

        logger.info(f"Silent 푸시 배치 전송 완료 - 성공: {success_count}, 실패: {fail_count}")

        return create_response(
            SUCCESS,
            "Silent 푸시 배치 전송",
            f"총 {len(members)}명 중 {success_count}명에게 성공적으로 전송했습니다."
        )

    except Exception as e:
        logger.error(f"Silent 푸시 배치 전송 중 오류 발생: {str(e)}")
        return create_response(
            FAILURE,
            "Silent 푸시 배치 전송 실패",
            str(e)
        )


@router.post("/silent", response_model=FCMSendResponse)
def send_silent_fcm_push_notification(
    request: SilentPushRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Silent FCM 푸시 알림 전송 (FCM 토큰 유지용)
    앱이 백그라운드에 오래 있어도 푸시 수신이 가능하도록 유지

    Args:
        request: Silent FCM 푸시 알림 전송 요청 데이터
        db: 데이터베이스 세션

    Returns:
        FCMSendResponse: 전송 결과
    """
    try:
        logger.debug("Silent 푸시 발송 요청 파라미터 파싱 중")
        args = request.dict()
        logger.debug(f"파싱된 파라미터: {args}")

        logger.debug("회원 정보 조회 중")
        # mt_idx로 회원 조회
        member = Member.find_by_idx(db, args['mt_idx'])

        logger.debug(f"조회된 회원 정보: {member}")

        if not member:
            logger.debug("존재하지 않는 회원 인덱스로 silent 푸시 발송 실패")
            return create_response(
                FAILURE,
                "Silent 푸시발송 실패",
                "존재하지 않는 회원입니다."
            )

        if not member.mt_token_id:
            logger.debug("앱 토큰이 존재하지 않아 silent 푸시 발송 실패")
            return create_response(
                FAILURE,
                "Silent 푸시발송 실패",
                "앱토큰이 존재하지 않습니다."
            )

        # Firebase 사용 가능 여부 확인
        if not firebase_service.is_available():
            logger.debug("Firebase가 사용 불가능하여 silent 푸시 발송 실패")
            return create_response(
                FAILURE,
                "Silent 푸시발송 실패",
                "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요."
            )

        logger.debug("Silent FCM 메시지 전송 중")
        try:
            response = firebase_service.send_silent_push_notification(
                member.mt_token_id,
                args.get('reason', 'token_refresh'),
                'high'  # 무조건 high로 설정하여 푸시 수신 보장
            )
            logger.debug(f"Firebase Silent 푸시 응답: {response}")

            logger.debug("Silent 푸시 발송 성공")
            return create_response(
                SUCCESS,
                "Silent 푸시발송 성공",
                "Silent 푸시발송 성공했습니다."
            )

        except firebase_admin.messaging.UnregisteredError as firebase_error:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            logger.warning(f"🚨 [FCM POLICY 4] Silent 푸시에서 비활성 토큰 감지: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 삭제 처리됨: {firebase_error}")

            # 클라이언트에 토큰 만료 알림
            return create_response(
                FAILURE,
                "Silent 푸시발송 실패 - 토큰 만료",
                "FCM 토큰이 만료되었습니다. 앱 재시작으로 토큰을 갱신해주세요."
            )

        except firebase_admin.messaging.InvalidArgumentError as firebase_error:
            logger.warning(f"🚨 [FCM POLICY 4] Silent 푸시에서 잘못된 토큰 형식: {member.mt_token_id[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식 오류: {firebase_error}")

            return create_response(
                FAILURE,
                "Silent 푸시발송 실패 - 잘못된 토큰",
                "FCM 토큰 형식이 잘못되었습니다. 앱 재시작으로 토큰을 갱신해주세요."
            )

        except Exception as firebase_error:
            logger.error(f"❌ [FCM POLICY 4] Firebase Silent 푸시 전송 실패: {firebase_error}")
            return create_response(
                FAILURE,
                "Silent 푸시발송 실패",
                f"Firebase 전송 실패: {str(firebase_error)}"
            )

    except Exception as e:
        logger.error(f"Silent 푸시 발송 중 오류 발생: {str(e)}")
        return create_response(
            FAILURE,
            "Silent 푸시발송 실패",
            str(e)
        )


@router.post("/test", response_model=FCMSendResponse)
def test_fcm_push_notification(
    request: FCMSendRequest,
    db: Session = Depends(deps.get_db)
):
    """
    FCM 푸시 알림 테스트 엔드포인트
    실제 전송 없이 파라미터만 검증
    """
    args = request.dict()
    return create_response(
        SUCCESS,
        "푸시발송(단건) 성공",
        "푸시발송(단건) 성공했습니다.",
        args
    )

@router.post("/test-send/{mt_idx}", response_model=FCMSendResponse)
def test_send_fcm_push_to_user(
    mt_idx: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 사용자에게 테스트 FCM 푸시 알림 전송
    실제 푸시 전송을 테스트하기 위한 용도
    """
    try:
        logger.info(f"테스트 푸시 전송 요청 - 회원 ID: {mt_idx}")

        # 회원 조회
        member = Member.find_by_idx(db, mt_idx)
        if not member:
            return create_response(
                FAILURE,
                "테스트 푸시 실패",
                "존재하지 않는 회원입니다."
            )

        if not member.mt_token_id:
            return create_response(
                FAILURE,
                "테스트 푸시 실패",
                "FCM 토큰이 등록되지 않았습니다."
            )

        # Firebase 사용 가능 여부 확인
        if not firebase_service.is_available():
            return create_response(
                FAILURE,
                "테스트 푸시 실패",
                "Firebase 서비스가 사용 불가능합니다."
            )

        # 테스트 푸시 메시지 생성 (시간 포함)
        current_time = datetime.now()
        test_title = "🧪 푸시 테스트 알림"
        test_content = f"테스트 푸시 알림입니다. 수신 시간: {current_time.strftime('%Y-%m-%d %H:%M:%S')} | 회원 ID: {mt_idx}"

        # FCM 푸시 전송
        response = firebase_service.send_push_notification(
            member.mt_token_id,
            test_title,
            test_content,
            member_id=member.mt_idx
        )

        logger.info(f"테스트 푸시 전송 성공 - 회원 ID: {mt_idx}, FCM 응답: {response}")

        return create_response(
            SUCCESS,
            "테스트 푸시 전송 성공",
            f"테스트 푸시가 성공적으로 전송되었습니다. (응답: {response})"
        )

    except Exception as e:
        logger.error(f"테스트 푸시 전송 중 오류 발생: {str(e)}")
        return create_response(
            FAILURE,
            "테스트 푸시 실패",
            f"테스트 푸시 전송 중 오류가 발생했습니다: {str(e)}"
        ) 