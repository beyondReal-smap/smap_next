from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.scheduler import BackgroundTasks
from app.api.v1.endpoints import push_logs
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SMAP API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 오리진 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(push_logs.router, prefix="/api/v1/push-logs", tags=["push-logs"])

# 백그라운드 작업 인스턴스
background_tasks = None

@app.on_event("startup")
async def startup_event():
    """
    애플리케이션 시작 시 실행되는 이벤트
    """
    global background_tasks
    try:
        background_tasks = BackgroundTasks()
        background_tasks.start()
        logger.info("Background tasks started successfully")
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """
    애플리케이션 종료 시 실행되는 이벤트
    """
    global background_tasks
    if background_tasks:
        try:
            background_tasks.shutdown()
            logger.info("Background tasks shut down successfully")
        except Exception as e:
            logger.error(f"Failed to shut down background tasks: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 