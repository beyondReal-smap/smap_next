from sqlalchemy import Column, Integer, String, DateTime, Enum
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

class PushFCM(BaseModel):
    __tablename__ = "push_fcm_t"

    pft_idx = Column(Integer, primary_key=True)
    pft_code = Column(String(20), nullable=True)
    pft_title = Column(String(100), nullable=True)
    pft_content = Column(String(200), nullable=True)
    pft_send_type = Column(Integer, nullable=True)
    pft_send_mt_idx = Column(Integer, nullable=True)
    pft_rdate = Column(DateTime, nullable=True)
    pft_url = Column(String(255), nullable=True)
    pft_status = Column(Integer, nullable=True)
    pft_show = Column(Enum(ShowEnum), nullable=True)
    pft_sdate = Column(DateTime, nullable=True)
    pft_edate = Column(DateTime, nullable=True)
    pft_wdate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['PushFCM']:
        return db.query(cls).filter(cls.pft_idx == idx).first()

    @classmethod
    def find_push_list(cls, db: Session) -> List['PushFCM']:
        now = datetime.now()
        pft_rdate = now.strftime('%Y-%m-%d %H:00:00')
        return db.query(cls).filter(
            cls.pft_rdate == pft_rdate,
            cls.pft_show == ShowEnum.Y,
            cls.pft_status == 1
        ).all()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['PushFCM']:
        return db.query(cls).filter(
            cls.pft_send_mt_idx == mt_idx,
            cls.pft_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_code(cls, db: Session, code: str) -> List['PushFCM']:
        return db.query(cls).filter(
            cls.pft_code == code,
            cls.pft_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_pending_messages_for_member(
        cls,
        db: Session,
        mt_idx: int,
        since_timestamp: Optional[float] = None
    ) -> List['PushFCM']:
        """
        특정 회원의 보류된 FCM 메시지를 조회합니다.
        앱이 오랫동안 종료되었던 경우 누락되었을 수 있는 메시지들을 확인합니다.
        """
        from datetime import datetime

        query = db.query(cls).filter(
            cls.pft_send_mt_idx == mt_idx,
            cls.pft_show == ShowEnum.Y,
            cls.pft_status == 1  # 활성 상태인 메시지만
        )

        # 시간 범위 필터링 (since_timestamp가 제공된 경우)
        if since_timestamp:
            since_datetime = datetime.fromtimestamp(since_timestamp)
            query = query.filter(cls.pft_rdate >= since_datetime)

        # 예정된 시간 이후의 메시지들 (아직 전송되지 않은 메시지들)
        now = datetime.now()
        query = query.filter(cls.pft_rdate >= now)

        return query.order_by(cls.pft_rdate.asc()).all()

    @classmethod
    def find_recent_messages_for_member(
        cls,
        db: Session,
        mt_idx: int,
        hours: int = 24
    ) -> List['PushFCM']:
        """
        특정 회원의 최근 N시간 내 메시지들을 조회합니다.
        FCM 토큰이 만료되어 메시지가 누락되었을 수 있는 경우를 대비합니다.
        """
        from datetime import datetime, timedelta

        since_datetime = datetime.now() - timedelta(hours=hours)

        return db.query(cls).filter(
            cls.pft_send_mt_idx == mt_idx,
            cls.pft_show == ShowEnum.Y,
            cls.pft_rdate >= since_datetime
        ).order_by(cls.pft_rdate.desc()).all() 