import logging

from jose import jwt
from starlette.requests import Request


def _build_token(mt_idx=1186):
    from app.core.config import settings

    return jwt.encode(
        {"mt_idx": mt_idx},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def _build_request(path):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )


def _build_request_with_identity(path, method="POST", client_ip="127.0.0.1", user_agent="smap/9"):
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [(b"user-agent", user_agent.encode())],
            "client": (client_ip, 12345),
        }
    )


def test_get_current_user_id_accepts_case_insensitive_bearer_prefix():
    from app.api.deps import get_current_user_id

    token = _build_token()

    assert (
        get_current_user_id(
            request=_build_request("/api/v1/member-fcm-token/register"),
            authorization=f"bearer {token}",
        )
        == 1186
    )


def test_get_current_user_id_accepts_extra_whitespace_between_prefix_and_token():
    from app.api.deps import get_current_user_id

    token = _build_token()

    assert (
        get_current_user_id(
            request=_build_request("/api/v1/member-fcm-token/register"),
            authorization=f"Bearer    {token}",
        )
        == 1186
    )


def test_get_current_user_id_logs_member_fcm_token_auth_failures(caplog):
    from app.api.deps import get_current_user_id

    with caplog.at_level(logging.WARNING):
        result = get_current_user_id(
            request=_build_request("/api/v1/member-fcm-token/register"),
            authorization="Token malformed-value",
        )

    assert result is None
    assert "member-fcm-token/register" in caplog.text
    assert "Malformed Authorization header" in caplog.text


def test_get_current_user_id_reuses_recent_authenticated_context_for_member_fcm_token(monkeypatch):
    from app.api import deps

    deps._RECENT_AUTH_CONTEXTS.clear()
    monkeypatch.setattr("app.api.deps.time.time", lambda: 1000.0)

    token = _build_token()

    user_id = deps.get_current_user_id(
        request=_build_request_with_identity("/api/v1/groups"),
        authorization=f"Bearer {token}",
    )
    assert user_id == 1186

    recovered_user_id = deps.get_current_user_id(
        request=_build_request_with_identity("/api/v1/member-fcm-token/register"),
        authorization=None,
    )
    assert recovered_user_id == 1186


def test_get_current_user_id_does_not_reuse_stale_authenticated_context(monkeypatch):
    from app.api import deps

    deps._RECENT_AUTH_CONTEXTS.clear()
    times = iter([1000.0, 1301.0])
    monkeypatch.setattr("app.api.deps.time.time", lambda: next(times, 1301.0))

    token = _build_token()

    user_id = deps.get_current_user_id(
        request=_build_request_with_identity("/api/v1/groups"),
        authorization=f"Bearer {token}",
    )
    assert user_id == 1186

    recovered_user_id = deps.get_current_user_id(
        request=_build_request_with_identity("/api/v1/member-fcm-token/register"),
        authorization=None,
    )
    assert recovered_user_id is None
