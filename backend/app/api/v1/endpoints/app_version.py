"""
앱 최소 지원 버전 체크 엔드포인트.
구버전 클라이언트가 앱 시작 시 호출하면 강제 업데이트 필요 여부를 알려준다.
"""
from typing import Tuple
from fastapi import APIRouter, Query
from app.core.config import settings

router = APIRouter()


def _parse_version(v: str) -> Tuple[int, ...]:
    """'3.0.8' 같은 점 구분 버전을 튜플로 변환. 비숫자/공백은 0 처리."""
    parts = []
    for chunk in (v or "").split("."):
        chunk = chunk.strip()
        try:
            parts.append(int(chunk))
        except ValueError:
            digits = "".join(c for c in chunk if c.isdigit())
            parts.append(int(digits) if digits else 0)
    return tuple(parts) if parts else (0,)


def _is_lower(current: str, minimum: str) -> bool:
    return _parse_version(current) < _parse_version(minimum)


@router.get("/version-check")
def version_check(
    platform: str = Query(..., description="ios | android"),
    version: str = Query(..., description="현재 앱 버전, 예: 3.0.8"),
):
    """
    구버전 차단 정책. 강제 업데이트가 필요하면 update_required=true.
    """
    plat = (platform or "").lower()
    if plat == "ios":
        min_v = settings.MIN_APP_VERSION_IOS
    else:
        min_v = settings.MIN_APP_VERSION_ANDROID

    needs_update = _is_lower(version, min_v)
    return {
        "platform": plat,
        "current_version": version,
        "min_supported_version": min_v,
        "update_required": needs_update,
        # 정책상 둘 다 동일하게 강제. 분리하고 싶을 때를 대비해 키만 분리.
        "force_update": needs_update,
    }
