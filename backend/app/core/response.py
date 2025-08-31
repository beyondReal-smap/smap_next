"""공용 응답 유틸리티.

FCM 토큰 엔드포인트 등에서 사용하는 표준 응답 포맷을 제공합니다.
resultCode / resultMsg / resultData 구조를 반환합니다.
"""

from typing import Any, Optional, Dict

# 상태 코드 상수
SUCCESS: int = 200
FAILURE: int = 400


def create_response(result_code: int, result_msg: str, result_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "resultCode": result_code,
        "resultMsg": result_msg,
        "resultData": result_data,
    }


