import hashlib
import ipaddress
import math
import time
import logging
import secrets
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.crud import crud_auth, crud_refresh_token
from app.db.session import get_db
from app.models.member import Member, is_active_member, active_member_conditions
from app.services.email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailRequest(BaseModel):
    email: EmailStr
    purpose: Literal['register', 'reset_password']

    @field_validator('email', mode='before')
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class EmailVerifyRequest(EmailRequest):
    code: str


class EmailResetRequest(BaseModel):
    email: EmailStr
    verification_token: str
    new_password: str

    @field_validator('email', mode='before')
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class EmailSendResponse(BaseModel):
    success: bool


class EmailVerifyResponse(EmailSendResponse):
    verification_token: str


def _redis():
    try:
        client = get_redis()
    except Exception as exc:
        logger.error("이메일 인증 저장소 오류: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="인증 서비스를 사용할 수 없습니다.") from exc
    if client is None:
        raise HTTPException(status_code=503, detail='인증 서비스를 사용할 수 없습니다.')
    return client


def _key(email: str, purpose: str) -> str:
    digest = hashlib.sha256(email.encode()).hexdigest()
    return f'email:code:{purpose}:{digest}'


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else 'unknown'
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return peer
    networks = ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7')
    trusted_peer = address.is_loopback or any(address in ipaddress.ip_network(network) for network in networks if address.version == ipaddress.ip_network(network).version)
    if not trusted_peer:
        return peer
    header = settings.TRUSTED_CLIENT_IP_HEADER.strip()
    if not header:
        logger.warning('TRUSTED_CLIENT_IP_HEADER가 설정되지 않아 프록시 주소로 제한합니다.')
        return peer
    value = request.headers.get(header, '').split(',')[-1].strip()
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        logger.warning('신뢰 클라이언트 IP 헤더가 없거나 올바르지 않아 프록시 주소로 제한합니다.')
        return peer


def verify_email_token(token: str, email: str, purpose: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get('type') != 'email_verification' or payload.get('email') != email or payload.get('purpose') != purpose or not payload.get('exp'):
            raise JWTError('invalid verification token')
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=400, detail='이메일 인증이 유효하지 않습니다.') from exc


@router.post('/email/send-code', response_model=EmailSendResponse)
async def send_email_code(data: EmailRequest, request: Request, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    r = _redis()
    digest = hashlib.sha256(email.encode()).hexdigest()
    ip = _client_ip(request)
    ip_digest = hashlib.sha256(ip.encode()).hexdigest()
    try:
        for key, limit in ((f'email:rate:email:{digest}', 5), (f'email:rate:ip:{ip_digest}', 20)):
            count = r.incr(key)
            if count == 1:
                r.expire(key, 3600)
            if count > limit:
                raise HTTPException(status_code=429, detail='요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.')
    except HTTPException:
        raise
    except Exception as exc:
        logger.error('이메일 인증 저장소 오류: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='인증 서비스를 사용할 수 없습니다.') from exc

    members = db.query(Member).filter(func.lower(func.trim(Member.mt_email)) == email).all()
    if data.purpose == 'register' and (members or db.query(Member).filter(func.lower(func.trim(Member.mt_id)) == email).first()):
        raise HTTPException(status_code=409, detail='이미 가입된 이메일입니다.')
    if data.purpose == 'reset_password' and not any(is_active_member(m) for m in members):
        return EmailSendResponse(success=True)

    code = f'{secrets.randbelow(1000000):06d}'
    key = _key(email, data.purpose)
    try:
        r.setex(key, 600, code)
        r.delete(f'{key}:attempts')
    except Exception as exc:
        logger.error('이메일 인증 저장소 오류: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='인증 서비스를 사용할 수 없습니다.') from exc
    try:
        result = await email_service.send_verification_code(email, code)
        if not result:
            raise RuntimeError('mail delivery failed')
    except Exception as exc:
        try:
            r.delete(key)
        except Exception:
            logger.error('이메일 인증 코드 삭제 실패')
        logger.error('이메일 발송 실패: %s', type(exc).__name__)
        raise HTTPException(status_code=502, detail='인증 메일 발송에 실패했습니다.') from exc
    return EmailSendResponse(success=True)


@router.post('/email/verify-code', response_model=EmailVerifyResponse)
def verify_email_code(data: EmailVerifyRequest):
    email = str(data.email).lower()
    r = _redis()
    key = _key(email, data.purpose)
    try:
        code = r.get(key)
        if not code:
            raise HTTPException(status_code=400, detail='인증번호가 만료되었습니다. 다시 요청해주세요.')
        attempts = r.incr(f'{key}:attempts')
        if attempts == 1:
            r.expire(f'{key}:attempts', 600)
        if attempts > 5:
            r.delete(key, f'{key}:attempts')
            raise HTTPException(status_code=400, detail='인증번호가 만료되었습니다. 다시 요청해주세요.')
        if not secrets.compare_digest(data.code.encode(), str(code).encode()):
            raise HTTPException(status_code=400, detail='인증번호가 일치하지 않습니다.')
        r.delete(key, f'{key}:attempts')
    except HTTPException:
        raise
    except Exception as exc:
        logger.error('이메일 인증 저장소 오류: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='인증 서비스를 사용할 수 없습니다.') from exc
    token = jwt.encode({'type': 'email_verification', 'email': email, 'purpose': data.purpose,
                        'jti': secrets.token_urlsafe(24), 'exp': datetime.utcnow() + timedelta(minutes=15)}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return EmailVerifyResponse(success=True, verification_token=token)


@router.post('/reset-password-by-email', response_model=EmailSendResponse)
def reset_password_by_email(data: EmailResetRequest, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    payload = verify_email_token(data.verification_token, email, 'reset_password')
    token_id = payload.get('jti')
    if not isinstance(token_id, str) or not token_id:
        raise HTTPException(status_code=400, detail='이메일 인증이 유효하지 않습니다.')
    valid, errors = crud_auth.validate_password_policy(data.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=', '.join(errors))
    members = db.query(Member).filter(func.lower(func.trim(Member.mt_email)) == email,
        *active_member_conditions()).all()
    if len(members) != 1:
        raise HTTPException(status_code=400, detail='계정을 특정할 수 없습니다. 고객센터에 문의해주세요.')
    member = members[0]
    r = _redis()
    key = f"email:reset-used:{hashlib.sha256(token_id.encode()).hexdigest()}"
    ttl = max(1, math.ceil(payload['exp'] - time.time()))
    try:
        claimed = r.set(key, '1', nx=True, ex=ttl)
    except Exception as exc:
        logger.error('재설정 토큰 저장소 오류: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='인증 서비스를 사용할 수 없습니다.') from exc
    if not claimed:
        raise HTTPException(status_code=400, detail='이미 사용한 인증 토큰입니다.')
    try:
        member.mt_pwd = crud_auth.get_hashed_password(data.new_password)
        crud_refresh_token.revoke_all_for_member(db, member.mt_idx, commit=False)
        db.commit()
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            logger.exception('이메일 비밀번호 재설정 롤백 실패')
        else:
            try:
                r.delete(key)
            except Exception:
                logger.error('재설정 토큰 선점 해제 실패')
        logger.exception('이메일 비밀번호 재설정 트랜잭션 실패')
        raise HTTPException(status_code=500, detail='비밀번호 재설정에 실패했습니다.') from exc
    return EmailSendResponse(success=True)
