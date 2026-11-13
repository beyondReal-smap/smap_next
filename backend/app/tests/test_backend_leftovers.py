import asyncio
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi import FastAPI, HTTPException

from app.api import deps
from app.api.v1.endpoints import auth, email_auth, groups, members, member_location_log
from app.core.config import settings
from app.tests.test_email_auth import FakeRedis, request


def test_change_email_full_flow_and_identity(monkeypatch):
    redis = FakeRedis()
    sent = []
    async def send(email, code):
        sent.append(code)
        return True
    monkeypatch.setattr(email_auth, '_redis', lambda: redis)
    monkeypatch.setattr(email_auth.email_service, 'send_verification_code', send)
    monkeypatch.setattr(deps, 'get_required_user_id', lambda uid, db: int(uid))
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = None
    user = SimpleNamespace(mt_idx=7, mt_id='01012345678', mt_email=None, mt_level=2, mt_status=1, mt_show='Y')
    db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = user
    revoke = Mock()
    monkeypatch.setattr(email_auth.crud_refresh_token, 'revoke_all_for_member', revoke)
    asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email=' New@Example.com ', purpose='change_email'), request(), db, 7))
    data = email_auth.EmailVerifyRequest(email='new@example.com', purpose='change_email', code=sent[0])
    with pytest.raises(HTTPException) as err:
        email_auth.verify_email_code(data, db, 8)
    assert err.value.status_code == 400
    token = email_auth.verify_email_code(data, db, 7).verification_token
    change = email_auth.EmailChangeRequest(email='new@example.com', verification_token=token)
    with pytest.raises(HTTPException) as err:
        email_auth.change_email(change, 8, db)
    assert err.value.status_code == 403
    assert email_auth.change_email(change, 7, db).success
    assert user.mt_email == 'new@example.com' and user.mt_id == '01012345678'
    revoke.assert_not_called()
    with pytest.raises(HTTPException) as err:
        email_auth.change_email(change, 7, db)
    assert err.value.status_code == 400
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=8)
    with pytest.raises(HTTPException) as err:
        asyncio.run(email_auth.send_email_code(email_auth.EmailRequest(email='new@example.com', purpose='change_email'), request(), db, 7))
    assert err.value.status_code == 409
    with pytest.raises(HTTPException) as err:
        email_auth.change_email(change, 7, db)
    assert err.value.status_code == 409


def test_change_email_requires_login():
    app = FastAPI()
    app.include_router(email_auth.router, prefix='/auth')
    app.dependency_overrides[deps.get_db] = lambda: Mock()
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.post('/auth/email/send-code', json={'email': 'new@example.com', 'purpose': 'change_email'})).status_code == 401
            assert (await client.post('/auth/email/change', json={'email': 'new@example.com', 'verification_token': 'invalid'})).status_code == 401
    asyncio.run(exercise())


def test_reset_link_configuration_privacy_and_delivery_failure(monkeypatch):
    from app.schemas.auth import ForgotPasswordRequest
    from app.services.email_service import email_service
    monkeypatch.setattr(settings, 'PASSWORD_RESET_EXPIRE_MINUTES', 45)
    monkeypatch.setattr(settings, 'PASSWORD_RESET_BASE_URL', 'https://test.example')
    user = SimpleNamespace(mt_idx=7, mt_level=2, mt_status=1, mt_show='Y')
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = user
    urls = []
    async def send(email, url):
        urls.append(url)
        return {'success': True}
    monkeypatch.setattr(email_service, 'send_password_reset_email', send)
    data = ForgotPasswordRequest(type='email', contact='user@example.com')
    result = asyncio.run(auth.forgot_password(data, db))
    assert result.success and urls[0].startswith('https://test.example/r?t=')
    assert timedelta(minutes=44) < user.mt_token_edate - datetime.utcnow() <= timedelta(minutes=45)
    db.query.return_value.filter.return_value.first.return_value = None
    assert asyncio.run(auth.forgot_password(data, db)).model_dump() == result.model_dump()
    db.query.return_value.filter.return_value.first.return_value = user
    async def fail(*args):
        return {'success': False}
    monkeypatch.setattr(email_service, 'send_password_reset_email', fail)
    assert not asyncio.run(auth.forgot_password(data, db)).success


def test_weak_password_http_400_all_three_paths():
    app = FastAPI()
    app.include_router(auth.router, prefix='/auth')
    app.include_router(members.router, prefix='/members')
    app.dependency_overrides[deps.get_db] = lambda: Mock()
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for path, body in [('/auth/reset-password', {'token':'12345678','new_password':'weak'}), ('/auth/reset-password-by-phone', {'phone':'01012345678','verification_code':'123456','new_password':'weak'}), ('/members/change-password', {'currentPassword':'old','newPassword':'weak'})]:
                assert (await client.post(path, json=body)).status_code == 400, path
    asyncio.run(exercise())


def test_group_creation_rolls_back_membership_failure(monkeypatch):
    from app.schemas.group import GroupCreate
    db = Mock()
    def add(value):
        if isinstance(value, groups.Group):
            value.sgt_idx = 4
    db.add.side_effect = add
    db.flush.side_effect = [None, RuntimeError('membership failure')]
    monkeypatch.setattr(groups, 'generate_sgt_code', lambda db: 'TEST')
    with pytest.raises(HTTPException) as err:
        groups.create_group(GroupCreate(sgt_title='test'), db, 7)
    assert err.value.status_code == 500
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_myplays_row_mapping_and_error_propagation():
    from app.models.location import Location
    db = Mock()
    db.execute.return_value = [SimpleNamespace(_mapping={'slt_idx': 4, 'mt_idx': 7})]
    for fn in (Location.get_in_myplays_list, Location.get_out_myplays_list):
        assert fn(db) == [{'slt_idx': 4, 'mt_idx': 7}]
    db.execute.side_effect = RuntimeError('database failure')
    for fn in (Location.get_in_myplays_list, Location.get_out_myplays_list):
        with pytest.raises(RuntimeError):
            fn(db)


def test_terms_and_unique_location_paths():
    app = FastAPI()
    app.include_router(members.router, prefix='/members')
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            result = await client.get('/members/terms')
            assert result.status_code == 200
            assert {'last_updated','is_required','db_field'} <= result.json()['data'][0].keys()
    asyncio.run(exercise())
    routes = [(route.path, tuple(sorted(route.methods))) for route in member_location_log.router.routes]
    assert len(routes) == len(set(routes))
    assert any(path.endswith('/daily-path') for path, methods in routes)


def test_group_soft_delete_hides_children():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.group import Group
    from app.models.group_detail import GroupDetail
    from app.models.schedule import Schedule
    from app.models.location import Location
    engine = create_engine('sqlite:///:memory:')
    for model in (Group, GroupDetail, Schedule, Location):
        model.__table__.create(engine)
    with Session(engine) as db:
        group = Group(sgt_idx=4, mt_idx=7, sgt_show='Y')
        db.add_all([group, GroupDetail(sgdt_idx=1, sgt_idx=4, mt_idx=7, sgdt_show='Y'), Schedule(sst_idx=1, sgt_idx=4, sst_show='Y'), Location(slt_idx=1, sgt_idx=4, mt_idx=7, slt_show='Y')])
        db.commit()
        group.soft_delete(db)
        db.expire_all()
        for model, field in [(GroupDetail,'sgdt_show'),(Schedule,'sst_show'),(Location,'slt_show')]:
            assert getattr(db.query(model).first(), field).value == 'N'


def test_socket_cors_whitelist():
    from app.websocket.chat_ws import sio
    assert sio.eio.cors_allowed_origins == settings.BACKEND_CORS_ORIGINS
    assert '*' not in sio.eio._cors_allowed_origins({'HTTP_ORIGIN': 'https://untrusted.example'})


def test_email_sender_does_not_claim_mock_delivery(monkeypatch):
    from app.services.email_service import email_service
    monkeypatch.setenv('NODE_ENV', 'development')
    monkeypatch.setattr(email_service, 'naverworks_client_id', None)
    assert not asyncio.run(email_service.send_password_reset_email('user@example.com', 'https://example.com/r?t=sample'))['success']


def test_socket_origin_handshake_without_network():
    import engineio
    async def exercise():
        server = engineio.AsyncServer(async_mode='asgi', cors_allowed_origins=settings.BACKEND_CORS_ORIGINS, monitor_clients=False)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=engineio.ASGIApp(server)), base_url='http://test') as client:
            assert (await client.get('/engine.io/?EIO=4&transport=polling')).status_code == 200
            assert (await client.get('/engine.io/?EIO=4&transport=polling', headers={'Origin': 'https://untrusted.example'})).status_code == 400
            assert (await client.get('/engine.io/?EIO=4&transport=polling', headers={'Origin': settings.BACKEND_CORS_ORIGINS[0]})).status_code == 200
        for socket in list(server.sockets.values()):
            await socket.close(wait=False, abort=True)
    asyncio.run(exercise())


def test_start_script_password_guard_without_running_script():
    import os
    import subprocess
    from pathlib import Path
    text = Path(__file__).resolve().parents[2].joinpath('start.sh').read_text()
    guard = text.splitlines()[2]
    assert guard.startswith(': "${MYSQL_PASSWORD:?')
    result = subprocess.run(['bash', '-c', guard], env={key: value for key, value in os.environ.items() if key != 'MYSQL_PASSWORD'}, capture_output=True)
    assert result.returncode != 0
    assert 'Using SQLALCHEMY_DATABASE_URI:' not in text


def test_legacy_email_mutation_requires_verification():
    from app.schemas.member import MemberUpdate
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=7, mt_email=None)
    with pytest.raises(HTTPException) as err:
        members.update_member(7, MemberUpdate(mt_email='new@example.com'), 7, db)
    assert err.value.status_code == 400
    db.commit.assert_not_called()


def test_restore_only_children_hidden_by_group_deletion():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.group import Group
    from app.models.group_detail import GroupDetail
    from app.models.schedule import Schedule
    from app.models.location import Location
    engine = create_engine('sqlite:///:memory:')
    for model in (Group, GroupDetail, Schedule, Location):
        model.__table__.create(engine)
    with Session(engine) as db:
        group = Group(sgt_idx=4, mt_idx=7, sgt_show='Y')
        db.add_all([group, GroupDetail(sgdt_idx=1, sgt_idx=4, mt_idx=7, sgdt_show='Y', sgdt_exit='N', sgdt_discharge='N'), Schedule(sst_idx=1, sgt_idx=4, sst_show='Y'), Location(slt_idx=1, sgt_idx=4, mt_idx=7, slt_show='Y'), Location(slt_idx=2, sgt_idx=4, mt_idx=7, slt_show='N')])
        db.commit()
        group.soft_delete(db)
        groups.restore_group(4, 7, db)
        db.expire_all()
        assert db.query(Location).filter(Location.slt_idx == 1).first().slt_show.value == 'Y'
        assert db.query(Location).filter(Location.slt_idx == 2).first().slt_show.value == 'N'
        assert db.query(Schedule).first().sst_show.value == 'Y'
        assert db.query(GroupDetail).first().sgdt_show.value == 'Y'


def test_add_member_restores_active_status(monkeypatch):
    from app.api.v1.endpoints import group_members
    db = Mock()
    group = SimpleNamespace(sgt_idx=4, sgt_title='test', sgt_show='Y', sgt_code='TEST')
    member = SimpleNamespace(mt_idx=7, mt_name='member', mt_id='user')
    membership = SimpleNamespace(sgdt_idx=3, sgdt_show='N', sgdt_exit='N', sgdt_discharge='Y', sgdt_owner_chk='N', sgdt_leader_chk='N', sgdt_wdate=None)
    db.query.return_value.filter.return_value.first.side_effect = [group, member, membership]
    result = group_members.add_member_to_group(4, 7, 'TEST', 7, db)
    assert result['success']
    assert (membership.sgdt_show, membership.sgdt_exit, membership.sgdt_discharge) == ('Y', 'N', 'N')
