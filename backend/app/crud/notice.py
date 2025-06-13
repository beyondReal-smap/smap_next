from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from ..models.notice import Notice, NoticeShowEnum
from ..schemas.notice import NoticeCreate, NoticeUpdate
import math

class NoticeCRUD:
    def __init__(self, db: Session):
        self.db = db

    def get_notice(self, notice_id: int) -> Optional[Notice]:
        """공지사항 단일 조회"""
        return self.db.query(Notice).filter(Notice.nt_idx == notice_id).first()

    def get_notice_and_increment_hit(self, notice_id: int) -> Optional[Notice]:
        """공지사항 조회 및 조회수 증가"""
        notice = self.db.query(Notice).filter(Notice.nt_idx == notice_id).first()
        if notice:
            notice.nt_hit = (notice.nt_hit or 0) + 1
            self.db.commit()
            self.db.refresh(notice)
        return notice

    def get_notices(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        show_only: bool = True
    ) -> List[Notice]:
        """공지사항 목록 조회"""
        query = self.db.query(Notice)
        
        if show_only:
            query = query.filter(Notice.nt_show == NoticeShowEnum.Y)
        
        return query.order_by(desc(Notice.nt_wdate)).offset(skip).limit(limit).all()

    def get_notices_count(self, show_only: bool = True) -> int:
        """공지사항 총 개수 조회"""
        query = self.db.query(func.count(Notice.nt_idx))
        
        if show_only:
            query = query.filter(Notice.nt_show == NoticeShowEnum.Y)
        
        return query.scalar()

    def get_notices_with_pagination(
        self, 
        page: int = 1, 
        size: int = 20, 
        show_only: bool = True
    ) -> dict:
        """페이지네이션이 적용된 공지사항 목록 조회"""
        skip = (page - 1) * size
        
        # 총 개수 조회
        total = self.get_notices_count(show_only=show_only)
        
        # 공지사항 목록 조회
        notices = self.get_notices(skip=skip, limit=size, show_only=show_only)
        
        # 총 페이지 수 계산
        total_pages = math.ceil(total / size) if total > 0 else 1
        
        return {
            "notices": notices,
            "total": total,
            "page": page,
            "size": size,
            "total_pages": total_pages
        }

    def create_notice(self, notice: NoticeCreate) -> Notice:
        """공지사항 생성"""
        db_notice = Notice(**notice.model_dump())
        self.db.add(db_notice)
        self.db.commit()
        self.db.refresh(db_notice)
        return db_notice

    def update_notice(self, notice_id: int, notice: NoticeUpdate) -> Optional[Notice]:
        """공지사항 수정"""
        db_notice = self.get_notice(notice_id)
        if not db_notice:
            return None
        
        update_data = notice.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_notice, field, value)
        
        self.db.commit()
        self.db.refresh(db_notice)
        return db_notice

    def delete_notice(self, notice_id: int) -> bool:
        """공지사항 삭제"""
        db_notice = self.get_notice(notice_id)
        if not db_notice:
            return False
        
        self.db.delete(db_notice)
        self.db.commit()
        return True

    def hide_notice(self, notice_id: int) -> Optional[Notice]:
        """공지사항 숨김 처리"""
        db_notice = self.get_notice(notice_id)
        if not db_notice:
            return None
        
        db_notice.nt_show = NoticeShowEnum.N
        self.db.commit()
        self.db.refresh(db_notice)
        return db_notice

    def show_notice(self, notice_id: int) -> Optional[Notice]:
        """공지사항 노출 처리"""
        db_notice = self.get_notice(notice_id)
        if not db_notice:
            return None
        
        db_notice.nt_show = NoticeShowEnum.Y
        self.db.commit()
        self.db.refresh(db_notice)
        return db_notice

    def search_notices(
        self, 
        keyword: str, 
        skip: int = 0, 
        limit: int = 20, 
        show_only: bool = True
    ) -> List[Notice]:
        """공지사항 검색"""
        query = self.db.query(Notice)
        
        if show_only:
            query = query.filter(Notice.nt_show == NoticeShowEnum.Y)
        
        query = query.filter(
            Notice.nt_title.contains(keyword) | 
            Notice.nt_content.contains(keyword)
        )
        
        return query.order_by(desc(Notice.nt_wdate)).offset(skip).limit(limit).all()

def get_notice_crud(db: Session) -> NoticeCRUD:
    """NoticeCRUD 인스턴스 반환"""
    return NoticeCRUD(db) 