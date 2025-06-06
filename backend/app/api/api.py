from fastapi import APIRouter
from app.api.endpoints import location, member_location_log

api_router = APIRouter()
 
# /api/location 엔드포인트 등록
api_router.include_router(location.router, prefix="/location", tags=["location"])

# /api/member-location-logs 엔드포인트 등록
api_router.include_router(member_location_log.router, prefix="/member-location-logs", tags=["member-location-logs"]) 