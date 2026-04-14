"""공용 응답 유틸리티.

표준화된 API 응답 포맷을 제공합니다.
"""
from typing import Any, Dict, Optional

from pydantic import BaseModel


class APIResponse(BaseModel):
    """표준 API 응답 모델"""
    success: bool
    message: str
    data: Optional[Any] = None


def success_response(
    data: Optional[Any] = None,
    message: str = "요청이 성공적으로 처리되었습니다.",
) -> Dict[str, Any]:
    """성공 응답을 생성합니다."""
    return {"success": True, "message": message, "data": data}


def error_response(
    message: str = "요청 처리 중 오류가 발생했습니다.",
    data: Optional[Any] = None,
) -> Dict[str, Any]:
    """실패 응답을 생성합니다."""
    return {"success": False, "message": message, "data": data}


# ---------------------------------------------------------------------------
# Legacy 호환성 유지
# ---------------------------------------------------------------------------
SUCCESS: int = 200
FAILURE: int = 400


def create_response(
    result_code: int, result_msg: str, result_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """레거시 응답 포맷 (하위 호환성)"""
    return {
        "resultCode": result_code,
        "resultMsg": result_msg,
        "resultData": result_data,
    }
