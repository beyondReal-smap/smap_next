import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import auth, email_auth, sms
from app.schemas.auth import LoginRequestHome
from app.schemas.member import RegisterRequest


class FakeRedis:
    def __init__(self):
        self.data = {}

    def incr(self, key):
        self.data[key] = int(self.data.get(key, 0)) + 1
        return self.data[key]

    def expire(self, key, ttl):
        return True

    def setex(self, key, ttl, value):
        self.data[key] = value

    def set(self, key, value, *, nx=False, ex=None):
        if nx and key in self.data:
            return False
        self.data[key] = value
        return True

    def get(self, key):
        return self.data.get(key)

    def delete(self, *keys):
        for key in keys:
            self.data.pop(key, None)


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args):
        return self

    def limit(self, count):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDB:
    def __init__(self, rows=None):
        self.rows = rows or []

    def query(self, model):
        return FakeQuery(self.rows)

    def commit(self):
        pass


@pytest.fixture
def redis_and_mail(monkeypatch):
    redis = FakeRedis()
    sent = []
    async def send(email, code):
        sent.append((email, code))
        return True
    monkeypatch.setattr(email_auth, 'get_redis', lambda: redis)
    monkeypatch.setattr(email_auth.email_service, 'send_verification_code', send)
    return redis, sent


def request():
    return SimpleNamespace(client=SimpleNamespace(host='127.0.0.10'), headers={})


def registration(**extra):
    data = dict(mt_id='person@example.com', mt_email='person@example.com', mt_pwd='Strong1!',
                mt_name='이름', mt_nickname='별명', mt_agree1=True, mt_agree2=True, mt_agree3=True)
    data.update(extra)
    return RegisterRequest(**data)


def member(**extra):
    values = dict(mt_idx=7, mt_id='person@example.com', mt_email='person@example.com', mt_name='이름',
                  mt_nickname='별명', mt_level=2, mt_status=1, mt_show='Y', mt_type=1, mt_pwd='hash',
                  mt_hp='', mt_birth=None, mt_gender=None, mt_file1='', mt_lat=None, mt_long=None,
                  mt_sido='', mt_gu='', mt_dong='', mt_onboarding='N', mt_push1='Y', mt_plan_check='N',
                  mt_plan_date=None, mt_weather_pop='', mt_weather_sky=None, mt_weather_tmn=None,
                  mt_weather_tmx=None, mt_weather_date=None, mt_wdate=None, mt_ldate=None, mt_adate=None)
    values.update(extra)
    return SimpleNamespace(**values)


def test_send_verify_and_register(redis_and_mail, monkeypatch):
    _, sent = redis_and_mail
    data = email_auth.EmailRequest(email=' Person@EXAMPLE.com ', purpose='register')
    assert asyncio.run(email_auth.send_email_code(data, request(), FakeDB())).success
    email, code = sent[0]
    assert email == 'person@example.com'
    result = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email=email, purpose='register', code=code))
    captured = []
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda db, phone: None)
    monkeypatch.setattr(auth.crud_auth, 'create_user', lambda db, user_in: captured.append(user_in) or member())
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    output = asyncio.run(auth.register_user(request(), registration(email_verification_token=result.verification_token, mt_level=9), FakeDB()))
    assert output.success and output.data['refresh_token'] == 'refresh'
    assert captured[0].mt_id == email and captured[0].mt_email == email
    assert not hasattr(captured[0], 'mt_level')


def test_register_without_verification_rejected(monkeypatch):
    monkeypatch.setattr(auth, '_is_verified', lambda phone: False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.register_user(request(), registration(mt_id='01012345678'), FakeDB()))
    assert exc.value.status_code == 400


def test_attempts_expire_code(redis_and_mail):
    redis, sent = redis_and_mail
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='x@example.com', purpose='register'), request(), FakeDB()))
    for _ in range(6):
        with pytest.raises(HTTPException):
            email_auth.verify_email_code(email_auth.EmailVerifyRequest(email='x@example.com', purpose='register', code='wrong'))
    assert redis.get(email_auth._key('x@example.com', 'register')) is None


def test_rate_limit(redis_and_mail):
    data = email_auth.EmailRequest(email='x@example.com', purpose='register')
    for _ in range(5):
        asyncio.run(email_auth.send_email_code(data, request(), FakeDB()))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(email_auth.send_email_code(data, request(), FakeDB()))
    assert exc.value.status_code == 429


def test_redis_unavailable(monkeypatch):
    monkeypatch.setattr(email_auth, 'get_redis', lambda: None)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='x@example.com', purpose='register'), request(), FakeDB()))
    assert exc.value.status_code == 503


@pytest.mark.parametrize('identity', ['person@example.com', '01012345678'])
def test_existing_login(identity, monkeypatch):
    user = member(mt_id=identity)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda db, value: user if value == identity else None)
    monkeypatch.setattr(auth.crud_auth, 'verify_password', lambda *args: True)
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    response = auth.login_for_home_page(LoginRequestHome(mt_id=identity, mt_pwd='Strong1!'), request(), FakeDB())
    assert response.success and response.data['refresh_token'] == 'refresh'


def test_inactive_login(monkeypatch):
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: member(mt_level=1))
    monkeypatch.setattr(auth.crud_auth, 'verify_password', lambda *args: True)
    result = auth.login_for_home_page(LoginRequestHome(mt_id='person@example.com', mt_pwd='Strong1!'), request(), FakeDB())
    assert not result.success


def test_reset_revokes_refresh(redis_and_mail, monkeypatch):
    user = member()
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email=user.mt_email, purpose='reset_password'), request(), FakeDB([user])))
    code = redis_and_mail[1][0][1]
    token = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email=user.mt_email, purpose='reset_password', code=code)).verification_token
    revoke = Mock()
    monkeypatch.setattr(email_auth.crud_refresh_token, 'revoke_all_for_member', revoke)
    monkeypatch.setattr(email_auth.crud_auth, 'get_hashed_password', lambda password: 'new-hash')
    result = email_auth.reset_password_by_email(email_auth.EmailResetRequest(email=user.mt_email, verification_token=token, new_password='Strong1!'), FakeDB([user]))
    assert result.success and user.mt_pwd == 'new-hash'
    revoke.assert_called_once()


def test_sms_redis_unavailable(monkeypatch):
    monkeypatch.setattr(sms, 'get_redis', lambda: None)
    with pytest.raises(HTTPException) as exc:
        sms._check_rate_limit('01012345678')
    assert exc.value.status_code == 503


def test_duplicate_email_login_rejected(monkeypatch):
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: None)
    with pytest.raises(HTTPException) as exc:
        auth.login_for_home_page(LoginRequestHome(mt_id='person@example.com', mt_pwd='Strong1!'), request(), FakeDB([member(), member(mt_idx=8)]))
    assert exc.value.status_code == 400


def test_wrong_token_purpose_rejected(redis_and_mail):
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='x@example.com', purpose='register'), request(), FakeDB()))
    code = redis_and_mail[1][0][1]
    token = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email='x@example.com', purpose='register', code=code)).verification_token
    with pytest.raises(HTTPException) as exc:
        email_auth.verify_email_token(token, 'x@example.com', 'reset_password')
    assert exc.value.status_code == 400


def test_mail_failure_is_502(redis_and_mail, monkeypatch):
    async def fail(email, code):
        raise RuntimeError('mail error')
    monkeypatch.setattr(email_auth.email_service, 'send_verification_code', fail)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='x@example.com', purpose='register'), request(), FakeDB()))
    assert exc.value.status_code == 502
    assert redis_and_mail[0].get(email_auth._key('x@example.com', 'register')) is None


def test_server_controls_privileges(monkeypatch):
    created = []
    db = SimpleNamespace(add=created.append, commit=lambda: None, refresh=lambda obj: None)
    monkeypatch.setattr(auth.crud_auth, 'get_hashed_password', lambda password: 'hash')
    user = registration(mt_level=9, mt_status=2, mt_type=4)
    auth.crud_auth.create_user(db, user)
    assert (created[0].mt_level, created[0].mt_status, created[0].mt_type) == (2, 1, 1)


def test_sms_attempt_limit(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(sms, 'get_redis', lambda: redis)
    redis.setex('sms:code:01012345678', 180, '123456')
    for _ in range(5):
        result = asyncio.run(sms.verify_code(sms.VerifyCodeRequest(phone_number='01012345678', code='999999')))
        assert not result.success
    result = asyncio.run(sms.verify_code(sms.VerifyCodeRequest(phone_number='01012345678', code='123456')))
    assert not result.success and redis.get('sms:code:01012345678') is None


def test_unknown_password_reset_sends_no_mail(redis_and_mail):
    result = asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='x@example.com', purpose='reset_password'), request(), FakeDB()))
    assert result.success and not redis_and_mail[1]


def test_proxy_ip_trust(monkeypatch, caplog):
    monkeypatch.setattr(email_auth.settings, 'TRUSTED_CLIENT_IP_HEADER', 'X-Forwarded-For', raising=False)
    proxied = SimpleNamespace(client=SimpleNamespace(host='10.0.0.1'), headers={'X-Forwarded-For': '198.51.100.5, 203.0.113.4'})
    assert email_auth._client_ip(proxied) == '203.0.113.4'
    proxied.client.host = '8.8.8.8'
    assert email_auth._client_ip(proxied) == '8.8.8.8'
    proxied.client.host = '127.0.0.1'
    monkeypatch.setattr(email_auth.settings, 'TRUSTED_CLIENT_IP_HEADER', '')
    assert email_auth._client_ip(proxied) == '127.0.0.1'
    assert 'TRUSTED_CLIENT_IP_HEADER' in caplog.text


def test_inactive_login_hides_status_until_password_verified(monkeypatch):
    user = member(mt_level=1)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: user)
    monkeypatch.setattr(auth.crud_auth, 'verify_password', lambda *args: False)
    result = auth.login_for_home_page(LoginRequestHome(mt_id=user.mt_id, mt_pwd='wrong'), request(), FakeDB())
    assert result.message == '아이디 또는 비밀번호가 올바르지 않습니다.'
    monkeypatch.setattr(auth.crud_auth, 'verify_password', lambda *args: True)
    result = auth.login_for_home_page(LoginRequestHome(mt_id=user.mt_id, mt_pwd='correct'), request(), FakeDB())
    assert not result.success and result.message == '비활성화된 계정입니다. 고객센터에 문의해주세요.'


def test_reset_token_single_use_and_commit(redis_and_mail, monkeypatch):
    user = member()
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email=user.mt_email, purpose='reset_password'), request(), FakeDB([user])))
    code = redis_and_mail[1][0][1]
    token = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email=user.mt_email, purpose='reset_password', code=code)).verification_token
    monkeypatch.setattr(email_auth.crud_auth, 'get_hashed_password', lambda password: 'new-hash')
    revoke = Mock()
    monkeypatch.setattr(email_auth.crud_refresh_token, 'revoke_all_for_member', revoke)
    db = FakeDB([user])
    db.commit = Mock()
    data = email_auth.EmailResetRequest(email=user.mt_email, verification_token=token, new_password='Strong1!')
    assert email_auth.reset_password_by_email(data, db).success
    db.commit.assert_called_once()
    revoke.assert_called_once_with(db, user.mt_idx, commit=False)
    with pytest.raises(HTTPException) as exc:
        email_auth.reset_password_by_email(data, db)
    assert exc.value.status_code == 400


def test_reset_transaction_failure_rolls_back_and_allows_retry(redis_and_mail, monkeypatch):
    user = member()
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email=user.mt_email, purpose='reset_password'), request(), FakeDB([user])))
    code = redis_and_mail[1][0][1]
    token = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email=user.mt_email, purpose='reset_password', code=code)).verification_token
    monkeypatch.setattr(email_auth.crud_auth, 'get_hashed_password', lambda password: 'new-hash')
    revoke = Mock(side_effect=RuntimeError('database failure'))
    monkeypatch.setattr(email_auth.crud_refresh_token, 'revoke_all_for_member', revoke)
    db = FakeDB([user])
    db.rollback = Mock()
    data = email_auth.EmailResetRequest(email=user.mt_email, verification_token=token, new_password='Strong1!')
    with pytest.raises(HTTPException) as exc:
        email_auth.reset_password_by_email(data, db)
    assert exc.value.status_code == 500
    db.rollback.assert_called_once()
    revoke.side_effect = None
    assert email_auth.reset_password_by_email(data, db).success


def test_reset_token_store_failure_is_503(redis_and_mail, monkeypatch):
    user = member()
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email=user.mt_email, purpose='reset_password'), request(), FakeDB([user])))
    code = redis_and_mail[1][0][1]
    token = email_auth.verify_email_code(email_auth.EmailVerifyRequest(email=user.mt_email, purpose='reset_password', code=code)).verification_token
    monkeypatch.setattr(email_auth, 'get_redis', lambda: None)
    data = email_auth.EmailResetRequest(email=user.mt_email, verification_token=token, new_password='Strong1!')
    with pytest.raises(HTTPException) as exc:
        email_auth.reset_password_by_email(data, FakeDB([user]))
    assert exc.value.status_code == 503


def test_revoke_without_commit():
    query = Mock()
    query.filter.return_value.update.return_value = 2
    db = Mock()
    db.query.return_value = query
    assert email_auth.crud_refresh_token.revoke_all_for_member(db, 7, commit=False) == 2
    db.commit.assert_not_called()


def test_invalid_forwarded_ip_uses_proxy(monkeypatch, caplog):
    monkeypatch.setattr(email_auth.settings, 'TRUSTED_CLIENT_IP_HEADER', 'X-Forwarded-For')
    proxied = SimpleNamespace(client=SimpleNamespace(host='192.168.1.1'), headers={'X-Forwarded-For': '198.51.100.1, invalid'})
    assert email_auth._client_ip(proxied) == '192.168.1.1'
    assert '헤더가 없거나 올바르지' in caplog.text


def test_reset_email_sends_code_for_null_status(redis_and_mail):
    _, sent = redis_and_mail
    user = member(mt_level=None, mt_status=None, mt_show=None)
    result = asyncio.run(email_auth.send_email_code(
        email_auth.EmailRequest(email='person@example.com', purpose='reset_password'), request(), FakeDB([user])))
    assert result.success and len(sent) == 1


def test_reset_password_accepts_null_status(redis_and_mail, monkeypatch):
    import time
    user = member(mt_level=None, mt_status=None, mt_show=None)
    monkeypatch.setattr(email_auth, 'verify_email_token', lambda *args: {'jti': 'unique-id', 'exp': time.time() + 60})
    monkeypatch.setattr(email_auth.crud_auth, 'get_hashed_password', lambda password: 'new-hash')
    monkeypatch.setattr(email_auth.crud_refresh_token, 'revoke_all_for_member', lambda *args, **kwargs: None)
    result = email_auth.reset_password_by_email(email_auth.EmailResetRequest(
        email='person@example.com', verification_token='verified', new_password='Strong1!'), FakeDB([user]))
    assert result.success and user.mt_pwd == 'new-hash'
