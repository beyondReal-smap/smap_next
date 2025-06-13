from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from .base import Base
import enum

class NoticeShowEnum(str, enum.Enum):
    Y = "Y"  # 노출
    N = "N"  # 노출안함

class Notice(Base):
    __tablename__ = "notice_t"
    
    nt_idx = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="공지사항 ID")
    mt_idx = Column(Integer, nullable=True, comment="관리자 ID")
    nt_title = Column(String(200), nullable=True, index=True, comment="제목")
    nt_file1 = Column(String(50), nullable=True, comment="첨부파일")
    nt_content = Column(Text, nullable=True, comment="내용")
    nt_show = Column(Enum(NoticeShowEnum), default=NoticeShowEnum.Y, index=True, comment="노출여부")
    nt_hit = Column(Integer, default=0, comment="조회수")
    nt_wdate = Column(DateTime, default=func.now(), comment="등록일시")
    nt_uwdate = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")
    
    class Config:
        from_attributes = True 