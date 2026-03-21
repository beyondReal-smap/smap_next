"""Redis 캐싱 유틸리티.

읽기 빈도가 높은 엔드포인트의 응답을 캐싱하여 DB 부하를 줄입니다.
"""
import json
import logging
from functools import wraps
from typing import Any, Callable, Optional

import redis

logger = logging.getLogger(__name__)

# Redis 연결 (lazy init)
_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    """Redis 클라이언트를 반환합니다. 연결 실패 시 None."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis(
                host="127.0.0.1",
                port=6379,
                db=0,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _redis_client.ping()
            logger.info("Redis 연결 성공")
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning("Redis 연결 실패 (캐싱 비활성): %s", e)
            _redis_client = None
    return _redis_client


def cache_get(key: str) -> Optional[Any]:
    """캐시에서 값을 조회합니다."""
    r = get_redis()
    if r is None:
        return None
    try:
        data = r.get(key)
        if data is not None:
            return json.loads(data)
    except (redis.RedisError, json.JSONDecodeError):
        pass
    return None


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """캐시에 값을 저장합니다. 기본 TTL 5분."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
    except (redis.RedisError, TypeError):
        pass


def cache_delete(key: str) -> None:
    """캐시 키를 삭제합니다."""
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(key)
    except redis.RedisError:
        pass


def cache_delete_pattern(pattern: str) -> None:
    """패턴과 매칭되는 모든 캐시 키를 삭제합니다."""
    r = get_redis()
    if r is None:
        return
    try:
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except redis.RedisError:
        pass


def cached(prefix: str, ttl: int = 300, key_func: Optional[Callable] = None):
    """
    엔드포인트 응답을 캐싱하는 데코레이터.

    Usage:
        @router.get("/items")
        @cached("items", ttl=600)
        def get_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 캐시 키 생성
            if key_func:
                cache_key = f"{prefix}:{key_func(*args, **kwargs)}"
            else:
                # kwargs에서 db, authorization 등 캐시 불가능한 항목 제외
                key_parts = {
                    k: v for k, v in kwargs.items()
                    if k not in ("db", "authorization", "request")
                    and v is not None
                }
                cache_key = f"{prefix}:{json.dumps(key_parts, sort_keys=True, default=str)}"

            # 캐시 조회
            result = cache_get(cache_key)
            if result is not None:
                return result

            # 실제 함수 실행
            result = func(*args, **kwargs)

            # 결과 캐싱
            if result is not None:
                cache_set(cache_key, result, ttl)

            return result

        return wrapper
    return decorator
