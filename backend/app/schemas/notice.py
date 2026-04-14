from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from ..models.notice import NoticeShowEnum

class NoticeBase(BaseModel):
    nt_title: Optional[str] = Field(None, max_length=200, description="제목")
    nt_file1: Optional[str] = Field(None, max_length=50, description="첨부파일")
    nt_content: Optional[str] = Field(None, description="내용")
    nt_show: Optional[NoticeShowEnum] = Field(NoticeShowEnum.Y, description="노출여부")

class NoticeCreate(NoticeBase):
    mt_idx: Optional[int] = Field(None, description="관리자 ID")
    nt_title: str = Field(..., max_length=200, description="제목")
    nt_content: str = Field(..., description="내용")

class NoticeUpdate(NoticeBase):
    pass

class NoticeInDB(NoticeBase):
    model_config = ConfigDict(from_attributes=True)

    nt_idx: int = Field(..., description="공지사항 ID")
    mt_idx: Optional[int] = Field(None, description="관리자 ID")
    nt_hit: int = Field(0, description="조회수")
    nt_wdate: datetime = Field(..., description="등록일시")
    nt_uwdate: datetime = Field(..., description="수정일시")

class Notice(NoticeInDB):
    pass

class NoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nt_idx: int = Field(..., description="공지사항 ID")
    nt_title: str = Field(..., description="제목")
    nt_content: str = Field(..., description="내용")
    nt_file1: Optional[str] = Field(None, description="첨부파일")
    nt_hit: int = Field(0, description="조회수")
    nt_wdate: datetime = Field(..., description="등록일시")
    nt_uwdate: datetime = Field(..., description="수정일시")

class NoticeListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nt_idx: int = Field(..., description="공지사항 ID")
    nt_title: str = Field(..., description="제목")
    nt_content: str = Field(..., description="내용 (요약)")
    nt_hit: int = Field(0, description="조회수")
    nt_wdate: datetime = Field(..., description="등록일시")

class NoticeListWithPagination(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notices: List[NoticeListResponse] = Field(..., description="공지사항 목록")
    total: int = Field(..., description="전체 공지사항 수")
    page: int = Field(..., description="현재 페이지")
    size: int = Field(..., description="페이지 크기")
    total_pages: int = Field(..., description="전체 페이지 수")