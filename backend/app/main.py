import logging
import sys
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.scheduler import scheduler
from app.core.log_manager import get_log_manager
from app.db.session import engine
import traceback
from app.api.v1.endpoints import locations as locations_router

# 로그 매니저 초기화 및 자동 정리 시작
log_manager = get_log_manager()
auto_cleanup_thread = log_manager.start_auto_cleanup(interval_hours=24)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)

# uvicorn 액세스 로그 필터링 (member-location-logs 제외)
class FilteredAccessLog(logging.Filter):
    def filter(self, record):
        # member-location-logs 경로 로그 제외
        if hasattr(record, 'getMessage'):
            message = record.getMessage()
            if '/api/v1/logs/member-location-logs' in message:
                return False
        return True

# uvicorn 액세스 로거 설정
access_logger = logging.getLogger("uvicorn.access")
access_logger.setLevel(logging.WARNING)  # WARNING 레벨로 설정
access_logger.addFilter(FilteredAccessLog())

logger = logging.getLogger(__name__)

def mask_sensitive_data(data: dict) -> dict:
    """민감한 정보를 마스킹하는 함수"""
    masked_data = data.copy()
    sensitive_fields = ['password', 'mt_pass', 'token', 'access_token', 'refresh_token']
    
    for field in sensitive_fields:
        if field in masked_data:
            masked_data[field] = '********'
    
    return masked_data

import time
cache_buster = int(time.time())

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",    # 루트 경로에서 접근 가능
    redoc_url="/redoc",  # 루트 경로에서 접근 가능
)


# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 포함
app.include_router(api_router, prefix=settings.API_V1_STR)

# URL 정규화 리다이렉트 라우트들
@app.api_route("/api//api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def redirect_double_slash_api(request: Request, path: str):
    """
    /api//api/ 패턴을 /api/로 리다이렉트
    클라이언트 URL 구성 오류를 해결하기 위한 임시 조치
    """
    from fastapi.responses import RedirectResponse

    # 원본 URL에서 /api//api/를 /api/로 변환
    original_url = str(request.url)
    corrected_url = original_url.replace("/api//api/", "/api/")

    logger.info(f"🔄 URL 리다이렉트: {original_url} → {corrected_url}")

    # 307 임시 리다이렉트 (메소드와 본문을 유지)
    return RedirectResponse(url=corrected_url, status_code=307)

# 루트 경로 추가
@app.get("/", tags=["root"])
async def root():
    """API 루트 경로 - API 정보 및 문서 링크 제공"""
    return {
        "message": "SMAP API 서버가 정상적으로 실행 중입니다.",
        "version": settings.VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/health",
        "db_pool_health": "/health/db-pool"
    }

# 정적 파일 서빙
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent  # backend 디렉토리
STORAGE_DIR = BASE_DIR / "storage"
IMAGES_DIR = BASE_DIR / "public" / "images"

# 디렉토리가 없으면 생성
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 로그 출력 (시작 시 경로 확인)
logger.info(f"📁 BASE_DIR: {BASE_DIR}")
logger.info(f"📁 IMAGES_DIR: {IMAGES_DIR}")
logger.info(f"📁 IMAGES_DIR exists: {IMAGES_DIR.exists()}")

app.mount("/static", StaticFiles(directory=str(STORAGE_DIR)), name="static")
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")  # 프로필 이미지

# 이미지 경로 디버깅 엔드포인트
@app.get("/debug/images", tags=["debug"])
async def debug_images():
    """이미지 디렉토리 경로와 파일 목록을 확인합니다."""
    files = []
    if IMAGES_DIR.exists():
        files = [f.name for f in IMAGES_DIR.glob("*")]
    return {
        "base_dir": str(BASE_DIR),
        "images_dir": str(IMAGES_DIR),
        "images_dir_exists": IMAGES_DIR.exists(),
        "files": files[:20],  # 최대 20개만 표시
        "file_count": len(files)
    }

# 데이터베이스 연결 풀 상태 확인
@app.get("/health/db-pool", tags=["healthcheck"])
async def check_db_pool_health():
    """데이터베이스 연결 풀 상태를 확인합니다."""
    try:
        pool = engine.pool
        pool_status = {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total_connections": pool.checkedin() + pool.checkedout(),
            "available_connections": pool.checkedin(),
            "in_use_connections": pool.checkedout()
        }
        
        # 연결 풀 상태에 따른 상태 코드
        if pool_status["checked_out"] > pool_status["pool_size"] * 0.8:
            status = "warning"
        elif pool_status["checked_out"] > pool_status["pool_size"] * 0.9:
            status = "critical"
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
                "pool_recycle": settings.DB_POOL_RECYCLE
            }
        }
    except Exception as e:
        logger.error(f"Error checking database pool health: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": time.time()
        }

# 일반 헬스체크
@app.get("/health", tags=["healthcheck"])
async def health_check():
    """애플리케이션 상태를 확인합니다."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.VERSION,
        "project": settings.PROJECT_NAME
    }

@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        response = await call_next(request)
        # 에러 상태 코드(4xx, 5xx)일 때만 로깅
        if response.status_code >= 400:
            logger.warning(f"Request failed: {request.method} {request.url} - Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url} - Error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

@app.on_event("startup")
async def startup_event():
    """
    애플리케이션 시작 시 실행되는 이벤트
    """
    scheduler.start()
    # 정적 파일 경로 로그
    logger.info(f"📁 [STARTUP] BASE_DIR: {BASE_DIR}")
    logger.info(f"📁 [STARTUP] IMAGES_DIR: {IMAGES_DIR}")
    logger.info(f"📁 [STARTUP] IMAGES_DIR exists: {IMAGES_DIR.exists()}")
    if IMAGES_DIR.exists():
        files = list(IMAGES_DIR.glob("*"))
        logger.info(f"📁 [STARTUP] Files in IMAGES_DIR: {[f.name for f in files[:10]]}")

@app.on_event("shutdown")
async def shutdown_event():
    """
    애플리케이션 종료 시 실행되는 이벤트
    """
    scheduler.shutdown()

# 동적 OpenAPI 스키마: 요청 호스트 기반으로 servers 설정
@app.get(f"{settings.API_V1_STR}/openapi.json", include_in_schema=False)
async def get_openapi_schema(request: Request):
    """요청이 들어온 호스트와 포트를 기반으로 동적 OpenAPI 스키마 반환"""
    # 요청 헤더에서 실제 호스트와 포트 정보 추출
    host = request.headers.get("host", "api3.smap.site")
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    
    # 현재 요청된 URL을 우선순위로 설정
    current_server = f"{forwarded_proto}://{host}"
    
    # 모든 가능한 서버 URL 설정
    all_servers = [
        {"url": current_server, "description": "Current server"},
        {"url": "https://api3.smap.site", "description": "Main API (443)"},
        {"url": "https://api3.smap.site:8000", "description": "API Port 8000"},
        {"url": "https://api3.smap.site:3000", "description": "API Port 3000"}
    ]
    
    # 중복 제거하면서 현재 서버를 첫 번째로 유지
    unique_servers = []
    seen_urls = set()
    for server in all_servers:
        if server["url"] not in seen_urls:
            unique_servers.append(server)
            seen_urls.add(server["url"])
    
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=f"{settings.VERSION}-{int(time.time())}",  # 강제 캐시 무효화
        description="SMAP API",
        routes=app.routes,
    )
    openapi_schema["servers"] = unique_servers
    
    # 캐시 무효화 헤더 추가
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Last-Modified": time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime()),
        "ETag": f'"{int(time.time())}"'
    }
    
    return JSONResponse(content=openapi_schema, headers=headers)

# 정적 OpenAPI 스키마도 유지 (fallback)
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
        {"url": "https://api3.smap.site:3000", "description": "API Port 3000"}
    ]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi  # type: ignore

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 