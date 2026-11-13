from datetime import datetime, timedelta
from types import SimpleNamespace


class _FakeQuery:
    def __init__(self, member):
        self._member = member

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._member


class _FakeSession:
    def __init__(self, member):
        self._member = member
        self.committed = False
        self.closed = False

    def query(self, model):
        return _FakeQuery(self._member)

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


class _FakeFile:
    def __init__(self):
        self.contents = []

    def write(self, value):
        self.contents.append(value)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeSendResponse:
    def __init__(self, success, exception=None):
        self.success = success
        self.exception = exception


class _FakeBatchResponse:
    def __init__(self, responses):
        self.responses = responses


class _FakeUnregisteredError(Exception):
    pass


def _fake_get_db(session):
    def _generator():
        yield session

    return _generator


def test_should_invalidate_unregistered_token_when_token_is_stale(monkeypatch):
    from app.services.firebase_service import FirebaseService

    member = SimpleNamespace(
        mt_idx=1186,
        mt_token_id="dead-token",
        mt_token_updated_at=datetime.now() - timedelta(days=2),
        mt_token_expiry_date=datetime.now() + timedelta(days=80),
    )
    session = _FakeSession(member)

    monkeypatch.setattr("app.db.session.get_db", _fake_get_db(session))

    service = FirebaseService()

    assert service._should_invalidate_token("dead-token", "unregistered") is True


def test_should_not_invalidate_recently_updated_token(monkeypatch):
    from app.services.firebase_service import FirebaseService

    member = SimpleNamespace(
        mt_idx=1186,
        mt_token_id="fresh-token",
        mt_token_updated_at=datetime.now() - timedelta(hours=6),
        mt_token_expiry_date=datetime.now() + timedelta(days=80),
    )
    session = _FakeSession(member)

    monkeypatch.setattr("app.db.session.get_db", _fake_get_db(session))

    service = FirebaseService()

    assert service._should_invalidate_token("fresh-token", "unregistered") is False


def test_handle_token_invalidation_clears_member_token(monkeypatch):
    from app.services.firebase_service import FirebaseService

    member = SimpleNamespace(
        mt_idx=1186,
        mt_id="jin",
        mt_name="정진",
        mt_push1="Y",
        mt_token_id="dead-token",
        mt_token_updated_at=datetime.now() - timedelta(days=2),
        mt_token_expiry_date=datetime.now() + timedelta(days=80),
        mt_udate=None,
    )
    session = _FakeSession(member)
    fake_file = _FakeFile()

    monkeypatch.setattr("app.db.session.get_db", _fake_get_db(session))
    monkeypatch.setattr("builtins.open", lambda *args, **kwargs: fake_file)

    service = FirebaseService()
    service._handle_token_invalidation("dead-token", "unregistered")

    assert member.mt_token_id is None
    assert member.mt_token_updated_at is None
    assert member.mt_token_expiry_date is None
    assert member.mt_udate is not None
    assert session.committed is True


def test_send_batch_push_invalidates_unregistered_tokens(monkeypatch):
    from app.services.firebase_service import FirebaseService

    calls = []

    service = FirebaseService()
    service._firebase_available = True

    monkeypatch.setattr(
        "app.services.firebase_service.messaging.send_each",
        lambda messages: _FakeBatchResponse(
            [_FakeSendResponse(False, _FakeUnregisteredError("Requested entity was not found."))]
        ),
    )
    monkeypatch.setattr(
        service,
        "_should_invalidate_token",
        lambda token, reason: calls.append(("check", token, reason)) or True,
    )
    monkeypatch.setattr(
        service,
        "_handle_token_invalidation",
        lambda token, reason, title=None, content=None: calls.append(("invalidate", token, reason)),
    )

    responses = service.send_batch_push([SimpleNamespace(token="dead-token")])

    assert responses[0].success is False
    assert calls == [
        ("check", "dead-token", "unregistered"),
        ("invalidate", "dead-token", "unregistered"),
    ]
