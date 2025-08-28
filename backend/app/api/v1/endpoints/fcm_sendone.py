from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.models.push_log import PushLog
from app.schemas.fcm_notification import FCMSendRequest, FCMSendResponse
from app.services.firebase_service import firebase_service
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import logging

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
            # 상태 4: 토큰 없음
            push_log = create_push_log(args, member.mt_idx, 4, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE,
                "푸시발송(단건) 실패",
                "앱토큰이 존재하지 않습니다."
            )

        # FCM 토큰 만료 여부 확인
        now = datetime.now()
        if member.mt_token_expiry_date and now > member.mt_token_expiry_date:
            logger.warning(f"FCM 토큰이 만료됨 - 회원 ID: {member.mt_idx}, 만료일: {member.mt_token_expiry_date}")
            # 상태 6: 토큰 만료
            push_log = create_push_log(args, member.mt_idx, 6, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE,
                "푸시발송(단건) 실패",
                "FCM 토큰이 만료되었습니다. 앱을 재시작하여 토큰을 갱신해주세요."
            )

        # FCM 토큰이 3일 이상 업데이트되지 않은 경우 경고 로그
        if member.mt_token_updated_at and (now - member.mt_token_updated_at).days >= 3:
            logger.warning(f"FCM 토큰이 3일 이상 업데이트되지 않음 - 회원 ID: {member.mt_idx}, 마지막 업데이트: {member.mt_token_updated_at}")

        # Firebase 사용 가능 여부 확인
        if not firebase_service.is_available():
            logger.debug("Firebase가 사용 불가능하여 푸시 발송 실패")
            # 상태 5: Firebase 사용 불가
            push_log = create_push_log(args, member.mt_idx, 5, db)
            db.add(push_log)
            db.commit()
            return create_response(
                FAILURE, 
                "푸시발송(단건) 실패", 
                "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요."
            )

        logger.debug("푸시 메시지 전송 중")
        try:
            response = firebase_service.send_push_notification(
                member.mt_token_id, 
                args['plt_title'], 
                args['plt_content']
            )
            logger.debug(f"Firebase 응답: {response}")
            
            # 상태 2: 전송 성공
            push_log = create_push_log(args, member.mt_idx, 2, db)
            db.add(push_log)
            db.commit()

            logger.debug("푸시 발송 성공")
            return create_response(
                SUCCESS, 
                "푸시발송(단건) 성공", 
                "푸시발송(단건) 성공했습니다."
            )
            
        except Exception as firebase_error:
            logger.error(f"Firebase 푸시 전송 실패: {firebase_error}")
            # 상태 3: 전송 실패
            push_log = create_push_log(args, member.mt_idx, 3, db)
            db.add(push_log)
            db.commit()
            
            return create_response(
                FAILURE, 
                "푸시발송(단건) 실패", 
                f"Firebase 전송 실패: {str(firebase_error)}"
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
                args.get('priority', 'normal'),
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

        except Exception as firebase_error:
            logger.error(f"Firebase 백그라운드 푸시 전송 실패: {firebase_error}")
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