import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
from fastapi import FastAPI

from app.api import deps
from app.api.v1.endpoints import member_location_log as logs


def test_location_log_identity_and_group_access(monkeypatch):
    app = FastAPI()
    app.include_router(logs.router, prefix='/logs')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    monkeypatch.setattr(logs.location_log_crud, 'create_location_log', lambda db, data: SimpleNamespace(to_dict=lambda: {'mt_idx': data.mt_idx}))
    monkeypatch.setattr(logs.location_log_crud, 'get_member_location_logs', lambda *args: [])

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.post('/logs/member-location-logs', json={'act': 'create_location_log', 'mt_idx': 7})).status_code == 401
            app.dependency_overrides[deps.get_required_user_id] = lambda: 7
            assert (await client.post('/logs/member-location-logs', json={'act': 'create_location_log', 'mt_idx': 8})).status_code == 403
            response = await client.post('/logs/member-location-logs', json={'act': 'create_location_log', 'mt_idx': 7, 'mlt_gps_time': '2026-01-01T00:00:00'})
            assert response.status_code == 200 and response.json()['data']['mt_idx'] == 7
            db.query.return_value.join.return_value.filter.return_value.first.return_value = None
            assert (await client.get('/logs/member-location-logs/8')).status_code == 403
            assert (await client.get('/logs/member-location-logs/7')).status_code == 200
            db.query.return_value.filter.return_value.first.return_value = None
            assert (await client.get('/logs/members-with-logs', params={'group_id': 4, 'date': '2026-01-01'})).status_code == 403
            db.query.return_value.filter.return_value.first.return_value = object()
            db.query.return_value.filter.return_value.all.return_value = [(7,)]
            monkeypatch.setattr(logs.location_log_crud, 'get_members_with_logs_by_date', lambda db, date: [7, 8])
            response = await client.get('/logs/members-with-logs', params={'group_id': 4, 'date': '2026-01-01'})
            assert response.status_code == 200 and response.json() == [7]
    asyncio.run(exercise())


def test_group_owner_required_and_owner_cannot_leave():
    from app.api.v1.endpoints import group_members
    app = FastAPI()
    app.include_router(group_members.router, prefix='/group-members')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.delete('/group-members/4/member/8')).status_code == 401
            app.dependency_overrides[deps.get_required_user_id] = lambda: 7
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(sgdt_owner_chk='N')
            assert (await client.delete('/group-members/4/member/8')).status_code == 403
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(sgdt_owner_chk='Y')
            assert (await client.delete('/group-members/4/member/7')).status_code == 403
            assert (await client.delete('/group-members/4/member/8')).status_code == 403
            owner = SimpleNamespace(sgdt_owner_chk='Y')
            target = SimpleNamespace(sgdt_owner_chk='N', sgdt_show='Y', sgdt_exit='N', sgdt_discharge='N')
            db.query.return_value.filter.return_value.first.side_effect = [owner, target]
            assert (await client.delete('/group-members/4/member/8')).status_code == 200
            assert (target.sgdt_show, target.sgdt_exit, target.sgdt_discharge) == ('N', 'Y', 'N')
    asyncio.run(exercise())


def test_other_domain_routes_require_authentication():
    from app.api.v1.endpoints import members, groups, locations, schedules, group_schedule_manage, member_fcm_token
    app = FastAPI()
    for prefix, router in [('/members', members.router), ('/groups', groups.router), ('/locations', locations.router), ('/schedules', schedules.router), ('/schedule', group_schedule_manage.router), ('/member-fcm-token', member_fcm_token.router)]:
        app.include_router(router, prefix=prefix)
    app.dependency_overrides[deps.get_db] = lambda: Mock()

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for path in ['/members/', '/groups/', '/locations/member/7', '/schedules/group/4', '/schedule/group/4/schedules', '/member-fcm-token/status/7']:
                assert (await client.get(path)).status_code == 401, path
    asyncio.run(exercise())


def test_member_location_and_fcm_ownership(monkeypatch):
    from app.api.v1.endpoints import members, locations, member_fcm_token, fcm_token
    app = FastAPI()
    app.include_router(members.router, prefix='/members')
    app.include_router(locations.router, prefix='/locations')
    app.include_router(member_fcm_token.router, prefix='/member-fcm-token')
    app.include_router(fcm_token.router, prefix='/fcm-token')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    place = SimpleNamespace(mt_idx=8)
    db.query.return_value.filter.return_value.first.return_value = place
    monkeypatch.setattr(locations.Location, 'find_by_member', lambda db, member_id: [])

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.delete('/members/8')).status_code == 403
            assert (await client.put('/locations/3', json={'slt_title': 'x'})).status_code == 403
            assert (await client.post('/locations/', json={'mt_idx': 8})).status_code == 403
            assert (await client.get('/locations/member/7')).status_code == 200
            assert (await client.delete('/members/7')).status_code == 200
            db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = SimpleNamespace(mt_token_id=None)
            assert (await client.post('/fcm-token/unregister', json={'fcm_token': 'sample'})).status_code == 200
            assert (await client.post('/member-fcm-token/validate-and-refresh', json={'mt_idx': 8, 'fcm_token': 'sample-token-for-testing-123'})).status_code == 403
            assert (await client.post('/member-fcm-token/background-check', json={'mt_idx': 8, 'fcm_token': 'sample-token-for-testing-123'})).status_code == 403
    asyncio.run(exercise())


def test_schedule_uses_token_identity(monkeypatch):
    from app.api.v1.endpoints import group_schedule_manage as schedule
    app = FastAPI()
    app.include_router(schedule.router, prefix='/schedule')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    membership = Mock()
    monkeypatch.setattr(deps, 'require_group_member', membership)
    monkeypatch.setattr(schedule.GroupScheduleManager, 'check_group_permission', lambda db, uid, group: None)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/schedule/group/4/schedules', params={'current_user_id': 8})
            assert response.status_code == 403
            membership.assert_called_once_with(db, 7, 4)
            permission = Mock(return_value={'sgdt_owner_chk': 'N', 'sgdt_leader_chk': 'N'})
            monkeypatch.setattr(schedule.GroupScheduleManager, 'check_group_permission', permission)
            monkeypatch.setattr(schedule.GroupScheduleManager, 'get_group_members', lambda db, group: [])
            db.execute.return_value.fetchall.return_value = []
            response = await client.get('/schedule/group/4/schedules', params={'current_user_id': 8})
            assert response.status_code == 200
            permission.assert_called_once_with(db, 7, 4)
    asyncio.run(exercise())


def test_group_detail_membership_access(monkeypatch):
    from fastapi import HTTPException
    from app.api.v1.endpoints import group_details
    app = FastAPI()
    app.include_router(group_details.router, prefix='/group-details')
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(sgdt_idx=5, sgt_idx=4, mt_idx=8)
    app.dependency_overrides[deps.get_db] = lambda: db

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.get('/group-details/5')).status_code == 401
            app.dependency_overrides[deps.get_required_user_id] = lambda: 7
            monkeypatch.setattr(deps, 'require_group_member', Mock(side_effect=HTTPException(status_code=403)))
            assert (await client.get('/group-details/5')).status_code == 403
            monkeypatch.setattr(deps, 'require_group_member', Mock())
            assert (await client.get('/group-details/5')).status_code == 200
    asyncio.run(exercise())


def test_shared_group_requires_active_membership():
    import pytest
    from fastapi import HTTPException
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.group_detail import GroupDetail
    engine = create_engine('sqlite:///:memory:')
    GroupDetail.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            GroupDetail(sgdt_idx=1, sgt_idx=4, mt_idx=7, sgdt_exit='N', sgdt_discharge='N', sgdt_show='Y', sgdt_owner_chk='Y'),
            GroupDetail(sgdt_idx=2, sgt_idx=4, mt_idx=8, sgdt_exit='N', sgdt_discharge='N', sgdt_show='Y', sgdt_owner_chk='N'),
        ])
        db.commit()
        deps.require_same_group_or_self(db, 7, 8)
        assert deps.require_group_owner(db, 7, 4).mt_idx == 7
        with pytest.raises(HTTPException) as error:
            deps.require_group_owner(db, 8, 4)
        assert error.value.status_code == 403
        member = db.query(GroupDetail).filter(GroupDetail.mt_idx == 8).first()
        member.sgdt_exit = 'Y'
        db.commit()
        with pytest.raises(HTTPException) as error:
            deps.require_same_group_or_self(db, 7, 8)
        assert error.value.status_code == 403


def test_group_owner_transfer_updates_memberships(monkeypatch):
    from app.api.v1.endpoints import groups
    from app.schemas.group import GroupUpdate
    owner = SimpleNamespace(sgdt_owner_chk='Y')
    successor = SimpleNamespace(sgdt_owner_chk='N', sgdt_leader_chk='Y')
    group = SimpleNamespace(sgt_idx=4, mt_idx=7, sgt_show='Y', sgt_title='group')
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = group
    monkeypatch.setattr(deps, 'require_group_owner', lambda db, user, group: owner)
    monkeypatch.setattr(deps, 'require_group_member', lambda db, user, group: successor)
    groups.update_group(4, GroupUpdate(mt_idx=8), 7, db)
    assert (group.mt_idx, owner.sgdt_owner_chk, successor.sgdt_owner_chk, successor.sgdt_leader_chk) == (8, 'N', 'Y', 'N')
    db.commit.assert_called_once()


def test_followup_push_weather_orders_and_admin(monkeypatch):
    from app.api.v1.endpoints import push_logs, push_fcms, weather, orders
    from app.core import cache
    app = FastAPI()
    for prefix, module in [('push-logs', push_logs), ('push-fcms', push_fcms), ('weather', weather), ('orders', orders)]:
        app.include_router(module.router, prefix='/' + prefix)
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    row = SimpleNamespace(plt_idx=3, mt_idx=8, pft_idx=3, pft_send_mt_idx=8)
    monkeypatch.setattr(push_logs.PushLog, 'find_by_idx', lambda db, idx: row)
    monkeypatch.setattr(push_fcms.PushFCM, 'find_by_idx', lambda db, idx: row)
    monkeypatch.setattr(orders.crud.crud_order, 'get', lambda **kwargs: row)
    monkeypatch.setattr(orders.crud.crud_order, 'update_order_status', lambda **kwargs: {'mt_idx': row.mt_idx})
    monkeypatch.setattr(cache, 'cache_get', lambda *args: None)
    monkeypatch.setattr(cache, 'cache_set', lambda *args: None)
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=7, mt_name='user', mt_weather_sky=1, mt_weather_tmx=20, mt_weather_tmn=10, mt_weather_pop='0', mt_sido=None, mt_gu=None, mt_weather_date=None, mt_level=2)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for path in ['/push-logs/3', '/push-fcms/3', '/weather/member/7', '/orders/detail/3']:
                assert (await client.get(path)).status_code == 401, path
            app.dependency_overrides[deps.get_required_user_id] = lambda: 7
            for method, path in [('GET', '/push-logs/3'), ('PATCH', '/push-logs/3/read'), ('DELETE', '/push-logs/3'), ('GET', '/push-fcms/3'), ('POST', '/push-fcms/mark-delivered/3'), ('DELETE', '/push-fcms/3'), ('GET', '/weather/member/8'), ('PUT', '/weather/member/8'), ('GET', '/orders/detail/3')]:
                assert (await client.request(method, path, json={})).status_code == 403, path
            assert (await client.put('/orders/status/3?status=2')).status_code == 403
            for path in ['/push-logs/', '/push-fcms/', '/push-fcms/code/test']:
                assert (await client.get(path)).status_code == 403
            row.mt_idx = row.pft_send_mt_idx = 7
            for path in ['/push-logs/3', '/push-fcms/3', '/weather/member/7']:
                assert (await client.get(path)).status_code == 200, path
            assert (await client.patch('/push-logs/3/read')).status_code == 200
            assert (await client.post('/push-fcms/mark-delivered/3')).status_code == 200
            assert (await client.put('/orders/status/3?status=2')).status_code == 200
            row.mt_idx = None
            assert (await client.get('/push-logs/3')).status_code == 403
    asyncio.run(exercise())


def test_lookup_rate_limit_and_unused_checks(monkeypatch):
    import pytest
    from fastapi import HTTPException
    from app.api.v1.endpoints import members, email_auth
    from app.tests.test_email_auth import FakeRedis, request
    redis = FakeRedis()
    monkeypatch.setattr(email_auth, '_redis', lambda: redis)
    req = request()
    for _ in range(20):
        members._limit_account_lookup(req)
    with pytest.raises(HTTPException) as error:
        members._limit_account_lookup(req)
    assert error.value.status_code == 429
    redis.incr = Mock(side_effect=ConnectionError())
    with pytest.raises(HTTPException) as error:
        members._limit_account_lookup(req)
    assert error.value.status_code == 503
    app = FastAPI()
    app.include_router(members.router, prefix='/members')
    app.dependency_overrides[deps.get_db] = lambda: Mock()
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for path in ['/members/check/email/test@example.com', '/members/check/nickname/test']:
                assert (await client.get(path)).status_code == 401
    asyncio.run(exercise())


def test_chat_inactive_and_legacy_paths(monkeypatch):
    from app.api.v1.endpoints import chats, members, auth
    from app.schemas.auth import LoginResponseHome
    app = FastAPI()
    for prefix, module in [('chats', chats), ('members', members), ('auth', auth)]:
        app.include_router(module.router, prefix='/' + prefix)
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_current_user_id] = lambda: 7
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=7, mt_level=1, mt_status=1, mt_show='Y')
    monkeypatch.setattr(chats.chat_service, 'get_rooms_for_member', lambda *args: [])
    import importlib
    social_service = importlib.import_module('app.services.member_service')
    monkeypatch.setattr(social_service.settings, 'GOOGLE_ALLOWED_CLIENT_IDS', 'test-client')
    shared_login = Mock(return_value=LoginResponseHome(success=True, message='ok', data={'user': {'mt_idx': 7}}))
    monkeypatch.setattr(auth, 'login_for_home_page', shared_login)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.get('/chats/rooms')).status_code == 401
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=7, mt_level=2, mt_status=2, mt_show='Y')
            assert (await client.get('/chats/rooms')).status_code == 401
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_idx=7, mt_level=2, mt_status=1, mt_show='Y')
            assert (await client.get('/chats/rooms')).status_code == 200
            assert (await client.post('/auth/login-original', json={'mt_hp': '01012345678', 'mt_pass': 'test'})).status_code == 403
            response = await client.post('/members/login', json={'mt_id': 'a@example.com', 'mt_pwd': 'test'})
            assert response.status_code == 200 and response.json()['data'] == {'user': {'mt_idx': 7}}
            shared_login.assert_called_once()
            assert (await client.post('/members/google-login', json={'google_id': 'forged', 'email': 'a@example.com'})).status_code == 401
    asyncio.run(exercise())


def test_weather_cache_cannot_bypass_owner(monkeypatch):
    from app.api.v1.endpoints import weather
    from app.core import cache
    app = FastAPI()
    app.include_router(weather.router, prefix='/weather')
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    app.dependency_overrides[deps.get_db] = lambda: Mock()
    cached = Mock(return_value={'mt_idx': 8})
    monkeypatch.setattr(cache, 'cache_get', cached)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.get('/weather/member/8')).status_code == 403
            cached.assert_not_called()
    asyncio.run(exercise())


def test_push_now_admin_and_no_shadowing(monkeypatch):
    from app.api.v1.endpoints import push_fcms
    app = FastAPI()
    app.include_router(push_fcms.router, prefix='/push-fcms')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    monkeypatch.setattr(push_fcms.PushFCM, 'find_push_list', lambda db: [])
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.get('/push-fcms/now')).status_code == 401
            app.dependency_overrides[deps.get_required_user_id] = lambda: 7
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_level=2, mt_status=1, mt_show='Y')
            assert (await client.get('/push-fcms/now')).status_code == 403
            db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(mt_level=9, mt_status=1, mt_show='Y')
            assert (await client.get('/push-fcms/now')).status_code == 200
    asyncio.run(exercise())


def test_redacted_profile_fields(monkeypatch):
    from app.api.v1.endpoints import members
    from app.models.member import Member
    from app.models.group_detail import GroupDetail
    app = FastAPI()
    app.include_router(members.router, prefix='/members')
    db = Mock()
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_required_user_id] = lambda: 7
    row = Member(mt_idx=8, mt_id='private', mt_hp='private', mt_email='private@example.com', mt_name='member', mt_nickname='nick')
    db.query.return_value.filter.return_value.first.return_value = row
    db.query.return_value.join.return_value.filter.return_value.all.return_value = [(row, GroupDetail(sgdt_idx=2, sgt_idx=4, mt_idx=8))]
    monkeypatch.setattr(deps, 'require_same_group_or_self', lambda *args: None)
    monkeypatch.setattr(deps, 'require_group_member', lambda *args: None)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            profile = await client.get('/members/8')
            assert profile.status_code == 200
            assert profile.json()['mt_id'] == ''
            assert profile.json()['mt_hp'] is None and profile.json()['mt_email'] is None
            group = await client.get('/members/group/4')
            assert group.status_code == 200
            for field in ['mt_id', 'mt_hp', 'mt_email', 'mt_birth']:
                assert field not in group.json()[0]
    asyncio.run(exercise())


def test_public_phone_lookup_limit_cannot_be_evaded_by_changing_phone(monkeypatch):
    from app.api.v1.endpoints import members, email_auth
    from app.tests.test_email_auth import FakeRedis
    redis = FakeRedis()
    monkeypatch.setattr(email_auth, '_redis', lambda: redis)
    available = Mock(return_value=True)
    monkeypatch.setattr(members.member_service, 'check_phone_availability', available)
    app = FastAPI()
    app.include_router(members.router, prefix='/members')
    app.dependency_overrides[deps.get_db] = lambda: Mock()
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for value in range(20):
                assert (await client.get(f'/members/check/phone/0101234{value:04}')).status_code == 200
            assert (await client.get('/members/check/phone/01099999999')).status_code == 429
            assert available.call_count == 20
    asyncio.run(exercise())
