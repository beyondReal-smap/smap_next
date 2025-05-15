import logging
import sys
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.scheduler import scheduler
import traceback

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

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스체크 엔드포인트 추가
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# API 라우터 등록
app.include_router(api_router, prefix=settings.API_V1_STR)

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