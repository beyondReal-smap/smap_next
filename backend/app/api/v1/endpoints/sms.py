from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import logging
import secrets
import time

from app.api import deps
from app.core.cache import get_redis
from app.services.sms_service import sms_service

logger = logging.getLogger(__name__)

router = APIRouter()

def _required_redis():
    try:
        client = get_redis()
        if client is None:
            raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.")
        return client
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("SMS 인증 저장소 오류: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _store_verification_code(phone: str, code: str):
    try:
        _required_redis().setex(f"sms:code:{phone}", 180, code)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _get_verification_code(phone: str) -> str | None:
    try:
        return _required_redis().get(f"sms:code:{phone}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _delete_verification_code(phone: str):
    try:
        _required_redis().delete(f"sms:code:{phone}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _mark_verified(phone: str):
    try:
        _required_redis().setex(f"sms:verified:{phone}", 300, "1")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _is_verified(phone: str) -> bool:
    try:
        return bool(_required_redis().get(f"sms:verified:{phone}"))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _clear_verified(phone: str):
    try:
        _required_redis().delete(f"sms:verified:{phone}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


def _check_rate_limit(phone: str) -> bool:
    r = _required_redis()
    try:
        key = f"sms:rate:{phone}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 3600)
        return count <= 5
    except Exception as exc:
        logger.error("SMS 레이트리밋 저장소 오류: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class VerificationCodeRequest(BaseModel):
    phone_number: str

class VerificationCodeResponse(BaseModel):
    success: bool
    error: str | None = None

class VerifyCodeRequest(BaseModel):
    phone_number: str
    code: str

class VerifyCodeResponse(BaseModel):
    success: bool
    error: str | None = None

class SMSRequest(BaseModel):
    phone_number: str
    message: str
    subject: str = "SMAP"

class SMSResponse(BaseModel):
    success: bool
    message: str
    msg_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/send-verification-code", response_model=VerificationCodeResponse)
async def send_verification_code(request: VerificationCodeRequest):
    """
    인증번호 발송 API — 코드는 서버에만 저장되며 응답에 포함하지 않습니다.
    """
    try:
        clean_phone = request.phone_number.replace('-', '').replace(' ', '')

        # 레이트리밋 체크
        if not _check_rate_limit(clean_phone):
            return VerificationCodeResponse(
                success=False,
                error="너무 많은 요청입니다. 잠시 후 다시 시도해주세요."
            )

        # 6자리 인증번호 생성 (CSPRNG 사용)
        code = str(secrets.randbelow(900000) + 100000)
        message = f"[SMAP] 인증번호는 {code}입니다. 3분 이내에 입력해주세요."

        logger.info(f"인증번호 발송 요청: {request.phone_number[:3]}***")

        # SMS 발송
        result = await sms_service.send_sms(
            phone_number=request.phone_number,
            message=message,
            subject="SMAP 인증번호"
        )

        if result['success']:
            # 서버 측에 코드 저장 (Redis 3분 TTL)
            _store_verification_code(clean_phone, code)
            try:
                _required_redis().delete(f"sms:attempts:{clean_phone}")
            except Exception as exc:
                raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc
            return VerificationCodeResponse(success=True)
        else:
            return VerificationCodeResponse(
                success=False,
                error=result['message']
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"인증번호 발송 중 오류: {e}")
        return VerificationCodeResponse(
            success=False,
            error="인증번호 발송 중 오류가 발생했습니다."
        )

def _check_verification_attempts(clean_phone: str) -> bool:
    r = _required_redis()
    try:
        attempts = r.incr(f"sms:attempts:{clean_phone}")
        if attempts == 1:
            r.expire(f"sms:attempts:{clean_phone}", 180)
        if attempts > 5:
            _delete_verification_code(clean_phone)
            return False
    except Exception as exc:
        logger.error("SMS 인증 시도 저장소 오류: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc
    return True


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(request: VerifyCodeRequest):
    """인증번호 검증 API — 서버에 저장된 코드와 비교합니다."""
    clean_phone = request.phone_number.replace('-', '').replace(' ', '')
    if not _check_verification_attempts(clean_phone):
        return VerifyCodeResponse(success=False, error="인증번호가 만료되었습니다. 다시 요청해주세요.")
    stored_code = _get_verification_code(clean_phone)

    if not stored_code:
        return VerifyCodeResponse(success=False, error="인증번호를 먼저 요청해주세요.")

    if not secrets.compare_digest(request.code, stored_code):
        return VerifyCodeResponse(success=False, error="인증번호가 일치하지 않습니다.")

    _delete_verification_code(clean_phone)
    # 인증 완료 상태 저장 (reset-password 등 후속 API에서 확인용, 5분 TTL)
    _mark_verified(clean_phone)
    return VerifyCodeResponse(success=True)

@router.post("/send", response_model=SMSResponse)
async def send_sms(
    request: SMSRequest,
    user_id: int = Depends(deps.get_required_admin_id),
):
    """
    일반 SMS 발송 API (Fixie 프록시를 통해 고정 IP 사용)
    """
    try:
        logger.info(f"SMS 발송 요청: {request.phone_number[:3]}***")

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
        logger.error(f"SMS 발송 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="SMS 발송 중 오류가 발생했습니다."
        )
