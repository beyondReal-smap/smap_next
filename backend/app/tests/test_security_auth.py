from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException, FastAPI
from sqlalchemy import select
from jose import jwt

from app.api import deps
from app.api.v1.endpoints import auth, groups, members, users, fcm_token
from app.models.member import Member
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.models.location import Location
from app.schemas.auth import GoogleLoginRequest
from app.schemas.member import AppleLoginRequest, WithdrawRequest
import importlib
social = importlib.import_module("app.services.member_service")


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(social, '_jwks_cache', {})
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    from jose import jwk
    jwks = {"keys": [dict(jwk.construct(public, algorithm="RS256").to_dict(), kid="key-1")]}
    response = Mock()
    response.json.return_value = jwks
    response.raise_for_status.return_value = None
    monkeypatch.setattr(social._provider_client, 'get', lambda *args, **kwargs: response)
    monkeypatch.setattr(social.settings, 'GOOGLE_ALLOWED_CLIENT_IDS', 'client')
    monkeypatch.setattr(social.settings, 'APPLE_ALLOWED_BUNDLE_IDS', 'bundle')
    return private


def signed(key, *, provider='google', audience=None, expiry=60):
    return jwt.encode({"sub": "verified-subject", "iss": "https://accounts.google.com" if provider == 'google' else 'https://appleid.apple.com',
                       "aud": audience or ('client' if provider == 'google' else 'bundle'),
                       "exp": datetime.now(timezone.utc) + timedelta(seconds=expiry)}, key, algorithm='RS256', headers={'kid': 'key-1'})


@pytest.mark.parametrize('provider', ['google', 'apple'])
def test_provider_signature_expiry_and_audience(keys, provider):
    assert social.verify_provider_identity(signed(keys, provider=provider), provider)['sub'] == 'verified-subject'
    for token in (signed(keys, provider=provider, expiry=-60), signed(keys, provider=provider, audience='other'),
                  jwt.encode({'sub': 'attacker', 'iss': 'https://accounts.google.com', 'aud': 'client', 'exp': datetime.now(timezone.utc) + timedelta(minutes=1)}, 'forged', algorithm='HS256')):
        with pytest.raises(HTTPException) as error:
            social.verify_provider_identity(token, provider)
        assert error.value.status_code == 401


def test_missing_provider_configuration_fails_closed(monkeypatch):
    monkeypatch.setattr(social.settings, 'GOOGLE_ALLOWED_CLIENT_IDS', '')
    with pytest.raises(HTTPException) as error:
        social.verify_provider_identity('any', 'google')
    assert error.value.status_code == 503


def test_google_verified_subject_never_links_email(keys, monkeypatch):
    query = Mock()
    query.filter.return_value.first.return_value = None
    db = Mock()
    db.query.return_value = query
    email_lookup = Mock(side_effect=AssertionError('email lookup is forbidden'))
    monkeypatch.setattr(social.member_service.crud, 'get_by_email', email_lookup)
    request = GoogleLoginRequest(google_id='forged', email='victim@example.com', id_token=signed(keys))
    result = social.member_service.google_login(db, request)
    assert result.success and result.data['token'] is None
    assert result.data['user']['mt_google_id'] == 'verified-subject'
    email_lookup.assert_not_called()
    db.commit.assert_not_called()


def test_apple_verified_subject_never_links_email(keys, monkeypatch):
    query = Mock()
    query.filter.return_value.first.return_value = None
    db = Mock()
    db.query.return_value = query
    email_lookup = Mock(side_effect=AssertionError('email lookup is forbidden'))
    monkeypatch.setattr(social.member_service.crud, 'get_by_email', email_lookup)
    result = social.member_service.apple_login(db, AppleLoginRequest(userIdentifier='fake', email='victim@example.com', identityToken=signed(keys, provider='apple')))
    assert result.success and result.data['user']['mt_apple_id'] == 'verified-subject'
    email_lookup.assert_not_called()
    db.commit.assert_not_called()


def test_kakao_verified_id(monkeypatch):
    monkeypatch.setattr(social.settings, 'KAKAO_ALLOWED_APP_ID', '1234')
    response = Mock(status_code=200)
    response.raise_for_status.return_value = None
    response.json.side_effect = [{'id': 987, 'app_id': 1234}, {'id': 987}]
    monkeypatch.setattr(social._provider_client, 'get', lambda *args, **kwargs: response)
    assert social.verify_kakao_identity('test-token') == '987'
    response.status_code = 401
    with pytest.raises(HTTPException) as error:
        social.verify_kakao_identity('bad-token')
    assert error.value.status_code == 401


def test_inactive_token_and_admin_denial():
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_level=1, mt_status=1, mt_show='Y')
    with pytest.raises(HTTPException) as error:
        deps.get_required_user_id(7, db)
    assert error.value.status_code == 401
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_level=2, mt_status=1, mt_show='Y')
    with pytest.raises(HTTPException) as error:
        deps.get_required_admin_id(7, db)
    assert error.value.status_code == 403
    assert users.router.dependencies


def test_invite_enforces_identity_and_flag(monkeypatch):
    with pytest.raises(HTTPException) as error:
        groups.join_group(10, groups.GroupJoinRequest(mt_idx=9, sgt_idx=10), 7, Mock())
    assert error.value.status_code == 403
    group = SimpleNamespace(sgt_idx=10, sgt_code='ABC123')
    monkeypatch.setattr(groups.settings, 'REQUIRE_GROUP_INVITE_CODE', True)
    groups._check_invite_code(group, 'abc123')
    for code in (None, 'wrong'):
        with pytest.raises(HTTPException) as error:
            groups._check_invite_code(group, code)
        assert error.value.status_code == 403
    monkeypatch.setattr(groups.settings, 'REQUIRE_GROUP_INVITE_CODE', False)
    groups._check_invite_code(group, None)


def test_public_group_has_no_invite_code():
    group = SimpleNamespace(sgt_idx=10, sgt_title='그룹', sgt_show='Y', sgt_code='secret')
    db = Mock()
    query = db.query.return_value.filter.return_value
    query.first.return_value = group
    query.count.return_value = 2
    result = groups.get_group_public_info(10, db)
    assert result['data']['sgt_title'] == '그룹'
    assert 'sgt_code' not in result['data']


def test_withdraw_transaction_and_identity_release(monkeypatch):
    user = SimpleNamespace(mt_idx=7, mt_level=2, mt_id='a@example.com', mt_email='a@example.com', mt_hp='01012345678')
    db = Mock()
    query = db.query.return_value
    query.filter.return_value.with_for_update.return_value.first.return_value = user
    db.query.side_effect = lambda model: select(GroupDetail.sgt_idx) if model is GroupDetail.sgt_idx else query
    revoked = Mock()
    monkeypatch.setattr(members.crud_refresh_token, 'revoke_all_for_member', revoked)
    result = members.withdraw_member(WithdrawRequest(mt_retire_chk=1), 7, db)
    assert result['success'] and user.mt_email is None and user.mt_hp is None
    assert user.mt_id_retire == 'a@example.com' and user.mt_id != 'a@example.com'
    assert user.mt_level == 1 and user.mt_token_id is None
    assert {call.args[0] for call in db.query.call_args_list} >= {Member, Group, GroupDetail, Location}
    revoked.assert_called_once_with(db, 7, commit=False)
    db.commit.assert_called_once()


def test_withdraw_rolls_back_on_failure(monkeypatch):
    db = Mock()
    db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = SimpleNamespace(mt_idx=7)
    db.query.return_value.filter.return_value.update.side_effect = RuntimeError('failed')
    with pytest.raises(HTTPException):
        members.withdraw_member(WithdrawRequest(mt_retire_chk=1), 7, db)
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_access_token_only_refresh_rejected():
    with pytest.raises(HTTPException) as error:
        auth.refresh_token(SimpleNamespace(headers={'authorization': 'Bearer anything'}), Mock(), None)
    assert error.value.status_code == 401


def test_verified_google_existing_user_receives_token(keys, monkeypatch):
    user = SimpleNamespace(mt_idx=7, mt_google_id='verified-subject', mt_file1='avatar')
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = user
    service = social.member_service
    monkeypatch.setattr(service.crud, 'is_active', lambda member: True)
    monkeypatch.setattr(service.crud, 'update_login_time', lambda *args, **kwargs: None)
    monkeypatch.setattr(service, '_get_user_additional_data', lambda *args: {})
    monkeypatch.setattr(service, '_build_user_data', lambda member: {'mt_idx': member.mt_idx})
    monkeypatch.setattr(social.crud_refresh_token, 'issue', lambda *args: ('refresh', None))
    result = service.google_login(db, GoogleLoginRequest(id_token=signed(keys), google_id='attacker'))
    assert result.success and result.data['token'] and result.data['user']['mt_idx'] == 7


def test_public_route_http_and_admin_forbidden():
    app = FastAPI()
    app.include_router(groups.router, prefix='/groups')
    app.include_router(users.router, prefix='/users')
    db = Mock()
    row = SimpleNamespace(sgt_idx=10, sgt_title='그룹', sgt_show='Y', sgt_code='secret', mt_level=2)
    db.query.return_value.filter.return_value.first.return_value = row
    db.query.return_value.filter.return_value.count.return_value = 2
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get('/groups/10/public')
            assert response.status_code == 200 and 'sgt_code' not in response.json()['data']
            assert (await client.get('/users/')).status_code == 403
            assert (await client.get('/groups/hidden')).status_code == 403
    import asyncio
    asyncio.run(exercise())


def test_withdrawn_email_can_be_registered(monkeypatch):
    import asyncio
    from app.tests.test_email_auth import FakeDB, registration, member, request
    monkeypatch.setattr(auth, 'verify_email_token', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'create_user', lambda db, user_in: member())
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    result = asyncio.run(auth.register_user(request(), registration(email_verification_token='verified'), FakeDB()))
    assert result.success


def test_social_registration_requires_verified_token(monkeypatch):
    import asyncio
    from app.tests.test_email_auth import FakeDB, registration, request
    monkeypatch.setattr(auth, 'verify_email_token', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.register_user(request(), registration(email_verification_token='verified', mt_google_id='unverified'), FakeDB()))
    assert error.value.status_code == 400


def test_social_registration_binds_verified_subject(keys, monkeypatch):
    import asyncio
    from app.tests.test_email_auth import FakeDB, registration, request, member
    monkeypatch.setattr(auth, 'verify_email_token', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: None)
    captured = []
    monkeypatch.setattr(auth.crud_auth, 'create_user', lambda db, user_in: captured.append(user_in) or member())
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    result = asyncio.run(auth.register_user(request(), registration(email_verification_token='verified', social_provider='google', social_token=signed(keys)), FakeDB()))
    assert result.success and captured[0].mt_google_id == 'verified-subject'


def test_fcm_unregister_requires_matching_device_token():
    db = Mock()
    user = SimpleNamespace(mt_token_id='device-token', mt_token_updated_at='date', mt_token_expiry_date='date')
    db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = user
    assert fcm_token.unregister_fcm_token(fcm_token.FCMUnregisterRequest(fcm_token='different'), 7, db)['success']
    assert user.mt_token_id == 'device-token'
    db.commit.assert_not_called()
    assert fcm_token.unregister_fcm_token(fcm_token.FCMUnregisterRequest(fcm_token='device-token'), 7, db)['success']
    assert user.mt_token_id is None
    db.commit.assert_called_once()


@pytest.mark.parametrize('level,status,show,active', [
    (None, None, None, True), (None, 1, 'Y', True), (2, None, None, True),
    (1, None, None, False), (None, 2, None, False), (None, None, 'N', False),
    (9, None, None, True), (0, 0, None, True),
])
def test_member_status_and_sql_conditions_agree(level, status, show, active):
    from sqlalchemy import create_engine, text, select
    from app.models.member import is_active_member, active_member_conditions
    member = SimpleNamespace(mt_level=level, mt_status=status, mt_show=show)
    assert is_active_member(member) is active
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE member_t (mt_level INTEGER, mt_status INTEGER, mt_show TEXT)'))
        connection.execute(text('INSERT INTO member_t (mt_level, mt_status, mt_show) VALUES (:level, :status, :show)'),
                           {'level': level, 'status': status, 'show': show})
        matches = connection.execute(select(Member.mt_level).where(*active_member_conditions())).all()
    assert bool(matches) is active


def test_null_status_login_and_refresh(monkeypatch):
    from app.tests.test_email_auth import FakeDB, member, request
    from app.schemas.auth import LoginRequestHome
    user = member(mt_level=None, mt_status=None, mt_show=None)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: user)
    monkeypatch.setattr(auth.crud_auth, 'verify_password', lambda *args: True)
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    assert auth.login_for_home_page(LoginRequestHome(mt_id='person@example.com', mt_pwd='pass'), request(), FakeDB()).success
    assert deps.get_required_user_id(7, FakeDB([user])) == 7
    monkeypatch.setattr(auth.crud_refresh_token, 'rotate', lambda *args, **kwargs: ('new-refresh', 7, None))
    assert auth.refresh_token(request(), FakeDB([user]), {'refresh_token': 'raw'})['success']


def test_kakao_checks_app_id_and_rejects_invalid_configuration(monkeypatch):
    calls = []
    def get(url, **kwargs):
        calls.append(url)
        response = Mock(status_code=200)
        response.json.return_value = {'id': 987, 'app_id': 5678}
        return response
    monkeypatch.setattr(social._provider_client, 'get', get)
    monkeypatch.setattr(social.settings, 'KAKAO_ALLOWED_APP_ID', '')
    with pytest.raises(HTTPException) as error:
        social.verify_kakao_identity('opaque')
    assert error.value.status_code == 503 and not calls
    monkeypatch.setattr(social.settings, 'KAKAO_ALLOWED_APP_ID', '1234')
    with pytest.raises(HTTPException) as error:
        social.verify_kakao_identity('opaque')
    assert error.value.status_code == 401 and len(calls) == 1


def test_kakao_rejects_different_provider_user_ids(monkeypatch):
    monkeypatch.setattr(social.settings, 'KAKAO_ALLOWED_APP_ID', '1234')
    response = Mock(status_code=200)
    response.json.side_effect = [{'id': 987, 'app_id': 1234}, {'id': 988}]
    monkeypatch.setattr(social._provider_client, 'get', lambda *args, **kwargs: response)
    with pytest.raises(HTTPException) as error:
        social.verify_kakao_identity('opaque')
    assert error.value.status_code == 503


def test_jwks_cache_reuses_and_expires(keys, monkeypatch):
    from jose import jwk
    now = [100.0]
    monkeypatch.setattr(social.time, 'monotonic', lambda: now[0])
    public = serialization.load_pem_private_key(keys, None).public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    response = Mock()
    response.json.return_value = {'keys': [dict(jwk.construct(public, algorithm='RS256').to_dict(), kid='key-1')]}
    getter = Mock(return_value=response)
    monkeypatch.setattr(social._provider_client, 'get', getter)
    token = signed(keys)
    social.verify_provider_identity(token, 'google')
    social.verify_provider_identity(token, 'google')
    assert getter.call_count == 1
    now[0] += 3601
    social.verify_provider_identity(token, 'google')
    assert getter.call_count == 2


def test_jwks_missing_kid_refreshes_once(keys, monkeypatch):
    from jose import jwk
    public = serialization.load_pem_private_key(keys, None).public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    first = Mock()
    first.json.return_value = {'keys': [dict(jwk.construct(public, algorithm='RS256').to_dict(), kid='key-1')]}
    second = Mock()
    second.json.return_value = {'keys': [dict(jwk.construct(public, algorithm='RS256').to_dict(), kid='key-2')]}
    getter = Mock(side_effect=[first, second])
    monkeypatch.setattr(social._provider_client, 'get', getter)
    social.verify_provider_identity(signed(keys), 'google')
    new_token = jwt.encode({'sub': 'rotated', 'iss': 'https://accounts.google.com', 'aud': 'client',
                            'exp': datetime.now(timezone.utc) + timedelta(minutes=1)},
                           keys, algorithm='RS256', headers={'kid': 'key-2'})
    assert social.verify_provider_identity(new_token, 'google')['sub'] == 'rotated'
    assert getter.call_count == 2


def test_jwks_provider_failure_is_not_cached(keys, monkeypatch):
    getter = Mock(side_effect=httpx.ConnectError('unavailable'))
    monkeypatch.setattr(social._provider_client, 'get', getter)
    for _ in range(2):
        with pytest.raises(HTTPException) as error:
            social.verify_provider_identity(signed(keys), 'google')
        assert error.value.status_code == 503
    assert getter.call_count == 2 and not social._jwks_cache


def test_jwks_malformed_provider_response_is_not_cached(keys, monkeypatch):
    response = Mock()
    response.json.return_value = {'keys': [{'kid': 'key-1', 'kty': 'RSA'}]}
    getter = Mock(return_value=response)
    monkeypatch.setattr(social._provider_client, 'get', getter)
    for _ in range(2):
        with pytest.raises(HTTPException) as error:
            social.verify_provider_identity(signed(keys), 'google')
        assert error.value.status_code == 503
    assert getter.call_count == 2 and not social._jwks_cache


def test_social_handlers_use_threadpool_boundary():
    import inspect
    assert not inspect.iscoroutinefunction(auth.google_login)
    assert not inspect.iscoroutinefunction(auth.apple_login)
    assert not inspect.iscoroutinefunction(auth.kakao_login)


def test_registration_provider_lookup_does_not_block_event_loop(monkeypatch):
    import asyncio
    import threading
    from app.tests.test_email_auth import FakeDB, registration, request, member
    started, release = threading.Event(), threading.Event()
    def verify(token, provider):
        started.set()
        if not release.wait(2):
            raise RuntimeError('test verification timeout')
        return {'sub': 'verified-subject'}
    monkeypatch.setattr(social, 'verify_provider_identity', verify)
    monkeypatch.setattr(auth, 'verify_email_token', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'get_user_by_phone', lambda *args: None)
    monkeypatch.setattr(auth.crud_auth, 'create_user', lambda db, user_in: member())
    monkeypatch.setattr(auth, '_issue_refresh_for', lambda *args: 'refresh')
    async def exercise():
        task = asyncio.create_task(auth.register_user(request(), registration(
            email_verification_token='verified', social_provider='google', social_token='opaque'), FakeDB()))
        try:
            assert await asyncio.to_thread(started.wait, 1)
            assert not task.done()
        finally:
            release.set()
        assert (await task).success
    asyncio.run(exercise())


def test_unknown_kid_fails_after_one_refresh(keys, monkeypatch):
    getter = Mock(wraps=social._provider_client.get)
    monkeypatch.setattr(social._provider_client, 'get', getter)
    social.verify_provider_identity(signed(keys), 'google')
    unknown = jwt.encode({'sub': 'x', 'iss': 'https://accounts.google.com', 'aud': 'client',
                          'exp': datetime.now(timezone.utc) + timedelta(minutes=1)},
                         keys, algorithm='RS256', headers={'kid': 'unknown'})
    with pytest.raises(HTTPException) as error:
        social.verify_provider_identity(unknown, 'google')
    assert error.value.status_code == 401 and getter.call_count == 2


def test_concurrent_jwks_fetch_is_shared(keys, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    import time
    from jose import jwk
    public = serialization.load_pem_private_key(keys, None).public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    response = Mock()
    response.json.return_value = {'keys': [dict(jwk.construct(public, algorithm='RS256').to_dict(), kid='key-1')]}
    def fetch(*args, **kwargs):
        time.sleep(0.02)
        return response
    getter = Mock(side_effect=fetch)
    monkeypatch.setattr(social._provider_client, 'get', getter)
    token = signed(keys)
    with ThreadPoolExecutor(max_workers=5) as pool:
        identities = list(pool.map(lambda _: social.verify_provider_identity(token, 'google')['sub'], range(5)))
    assert identities == ['verified-subject'] * 5 and getter.call_count == 1
