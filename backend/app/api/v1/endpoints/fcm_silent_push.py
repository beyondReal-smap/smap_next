"""
FCM Silent Push API 엔드포인트
토큰 갱신을 위한 조용한 푸시 알림 전송
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import logging
from datetime import datetime

from app.database import get_db
from app.services.firebase_service import FirebaseService

logger = logging.getLogger(__name__)

router = APIRouter()

# Firebase 서비스 인스턴스
firebase_service = FirebaseService()

class SilentPushRequest(BaseModel):
    """Silent Push 요청 모델"""
    mt_idx: int = Field(..., description="회원 ID")
    fcm_token: Optional[str] = Field(None, description="FCM 토큰 (선택사항, 없으면 DB에서 조회)")
    reason: Optional[str] = Field("manual", description="Silent Push 전송 이유")

class SilentPushResponse(BaseModel):
    """Silent Push 응답 모델"""
    success: bool
    message: str
    mt_idx: int
    token_preview: str
    push_result: str

@router.post("/send-silent-push", response_model=SilentPushResponse)
async def send_silent_push_for_token_refresh(
    request: SilentPushRequest,
    db=Depends(get_db)
):
    """
    FCM 토큰 갱신을 위한 Silent Push 전송
    
    iOS 앱이 백그라운드에 있을 때 토큰 갱신을 유도하기 위해 조용한 푸시를 보냅니다.
    사용자에게는 알림이 표시되지 않고, 앱에서만 토큰 갱신 로직이 실행됩니다.
    """
    try:
        logger.info(f"🔇 [Silent Push API] 토큰 갱신용 Silent Push 요청 - 사용자: {request.mt_idx}")
        
        # FCM 토큰 확인 (요청에 없으면 DB에서 조회)
        fcm_token = request.fcm_token
        
        if not fcm_token:
            # DB에서 토큰 조회
            cursor = db.cursor()
            cursor.execute("""
                SELECT mt_token_id 
                FROM members 
                WHERE mt_idx = %s AND mt_token_id IS NOT NULL AND mt_token_id != ''
            """, (request.mt_idx,))
            
            result = cursor.fetchone()
            cursor.close()
            
            if not result:
                logger.warning(f"❌ [Silent Push API] 사용자의 FCM 토큰을 찾을 수 없음: {request.mt_idx}")
                raise HTTPException(
                    status_code=404,
                    detail="FCM 토큰을 찾을 수 없습니다. 앱에서 토큰을 등록해주세요."
                )
            
            fcm_token = result[0]
        
        logger.info(f"🔇 [Silent Push API] 토큰 확인 완료: {fcm_token[:30]}...")
        
        # Firebase 서비스 사용 가능 여부 확인
        if not firebase_service.is_available():
            logger.error("🚨 [Silent Push API] Firebase 서비스를 사용할 수 없음")
            raise HTTPException(
                status_code=503,
                detail="푸시 알림 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
            )
        
        # Silent Push 전송
        push_result = firebase_service.send_silent_push_for_token_refresh(
            token=fcm_token,
            member_id=request.mt_idx
        )
        
        # 결과 처리
        if push_result == "silent_push_sent":
            logger.info(f"✅ [Silent Push API] Silent Push 전송 성공 - 사용자: {request.mt_idx}")
            
            return SilentPushResponse(
                success=True,
                message="토큰 갱신용 Silent Push가 성공적으로 전송되었습니다.",
                mt_idx=request.mt_idx,
                token_preview=f"{fcm_token[:30]}...",
                push_result=push_result
            )
            
        elif push_result == "token_unregistered":
            logger.warning(f"⚠️ [Silent Push API] 토큰이 등록되지 않음 - 사용자: {request.mt_idx}")
            
            return SilentPushResponse(
                success=False,
                message="FCM 토큰이 만료되었거나 등록되지 않았습니다. 앱을 재시작해주세요.",
                mt_idx=request.mt_idx,
                token_preview=f"{fcm_token[:30]}...",
                push_result=push_result
            )
            
        else:
            logger.warning(f"⚠️ [Silent Push API] Silent Push 전송 실패 - 사용자: {request.mt_idx}, 결과: {push_result}")
            
            return SilentPushResponse(
                success=False,
                message=f"Silent Push 전송에 실패했습니다: {push_result}",
                mt_idx=request.mt_idx,
                token_preview=f"{fcm_token[:30]}...",
                push_result=push_result
            )
            
    except HTTPException:
        # FastAPI HTTPException은 그대로 re-raise
        raise
        
    except Exception as e:
        logger.error(f"🚨 [Silent Push API] 예상치 못한 오류: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Silent Push 전송 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/send-batch-silent-push")
async def send_batch_silent_push_for_stale_tokens(
    db=Depends(get_db)
):
    """
    오래된 토큰을 가진 사용자들에게 일괄 Silent Push 전송
    
    마지막 토큰 업데이트가 24시간 이상 된 사용자들에게 토큰 갱신을 유도하기 위해
    Silent Push를 일괄 전송합니다.
    """
    try:
        logger.info("🔇 [Batch Silent Push] 오래된 토큰을 가진 사용자들에게 일괄 Silent Push 시작")
        
        # 24시간 이상 토큰 업데이트가 없는 사용자 조회
        cursor = db.cursor()
        cursor.execute("""
            SELECT mt_idx, mt_token_id, mt_token_updated_at
            FROM members 
            WHERE mt_token_id IS NOT NULL 
            AND mt_token_id != ''
            AND mt_status = 1
            AND (mt_token_updated_at IS NULL OR mt_token_updated_at < NOW() - INTERVAL 24 HOUR)
            LIMIT 100
        """)
        
        stale_tokens = cursor.fetchall()
        cursor.close()
        
        if not stale_tokens:
            logger.info("✅ [Batch Silent Push] 오래된 토큰을 가진 사용자가 없음")
            return {
                "success": True,
                "message": "오래된 토큰을 가진 사용자가 없습니다.",
                "processed_count": 0,
                "success_count": 0,
                "failed_count": 0
            }
        
        logger.info(f"🔇 [Batch Silent Push] {len(stale_tokens)}명의 사용자에게 Silent Push 전송 시작")
        
        success_count = 0
        failed_count = 0
        
        for row in stale_tokens:
            mt_idx, fcm_token, last_updated = row
            
            try:
                # Silent Push 전송
                push_result = firebase_service.send_silent_push_for_token_refresh(
                    token=fcm_token,
                    member_id=mt_idx
                )
                
                if push_result == "silent_push_sent":
                    success_count += 1
                    logger.info(f"✅ [Batch Silent Push] 성공 - 사용자: {mt_idx}")
                else:
                    failed_count += 1
                    logger.warning(f"⚠️ [Batch Silent Push] 실패 - 사용자: {mt_idx}, 결과: {push_result}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"🚨 [Batch Silent Push] 사용자 {mt_idx} 처리 중 오류: {e}")
        
        logger.info(f"✅ [Batch Silent Push] 일괄 처리 완료 - 성공: {success_count}, 실패: {failed_count}")
        
        return {
            "success": True,
            "message": f"일괄 Silent Push 전송 완료",
            "processed_count": len(stale_tokens),
            "success_count": success_count,
            "failed_count": failed_count
        }
        
    except Exception as e:
        logger.error(f"🚨 [Batch Silent Push] 예상치 못한 오류: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"일괄 Silent Push 전송 중 오류가 발생했습니다: {str(e)}"
        )
