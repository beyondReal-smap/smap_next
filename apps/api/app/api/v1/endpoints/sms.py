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

# Redis 불가 시 인메모리 fallback
_verification_codes: dict[str, tuple[str, float]] = {}
_verified_phones: dict[str, float] = {}  # 인증 완료 상태 인메모리 fallback


# ---------------------------------------------------------------------------
# Redis 기반 인증코드 저장/조회/삭제 + 레이트리밋
# ---------------------------------------------------------------------------

def _store_verification_code(phone: str, code: str):
    """인증코드를 Redis에 저장 (3분 TTL)"""
    r = get_redis()
    if r:
        try:
            r.setex(f"sms:code:{phone}", 180, code)
            return
        except Exception:
            logger.warning("Redis 저장 실패, 인메모리 fallback 사용")
    # Redis 불가 시 인메모리 fallback
    _verification_codes[phone] = (code, time.time() + 180)


def _get_verification_code(phone: str) -> str | None:
    """Redis에서 인증코드 조회"""
    r = get_redis()
    if r:
        try:
            code = r.get(f"sms:code:{phone}")
            return code if code else None
        except Exception:
            logger.warning("Redis 조회 실패, 인메모리 fallback 사용")
    # 인메모리 fallback
    entry = _verification_codes.get(phone)
    if entry and entry[1] > time.time():
        return entry[0]
    return None


def _delete_verification_code(phone: str):
    """인증코드 삭제"""
    r = get_redis()
    if r:
        try:
            r.delete(f"sms:code:{phone}")
        except Exception:
            pass
    _verification_codes.pop(phone, None)


# ---------------------------------------------------------------------------
# 인증 완료 상태 저장/조회/삭제 (verify-code → reset-password 플로우 지원)
# ---------------------------------------------------------------------------

def _mark_verified(phone: str):
    """인증 완료 상태를 Redis에 저장 (5분 TTL)"""
    r = get_redis()
    if r:
        try:
            r.setex(f"sms:verified:{phone}", 300, "1")
            return
        except Exception:
            logger.warning("Redis 인증 완료 상태 저장 실패, 인메모리 fallback 사용")
    # Redis 불가 시 인메모리 fallback
    _verified_phones[phone] = time.time() + 300


def _is_verified(phone: str) -> bool:
    """인증 완료 상태 확인"""
    r = get_redis()
    if r:
        try:
            result = r.get(f"sms:verified:{phone}")
            if result:
                return True
        except Exception:
            logger.warning("Redis 인증 완료 상태 조회 실패, 인메모리 fallback 사용")
    # 인메모리 fallback
    expiry = _verified_phones.get(phone)
    if expiry and expiry > time.time():
        return True
    return False


def _clear_verified(phone: str):
    """인증 완료 상태 삭제"""
    r = get_redis()
    if r:
        try:
            r.delete(f"sms:verified:{phone}")
        except Exception:
            pass
    _verified_phones.pop(phone, None)


def _check_rate_limit(phone: str) -> bool:
    """SMS 발송 레이트리밋 (시간당 5회)"""
    r = get_redis()
    if r:
        try:
            key = f"sms:rate:{phone}"
            count = r.incr(key)
            if count == 1:
                r.expire(key, 3600)
            return count <= 5
        except Exception:
            logger.warning("Redis 레이트리밋 체크 실패, 허용 처리")
    return True


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
            return VerificationCodeResponse(success=True)
        else:
            return VerificationCodeResponse(
                success=False,
                error=result['message']
            )

    except Exception as e:
        logger.error(f"인증번호 발송 중 오류: {e}")
        return VerificationCodeResponse(
            success=False,
            error="인증번호 발송 중 오류가 발생했습니다."
        )

@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(request: VerifyCodeRequest):
    """인증번호 검증 API — 서버에 저장된 코드와 비교합니다."""
    clean_phone = request.phone_number.replace('-', '').replace(' ', '')
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
    user_id: int = Depends(deps.get_required_user_id),
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
