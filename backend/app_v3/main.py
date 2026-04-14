"""
SMAP API Main Entry Point (스케줄러 활성)

Nginx (api3.smap.site) → 127.0.0.1:9000 → 이 진입점
스케줄러(APScheduler)가 활성화된 메인 프로세스.
실행: uvicorn app_v3.main:app --host 0.0.0.0 --port 9000
"""
import os

if os.getenv("SMAP_DISABLE_SCHEDULER", "").strip().lower() in {"1", "true", "yes"}:
    os.environ.pop("SMAP_DISABLE_SCHEDULER", None)

from app.main import app

__all__ = ["app"]
