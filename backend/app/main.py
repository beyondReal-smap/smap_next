import logging
import sys
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.scheduler import scheduler
import traceback
from app.api.v1.endpoints import locations as locations_router

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

def mask_sensitive_data(data: dict) -> dict:
    """민감한 정보를 마스킹하는 함수"""
    masked_data = data.copy()
    sensitive_fields = ['password', 'mt_pass', 'token', 'access_token', 'refresh_token']
    
    for field in sensitive_fields:
        if field in masked_data:
            masked_data[field] = '********'
    
    return masked_data

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SMAP API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 정적 파일 서빙 설정 추가
app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# CORS 설정
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[],
        max_age=0,
    )

# 헬스체크 엔드포인트 추가
@app.get("/health", tags=["healthcheck"])
async def health_check():
    return {"status": "healthy"}

# API 라우터 등록
app.include_router(api_router, prefix=settings.API_V1_STR)

# 추가된 부분: locations 라우터를 api_router에 포함시키거나, 직접 app에 등록
# 만약 api_router (app.api.v1.api.py 내)가 모든 엔드포인트 라우터를 모으는 중심점이라면,
# 그 파일 내에 locations_router를 추가해야 합니다.
# 예시: api_router.include_router(locations_router.router, prefix="/locations", tags=["locations"])

# 또는, main.py에서 직접 등록할 수도 있습니다 (경로가 겹치지 않도록 주의)
# 이 경우, prefix는 /api/v1 와 locations 라우터의 prefix를 조합해야 합니다.
# 예를 들어, locations_router.router가 "/group-members-with-locations/{user_id}" 이고,
# 전체 API 경로가 /api/v1/locations/group-members-with-locations/{user_id} 가 되도록 하려면,
# app.include_router(locations_router.router, prefix=f"{settings.API_V1_STR}/locations", tags=["locations"])

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request started: {request.method} {request.url}")
    try:
        # 요청 본문 로깅 (민감 정보 마스킹)
        body = await request.body()
        if body:
            try:
                body_json = json.loads(body.decode())
                masked_body = mask_sensitive_data(body_json)
                logger.info(f"Request body: {json.dumps(masked_body, ensure_ascii=False)}")
            except json.JSONDecodeError:
                logger.info("Request body: [Binary or non-JSON data]")
        
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

@app.on_event("startup")
async def startup_event():
    """
    애플리케이션 시작 시 실행되는 이벤트
    """
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_event():
    """
    애플리케이션 종료 시 실행되는 이벤트
    """
    scheduler.shutdown()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 