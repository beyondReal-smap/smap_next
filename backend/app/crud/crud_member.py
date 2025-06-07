from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.member import Member
from app.schemas.member import MemberCreate, MemberUpdate, RegisterRequest
from typing import Optional, List
from datetime import datetime, date
import bcrypt

class CRUDMember:
    def __init__(self, model: type[Member]):
        self.model = model

    def get(self, db: Session, id: int) -> Optional[Member]:
        """ID로 회원 조회"""
        return db.query(self.model).filter(self.model.mt_idx == id).first()

    def get_by_phone(self, db: Session, phone: str) -> Optional[Member]:
        """전화번호로 회원 조회"""
        clean_phone = phone.replace('-', '')
        return db.query(self.model).filter(self.model.mt_id == clean_phone).first()

    def get_by_email(self, db: Session, email: str) -> Optional[Member]:
        """이메일로 회원 조회"""
        return db.query(self.model).filter(self.model.mt_email == email).first()

    def get_by_phone_or_email(self, db: Session, identifier: str) -> Optional[Member]:
        """전화번호 또는 이메일로 회원 조회"""
        if '@' in identifier:
            return self.get_by_email(db, identifier)
        else:
            return self.get_by_phone(db, identifier)

    def get_multi(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[int] = None,
        level: Optional[int] = None
    ) -> List[Member]:
        """회원 목록 조회"""
        query = db.query(self.model)
        
        if status is not None:
            query = query.filter(self.model.mt_status == status)
        if level is not None:
            query = query.filter(self.model.mt_level == level)
            
        return query.offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: MemberCreate) -> Member:
        """회원 생성"""
        # 비밀번호 해싱
        hashed_password = self.hash_password(obj_in.mt_pwd)
        
        # 전화번호 정리 (하이픈 제거)
        clean_phone = obj_in.mt_id.replace('-', '')
        
        db_obj = self.model(
            mt_type=obj_in.mt_type,
            mt_level=obj_in.mt_level,
            mt_status=obj_in.mt_status,
            mt_id=clean_phone,
            mt_pwd=hashed_password,
            mt_name=obj_in.mt_name,
            mt_nickname=obj_in.mt_nickname,
            mt_hp=clean_phone,  # 연락처도 동일하게 설정
            mt_email=obj_in.mt_email,
            mt_birth=obj_in.mt_birth,
            mt_gender=obj_in.mt_gender,
            mt_show=obj_in.mt_show,
            mt_agree1=obj_in.mt_agree1,
            mt_agree2=obj_in.mt_agree2,
            mt_agree3=obj_in.mt_agree3,
            mt_agree4=obj_in.mt_agree4,
            mt_agree5=obj_in.mt_agree5,
            mt_push1=obj_in.mt_push1,
            mt_lat=obj_in.mt_lat,
            mt_long=obj_in.mt_long,
            mt_onboarding=obj_in.mt_onboarding,
            mt_wdate=datetime.utcnow(),
            mt_adate=datetime.utcnow()
        )
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_from_register(self, db: Session, *, obj_in: RegisterRequest) -> Member:
        """회원가입 요청으로부터 회원 생성"""
        # 비밀번호 해싱
        hashed_password = self.hash_password(obj_in.mt_pwd)
        
        # 전화번호 정리 (하이픈 제거)
        clean_phone = obj_in.mt_id.replace('-', '')
        
        # 생년월일 변환
        birth_date = None
        if obj_in.mt_birth:
            try:
                birth_date = datetime.strptime(obj_in.mt_birth, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        db_obj = self.model(
            mt_type=obj_in.mt_type,
            mt_level=obj_in.mt_level,
            mt_status=obj_in.mt_status,
            mt_id=clean_phone,
            mt_pwd=hashed_password,
            mt_name=obj_in.mt_name,
            mt_nickname=obj_in.mt_nickname,
            mt_hp=clean_phone,
            mt_email=obj_in.mt_email,
            mt_birth=birth_date,
            mt_gender=obj_in.mt_gender,
            mt_show=obj_in.mt_show,
            mt_agree1='Y' if obj_in.mt_agree1 else 'N',
            mt_agree2='Y' if obj_in.mt_agree2 else 'N',
            mt_agree3='Y' if obj_in.mt_agree3 else 'N',
            mt_agree4='Y' if obj_in.mt_agree4 else 'N',
            mt_agree5='Y' if obj_in.mt_agree5 else 'N',
            mt_push1='Y' if obj_in.mt_push1 else 'N',
            mt_lat=obj_in.mt_lat,
            mt_long=obj_in.mt_long,
            mt_onboarding=obj_in.mt_onboarding,
            mt_wdate=datetime.utcnow(),
            mt_adate=datetime.utcnow()
        )
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, 
        db: Session, 
        *, 
        db_obj: Member, 
        obj_in: MemberUpdate
    ) -> Member:
        """회원 정보 수정"""
        update_data = obj_in.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db_obj.mt_udate = datetime.utcnow()
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: int) -> Member:
        """회원 삭제 (실제로는 탈퇴 처리)"""
        obj = db.query(self.model).get(id)
        if obj:
            obj.mt_level = 1  # 탈퇴 상태로 변경
            obj.mt_rdate = datetime.utcnow()
            obj.mt_udate = datetime.utcnow()
            db.add(obj)
            db.commit()
        return obj

    def authenticate(self, db: Session, *, phone_or_email: str, password: str) -> Optional[Member]:
        """로그인 인증"""
        user = self.get_by_phone_or_email(db, phone_or_email)
        if not user:
            return None
        if not self.verify_password(password, user.mt_pwd):
            return None
        return user

    def is_active(self, user: Member) -> bool:
        """회원 활성 상태 확인"""
        return user.mt_status == 1 and user.mt_level > 1

    def is_superuser(self, user: Member) -> bool:
        """관리자 권한 확인"""
        return user.mt_level == 9

    @staticmethod
    def hash_password(password: str) -> str:
        """비밀번호 해싱"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """비밀번호 검증"""
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception:
            return False

    def update_login_time(self, db: Session, *, user: Member) -> Member:
        """로그인 시간 업데이트"""
        user.mt_ldate = datetime.utcnow()
        user.mt_adate = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def update_location(self, db: Session, *, user: Member, lat: float, lng: float) -> Member:
        """위치 정보 업데이트"""
        user.mt_lat = lat
        user.mt_long = lng
        user.mt_udate = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def search(self, db: Session, *, query: str, skip: int = 0, limit: int = 100) -> List[Member]:
        """회원 검색 (이름, 닉네임, 전화번호, 이메일)"""
        return db.query(self.model).filter(
            or_(
                self.model.mt_name.contains(query),
                self.model.mt_nickname.contains(query),
                self.model.mt_id.contains(query),
                self.model.mt_email.contains(query)
            )
        ).filter(
            and_(
                self.model.mt_status == 1,
                self.model.mt_level > 1
            )
        ).offset(skip).limit(limit).all()

# 인스턴스 생성
crud_member = CRUDMember(Member) 