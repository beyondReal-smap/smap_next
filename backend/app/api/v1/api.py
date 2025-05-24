from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, groups, group_details, locations, schedules, push_logs, push_fcms, members, group_members, weather

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(group_details.router, prefix="/group-details", tags=["group-details"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(push_logs.router, prefix="/push-logs", tags=["push-logs"])
api_router.include_router(push_fcms.router, prefix="/push-fcms", tags=["push-fcms"]) 
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(group_members.router, prefix="/group-members", tags=["group-members"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"]) 