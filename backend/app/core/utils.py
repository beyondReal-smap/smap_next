"""
유틸리티 함수들을 포함하는 모듈
"""

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
