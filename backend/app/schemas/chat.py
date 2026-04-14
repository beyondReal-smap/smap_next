from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Request schemas ---

class CreateDMRequest(BaseModel):
    target_mt_idx: int


class SendMessageRequest(BaseModel):
    scr_idx: int
    content: str


class ReadUpdateRequest(BaseModel):
    scr_idx: int
    scmsg_idx: int


# --- Response schemas ---

class MessageResponse(BaseModel):
    scmsg_idx: int
    scr_idx: int
    mt_idx: int
    mt_nickname: Optional[str] = None
    mt_file1: Optional[str] = None
    scmsg_type: str = "text"
    scmsg_content: str
    scmsg_wdate: datetime
    unread_count: int = 0

    class Config:
        from_attributes = True


class ChatRoomResponse(BaseModel):
    scr_idx: int
    sgt_idx: Optional[int] = None
    scr_type: str
    scr_title: Optional[str] = None
    scr_udate: datetime
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    member_count: int = 0
    dm_target_nickname: Optional[str] = None
    dm_target_file1: Optional[str] = None

    class Config:
        from_attributes = True


class ChatRoomListResponse(BaseModel):
    rooms: List[ChatRoomResponse]
    total_unread: int = 0
