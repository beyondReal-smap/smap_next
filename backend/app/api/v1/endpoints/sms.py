from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

from app.services.sms_service import sms_service

logger = logging.getLogger(__name__)

router = APIRouter()

class VerificationCodeRequest(BaseModel):
    phone_number: str

class VerificationCodeResponse(BaseModel):
    success: bool
    code: str | None = None
    error: str | None = None

class SMSRequest(BaseModel):
    phone_number: str
    message: str
    subject: str = "SMAP"

class SMSResponse(BaseModel):
    success: bool
    message: str
    msg_id: str | None = None

@router.post("/send-verification-code", response_model=VerificationCodeResponse)
async def send_verification_code(request: VerificationCodeRequest):
    """
    인증번호 발송 API (Fixie 프록시를 통해 고정 IP 사용)
    """
    try:
        import random
        
        # 6자리 인증번호 생성
        code = str(random.randint(100000, 999999))
        message = f"[SMAP] 인증번호는 {code}입니다. 3분 이내에 입력해주세요."
        
        logger.info(f"📱 인증번호 발송 요청: {request.phone_number[:3]}***")
        
        # SMS 발송
        result = await sms_service.send_sms(
            phone_number=request.phone_number,
            message=message,
            subject="SMAP 인증번호"
        )
        
        if result['success']:
            return VerificationCodeResponse(
                success=True,
                code=code
            )
        else:
            return VerificationCodeResponse(
                success=False,
                error=result['message']
            )
    
    except Exception as e:
        logger.error(f"❌ 인증번호 발송 중 오류: {str(e)}")
        return VerificationCodeResponse(
            success=False,
            error=f"인증번호 발송 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/send", response_model=SMSResponse)
async def send_sms(request: SMSRequest):
    """
    일반 SMS 발송 API (Fixie 프록시를 통해 고정 IP 사용)
    """
    try:
        logger.info(f"📱 SMS 발송 요청: {request.phone_number[:3]}***")
        
        result = await sms_service.send_sms(
            phone_number=request.phone_number,
            message=request.message,
            subject=request.subject
        )
        
        return SMSResponse(
            success=result['success'],
            message=result['message'],
            msg_id=result.get('msg_id')
        )
    
    except Exception as e:
        logger.error(f"❌ SMS 발송 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"SMS 발송 중 오류가 발생했습니다: {str(e)}"
        )

