from fastapi import APIRouter
from app.api.endpoints import location

api_router = APIRouter()
 
# /api/location 엔드포인트 등록
api_router.include_router(location.router, prefix="/location", tags=["location"]) 