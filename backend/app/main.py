"""
SMAP API - FastAPI Application

메인 애플리케이션 모듈. lifespan 컨텍스트 매니저를 사용하여
스케줄러와 로그 매니저의 생명주기를 관리합니다.
"""
import logging
import os
import sys
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.log_manager import get_log_manager
from app.core.scheduler import scheduler
from app.db.session import engine

# ---------------------------------------------------------------------------
# 경로 설정
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # backend 디렉토리
STORAGE_DIR = BASE_DIR / "storage"
IMAGES_DIR = BASE_DIR / "public" / "images"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 로깅 설정
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log"),
    ],
)


class FilteredAccessLog(logging.Filter):
    """고빈도 위치 로깅 엔드포인트를 액세스 로그에서 제외"""

    def filter(self, record):
        if hasattr(record, "getMessage"):
            message = record.getMessage()
            if "/api/v1/logs/member-location-logs" in message:
                return False
        return True


access_logger = logging.getLogger("uvicorn.access")
access_logger.setLevel(logging.WARNING)
access_logger.addFilter(FilteredAccessLog())

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 로그 매니저 초기화
# ---------------------------------------------------------------------------
log_manager = get_log_manager()
auto_cleanup_thread = log_manager.start_auto_cleanup(interval_hours=24)


# ---------------------------------------------------------------------------
# 유틸리티
# ---------------------------------------------------------------------------
_SENSITIVE_FIELDS = frozenset(
    ["password", "mt_pass", "token", "access_token", "refresh_token"]
)


def mask_sensitive_data(data: dict) -> dict:
    """민감한 정보를 마스킹"""
    return {
        k: "********" if k in _SENSITIVE_FIELDS else v
        for k, v in data.items()
    }


def _scheduler_disabled() -> bool:
    return os.getenv("SMAP_DISABLE_SCHEDULER", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    # --- startup ---
    if _scheduler_disabled():
        logger.info("⏭️ [STARTUP] Scheduler startup skipped for this process")
    else:
        scheduler.start()
        logger.info("✅ [STARTUP] Scheduler started")

    logger.info(f"📁 [STARTUP] BASE_DIR: {BASE_DIR}")
    logger.info(f"📁 [STARTUP] IMAGES_DIR: {IMAGES_DIR} (exists={IMAGES_DIR.exists()})")

    yield

    # --- shutdown ---
    if not _scheduler_disabled():
        scheduler.shutdown()
        logger.info("🛑 [SHUTDOWN] Scheduler stopped")


# ---------------------------------------------------------------------------
# FastAPI 앱 생성
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# 미들웨어
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        response = await call_next(request)
        if response.status_code >= 400:
            logger.warning(
                f"Request failed: {request.method} {request.url} - Status: {response.status_code}"
            )
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url} - Error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise


# ---------------------------------------------------------------------------
# 라우터
# ---------------------------------------------------------------------------
app.include_router(api_router, prefix=settings.API_V1_STR)


# ---------------------------------------------------------------------------
# 루트 / 헬스체크 엔드포인트
# ---------------------------------------------------------------------------
@app.get("/", tags=["root"])
async def root():
    """API 루트 경로"""
    return {
        "message": "SMAP API 서버가 정상적으로 실행 중입니다.",
        "version": settings.VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/health",
        "db_pool_health": "/health/db-pool",
    }


@app.get("/health", tags=["healthcheck"])
async def health_check():
    """애플리케이션 상태를 확인합니다."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.VERSION,
        "project": settings.PROJECT_NAME,
    }


@app.get("/health/db-pool", tags=["healthcheck"])
async def check_db_pool_health():
    """데이터베이스 연결 풀 상태를 확인합니다."""
    try:
        pool = engine.pool
        checked_out = pool.checkedout()
        pool_size = pool.size()

        pool_status = {
            "pool_size": pool_size,
            "checked_in": pool.checkedin(),
            "checked_out": checked_out,
            "overflow": pool.overflow(),
            "total_connections": pool.checkedin() + checked_out,
            "available_connections": pool.checkedin(),
            "in_use_connections": checked_out,
        }

        if checked_out > pool_size * 0.9:
            status = "critical"
        elif checked_out > pool_size * 0.8:
            status = "warning"
        else:
            status = "healthy"

        return {
            "status": status,
            "timestamp": time.time(),
            "pool_status": pool_status,
            "pool_config": {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_timeout": settings.DB_POOL_TIMEOUT,
                "pool_recycle": settings.DB_POOL_RECYCLE,
            },
        }
    except Exception as e:
        logger.error(f"Error checking database pool health: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": time.time(),
        }


# ---------------------------------------------------------------------------
# URL 정규화 (클라이언트 이중 슬래시 대응)
# ---------------------------------------------------------------------------
@app.api_route(
    "/api//api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def redirect_double_slash_api(request: Request, path: str):
    """
    /api//api/ 패턴을 /api/로 리다이렉트
    클라이언트 URL 구성 오류를 해결하기 위한 임시 조치
    """
    original_url = str(request.url)
    corrected_url = original_url.replace("/api//api/", "/api/")
    logger.info(f"URL 리다이렉트: {original_url} -> {corrected_url}")
    return RedirectResponse(url=corrected_url, status_code=307)


# ---------------------------------------------------------------------------
# 디버그 엔드포인트
# ---------------------------------------------------------------------------
@app.get("/debug/images", tags=["debug"])
async def debug_images():
    """이미지 디렉토리 경로와 파일 목록을 확인합니다."""
    files = [f.name for f in IMAGES_DIR.glob("*")] if IMAGES_DIR.exists() else []
    return {
        "base_dir": str(BASE_DIR),
        "images_dir": str(IMAGES_DIR),
        "images_dir_exists": IMAGES_DIR.exists(),
        "files": files[:20],
        "file_count": len(files),
    }


# ---------------------------------------------------------------------------
# 정적 파일 서빙
# ---------------------------------------------------------------------------
app.mount("/static", StaticFiles(directory=str(STORAGE_DIR)), name="static")
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# ---------------------------------------------------------------------------
# OpenAPI 스키마 커스터마이징
# ---------------------------------------------------------------------------
@app.get(f"{settings.API_V1_STR}/openapi.json", include_in_schema=False)
async def get_openapi_schema(request: Request):
    """요청이 들어온 호스트 기반으로 동적 OpenAPI 스키마 반환"""
    host = request.headers.get("host", "api3.smap.site")
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    current_server = f"{forwarded_proto}://{host}"

    all_servers = [
        {"url": current_server, "description": "Current server"},
        {"url": "https://api3.smap.site", "description": "Main API (443)"},
        {"url": "https://api3.smap.site:8000", "description": "API Port 8000"},
        {"url": "https://api3.smap.site:3000", "description": "API Port 3000"},
    ]

    seen_urls: set[str] = set()
    unique_servers = []
    for server in all_servers:
        if server["url"] not in seen_urls:
            unique_servers.append(server)
            seen_urls.add(server["url"])

    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=f"{settings.VERSION}-{int(time.time())}",
        description="SMAP API",
        routes=app.routes,
    )
    openapi_schema["servers"] = unique_servers

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Last-Modified": time.strftime(
            "%a, %d %b %Y %H:%M:%S GMT", time.gmtime()
        ),
        "ETag": f'"{int(time.time())}"',
    }
    return JSONResponse(content=openapi_schema, headers=headers)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="SMAP API",
        routes=app.routes,
    )
    openapi_schema["servers"] = [
        {"url": "https://api3.smap.site", "description": "Main API (443)"},
        {"url": "https://api3.smap.site:8000", "description": "API Port 8000"},
        {"url": "https://api3.smap.site:3000", "description": "API Port 3000"},
    ]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi  # type: ignore

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
