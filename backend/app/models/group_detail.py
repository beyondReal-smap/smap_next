from sqlalchemy import Column, Integer, DateTime, Enum
from app.models.base import BaseModel
from app.models.enums import (
    OwnerCheckEnum,
    LeaderCheckEnum,
    DischargeEnum,
    GroupCheckEnum,
    ExitEnum,
    ShowEnum,
    PushCheckEnum
)
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)

class GroupDetail(BaseModel):
    __tablename__ = "smap_group_detail_t"

    sgdt_idx = Column(Integer, primary_key=True)
    sgt_idx = Column(Integer, nullable=True)
    mt_idx = Column(Integer, nullable=True)
    sgdt_owner_chk = Column(Enum(OwnerCheckEnum), nullable=True)
    sgdt_leader_chk = Column(Enum(LeaderCheckEnum), nullable=True)
    sgdt_discharge = Column(Enum(DischargeEnum), nullable=True)
    sgdt_group_chk = Column(Enum(GroupCheckEnum), nullable=True)
    sgdt_exit = Column(Enum(ExitEnum), nullable=True)
    sgdt_show = Column(Enum(ShowEnum), nullable=True)
    sgdt_push_chk = Column(Enum(PushCheckEnum), nullable=True)
    sgdt_wdate = Column(DateTime, nullable=True)
    sgdt_udate = Column(DateTime, nullable=True)
    sgdt_ddate = Column(DateTime, nullable=True)
    sgdt_xdate = Column(DateTime, nullable=True)
    sgdt_adate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['GroupDetail']:
        return db.query(cls).filter(cls.sgdt_idx == idx).first()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['GroupDetail']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sgdt_discharge == DischargeEnum.N,
            cls.sgdt_exit == ExitEnum.N,
            cls.sgdt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_owner(cls, db: Session, sgt_idx: int) -> Optional[Dict]:
        try:
            from app.models.member import Member
            owner = (
                db.query(cls, Member)
                .join(Member, cls.mt_idx == Member.mt_idx)
                .filter(
                    cls.sgt_idx == sgt_idx,
                    cls.sgdt_owner_chk == OwnerCheckEnum.Y,
                    cls.sgdt_discharge == DischargeEnum.N,
                    cls.sgdt_exit == ExitEnum.N,
                    cls.sgdt_show == ShowEnum.Y
                )
                .first()
            )

            if owner:
                return {
                    "sgdt_idx": owner.GroupDetail.sgdt_idx,
                    "sgt_idx": owner.GroupDetail.sgt_idx,
                    "mt_idx": owner.GroupDetail.mt_idx,
                    "sgdt_owner_chk": owner.GroupDetail.sgdt_owner_chk,
                    "sgdt_leader_chk": owner.GroupDetail.sgdt_leader_chk,
                    "sgdt_discharge": owner.GroupDetail.sgdt_discharge,
                    "sgdt_group_chk": owner.GroupDetail.sgdt_group_chk,
                    "sgdt_exit": owner.GroupDetail.sgdt_exit,
                    "sgdt_show": owner.GroupDetail.sgdt_show,
                    "sgdt_push_chk": owner.GroupDetail.sgdt_push_chk,
                    "mt_lang": owner.Member.mt_lang
                }
            return None
        except Exception as e:
            logger.error(f"Error in find_owner: {e}")
            return None

    @classmethod
    def find_leader(cls, db: Session, sgt_idx: int) -> Optional[Dict]:
        try:
            from app.models.member import Member
            leader = (
                db.query(cls, Member)
                .join(Member, cls.mt_idx == Member.mt_idx)
                .filter(
                    cls.sgt_idx == sgt_idx,
                    cls.sgdt_leader_chk == LeaderCheckEnum.Y,
                    cls.sgdt_discharge == DischargeEnum.N,
                    cls.sgdt_exit == ExitEnum.N,
                    cls.sgdt_show == ShowEnum.Y
                )
                .first()
            )

            if leader:
                return {
                    "sgdt_idx": leader.GroupDetail.sgdt_idx,
                    "sgt_idx": leader.GroupDetail.sgt_idx,
                    "mt_idx": leader.GroupDetail.mt_idx,
                    "sgdt_owner_chk": leader.GroupDetail.sgdt_owner_chk,
                    "sgdt_leader_chk": leader.GroupDetail.sgdt_leader_chk,
                    "sgdt_discharge": leader.GroupDetail.sgdt_discharge,
                    "sgdt_group_chk": leader.GroupDetail.sgdt_group_chk,
                    "sgdt_exit": leader.GroupDetail.sgdt_exit,
                    "sgdt_show": leader.GroupDetail.sgdt_show,
                    "sgdt_push_chk": leader.GroupDetail.sgdt_push_chk,
                    "mt_lang": leader.Member.mt_lang
                }
            return None
        except Exception as e:
            logger.error(f"Error in find_leader: {e}")
            return None

    @classmethod
    def get_member_list(cls, db: Session, sgt_idx: int) -> List[Dict]:
        try:
            from app.models.member import Member
            members = (
                db.query(cls, Member)
                .join(Member, cls.mt_idx == Member.mt_idx)
                .filter(
                    cls.sgt_idx == sgt_idx,
                    cls.sgdt_owner_chk == OwnerCheckEnum.N,
                    cls.sgdt_leader_chk == LeaderCheckEnum.N,
                    cls.sgdt_discharge == DischargeEnum.N,
                    cls.sgdt_exit == ExitEnum.N,
                    cls.sgdt_show == ShowEnum.Y
                )
                .all()
            )

            return [{
                "sgdt_idx": member.GroupDetail.sgdt_idx,
                "sgt_idx": member.GroupDetail.sgt_idx,
                "mt_idx": member.GroupDetail.mt_idx,
                "sgdt_owner_chk": member.GroupDetail.sgdt_owner_chk,
                "sgdt_leader_chk": member.GroupDetail.sgdt_leader_chk,
                "sgdt_discharge": member.GroupDetail.sgdt_discharge,
                "sgdt_group_chk": member.GroupDetail.sgdt_group_chk,
                "sgdt_exit": member.GroupDetail.sgdt_exit,
                "sgdt_show": member.GroupDetail.sgdt_show,
                "sgdt_push_chk": member.GroupDetail.sgdt_push_chk,
                "mt_lang": member.Member.mt_lang
            } for member in members]
        except Exception as e:
            logger.error(f"Error in get_member_list: {e}")
            return []

    @classmethod
    def get_leader_count(cls, db: Session, mt_idx: int) -> int:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sgdt_leader_chk == LeaderCheckEnum.Y,
            cls.sgdt_discharge == DischargeEnum.N,
            cls.sgdt_exit == ExitEnum.N,
            cls.sgdt_show == ShowEnum.Y
        ).count()

    @classmethod
    def get_group_count(cls, db: Session, mt_idx: int) -> int:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sgdt_discharge == DischargeEnum.N,
            cls.sgdt_exit == ExitEnum.N,
            cls.sgdt_show == ShowEnum.Y
        ).count() 