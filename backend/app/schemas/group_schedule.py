from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.enums import (
    AllDayCheckEnum,
    ShowEnum,
    ScheduleAlarmCheckEnum,
    InCheckEnum,
    ScheduleCheckEnum
)

class GroupScheduleCreate(BaseModel):
    """그룹 스케줄 생성 요청"""
    sst_title: str
    sst_sdate: datetime
    sst_edate: datetime
    sst_all_day: Optional[str] = "Y"
    targetMemberId: Optional[int] = None
    sst_location_title: Optional[str] = None
    sst_location_add: Optional[str] = None
    sst_location_lat: Optional[Decimal] = None
    sst_location_long: Optional[Decimal] = None
    sst_memo: Optional[str] = None
    sst_supplies: Optional[str] = None
    sst_alram: Optional[int] = None
    sst_schedule_alarm_chk: Optional[str] = "Y"

class GroupScheduleUpdate(BaseModel):
    """그룹 스케줄 수정 요청"""
    sst_title: Optional[str] = None
    sst_sdate: Optional[datetime] = None
    sst_edate: Optional[datetime] = None
    sst_all_day: Optional[str] = None
    sst_location_title: Optional[str] = None
    sst_location_add: Optional[str] = None
    sst_location_lat: Optional[Decimal] = None
    sst_location_long: Optional[Decimal] = None
    sst_memo: Optional[str] = None
    sst_supplies: Optional[str] = None
    sst_alram: Optional[int] = None
    sst_schedule_alarm_chk: Optional[str] = None

class GroupMemberInfo(BaseModel):
    """그룹 멤버 정보"""
    mt_idx: int
    mt_name: str
    mt_file1: Optional[str] = None
    sgt_idx: int
    sgdt_idx: int
    sgdt_owner_chk: str
    sgdt_leader_chk: str

class UserPermissionInfo(BaseModel):
    """사용자 권한 정보"""
    canManage: bool
    isOwner: bool
    isLeader: bool

class GroupScheduleDetail(BaseModel):
    """그룹 스케줄 상세 정보"""
    sst_idx: int
    sst_pidx: Optional[int] = None
    mt_idx: int
    sst_title: str
    sst_sdate: Optional[str] = None
    sst_edate: Optional[str] = None
    sst_sedate: Optional[str] = None
    sst_all_day: Optional[str] = None
    sst_repeat_json: Optional[str] = None
    sst_repeat_json_v: Optional[str] = None
    sgt_idx: Optional[int] = None
    sgdt_idx: Optional[int] = None
    sgdt_idx_t: Optional[str] = None
    sst_alram: Optional[int] = None
    sst_alram_t: Optional[str] = None
    sst_adate: Optional[str] = None
    slt_idx: Optional[int] = None
    slt_idx_t: Optional[str] = None
    sst_location_title: Optional[str] = None
    sst_location_add: Optional[str] = None
    sst_location_lat: Optional[float] = None
    sst_location_long: Optional[float] = None
    sst_supplies: Optional[str] = None
    sst_memo: Optional[str] = None
    sst_show: Optional[str] = None
    sst_location_alarm: Optional[int] = None
    sst_schedule_alarm_chk: Optional[str] = None
    sst_pick_type: Optional[str] = None
    sst_pick_result: Optional[int] = None
    sst_schedule_alarm: Optional[str] = None
    sst_update_chk: Optional[str] = None
    sst_wdate: Optional[str] = None
    sst_udate: Optional[str] = None
    sst_ddate: Optional[str] = None
    sst_in_chk: Optional[str] = None
    sst_schedule_chk: Optional[str] = None
    sst_entry_cnt: Optional[int] = None
    sst_exit_cnt: Optional[int] = None
    member_name: Optional[str] = None
    member_photo: Optional[str] = None
    # 프론트엔드 호환성을 위한 추가 필드
    id: str
    title: str
    date: Optional[str] = None
    location: Optional[str] = None
    memberId: str

class GroupScheduleResponse(BaseModel):
    """그룹 스케줄 조회 응답"""
    success: bool
    data: Dict[str, Any]

class GroupScheduleListResponse(BaseModel):
    """그룹 스케줄 목록 응답"""
    success: bool
    data: Dict[str, Any] = {
        "schedules": [],
        "groupMembers": [],
        "userPermission": {
            "canManage": False,
            "isOwner": False,
            "isLeader": False
        }
    }

class ScheduleActionResponse(BaseModel):
    """스케줄 액션 응답 (생성/수정/삭제)"""
    success: bool
    data: Dict[str, Any] 