from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, groups, group_details, locations, schedules, push_logs, push_fcms, members, group_members, weather, group_schedule_manage, member_location_log, fcm_sendone, notices, orders

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(group_details.router, prefix="/group-details", tags=["group-details"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(group_schedule_manage.router, prefix="/schedule", tags=["group-schedule-manage"])
api_router.include_router(push_logs.router, prefix="/push-logs", tags=["push-logs"])
api_router.include_router(push_fcms.router, prefix="/push-fcms", tags=["push-fcms"]) 
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(group_members.router, prefix="/group-members", tags=["group-members"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(member_location_log.router, prefix="/logs", tags=["member-location-logs"])
api_router.include_router(fcm_sendone.router, prefix="/fcm_sendone", tags=["fcm-sendone"])
api_router.include_router(notices.router, prefix="/notices", tags=["notices"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"]) 