"""
유틸리티 함수들을 포함하는 모듈
"""
from math import radians, sin, cos, sqrt, atan2


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 사이의 거리를 미터 단위로 계산합니다 (Haversine 공식)."""
    R = 6371000  # 지구 반지름 (미터)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

def kmTom(distance_km: float) -> float:
    """
    킬로미터를 미터로 변환합니다.
    
    Args:
        distance_km (float): 킬로미터 단위의 거리
        
    Returns:
        float: 미터 단위의 거리
    """
    return distance_km * 1000


def mToKm(distance_m: float) -> float:
    """
    미터를 킬로미터로 변환합니다.
    
    Args:
        distance_m (float): 미터 단위의 거리
        
    Returns:
        float: 킬로미터 단위의 거리
    """
    return distance_m / 1000


def mask_token(token: str) -> str:
    """FCM 토큰을 로그용으로 마스킹합니다. 처음 8자 + ...끝 4자"""
    if not token or len(token) < 16:
        return "***"
    return f"{token[:8]}...{token[-4:]}"


def format_distance(distance_m: float) -> str:
    """
    거리를 읽기 쉬운 형태로 포맷팅합니다.
    
    Args:
        distance_m (float): 미터 단위의 거리
        
    Returns:
        str: 포맷팅된 거리 문자열
    """
    if distance_m < 1000:
        return f"{distance_m:.0f}m"
    else:
        km = distance_m / 1000
        return f"{km:.1f}km"
