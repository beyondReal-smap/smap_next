from sqlalchemy import Column, Integer, String, DateTime, Numeric, Enum, text, Date
from sqlalchemy.dialects.mysql import DECIMAL, TINYINT
from app.models.base import BaseModel
from datetime import datetime, date
from sqlalchemy.orm import Session
from typing import Optional, List

class Member(BaseModel):
    __tablename__ = "member_t"

    mt_idx = Column(Integer, primary_key=True, autoincrement=True)
    mt_type = Column(TINYINT(1), nullable=True, comment='로그인구분 1:일반, 2:카톡, 3:애플, 4:구글')
    mt_level = Column(TINYINT(1), nullable=True, comment='회원등급 1:탈퇴, 2:일반(무료), 3:휴면, 4:유예,5:유료 9:관리자')
    mt_recommend_chk = Column(Enum('Y', 'N'), default='N', comment='추천인 사용 체크 여부 Y:사용 N:사용안함')
    mt_last_receipt_token = Column(String, nullable=True, comment='마지막 영수증 토큰')
    mt_plan_date = Column(DateTime, nullable=True, comment='플랜 마감일자')
    mt_plan_check = Column(Enum('Y', 'N'), default='N', comment='플랜 구독 여부(Y:진행중 N:보류 및 취소)')
    mt_os_check = Column(TINYINT(1), default=0, comment='os체크(0:aos, 1:ios)')
    mt_rec_date = Column(DateTime, nullable=True, comment='추천인 사용일자')
    mt_status = Column(TINYINT(1), nullable=True, comment='회원상태 1:정상, 2:정지')
    mt_id = Column(String(200), nullable=True, comment='아이디(전화번호)')
    mt_id_retire = Column(String(200), nullable=True, comment='탈퇴 아이디')
    mt_pwd = Column(String(200), nullable=True, comment='비밀번호')
    mt_pwd_cnt = Column(TINYINT(1), nullable=True, comment='비밀번호 체크 카운터 로그인하면 리셋')
    mt_token_id = Column(String(255), nullable=True, comment='앱토큰 아이디')
    mt_name = Column(String(50), nullable=True, comment='이름')
    mt_nickname = Column(String(50), nullable=True, comment='닉네임')
    mt_hp = Column(String(20), nullable=True, comment='연락처')
    mt_email = Column(String(200), nullable=True, comment='이메일')
    mt_birth = Column(Date, nullable=True, comment='생년월일')
    mt_gender = Column(TINYINT(1), nullable=True, comment='성별')
    mt_file1 = Column(String(50), nullable=True, comment='프로필 이미지')
    mt_show = Column(Enum('Y', 'N'), default='Y', comment='노출여부 Y:노출, N:노출안함')
    mt_agree1 = Column(Enum('Y', 'N'), default='N', comment='서비스이용약관 동의여부')
    mt_agree2 = Column(Enum('Y', 'N'), default='N', comment='개인정보 처리방침 동의여부')
    mt_agree3 = Column(Enum('Y', 'N'), default='N', comment='위치기반서비스 이용약관 동의여부')
    mt_agree4 = Column(Enum('Y', 'N'), default='N', comment='개인정보 제3자 제공 동의여부')
    mt_agree5 = Column(Enum('Y', 'N'), default='N', comment='마케팅 정보 수집 및 이용 동의')
    mt_push1 = Column(Enum('Y', 'N'), default='N', comment='알림수신여부 동의')
    mt_lat = Column(DECIMAL(16, 14), nullable=True, comment='경도 앱시작시')
    mt_long = Column(DECIMAL(17, 14), nullable=True, comment='위도 앱시작시')
    mt_sido = Column(String(20), nullable=True, comment='접속위치 시도')
    mt_gu = Column(String(20), nullable=True, comment='접속위치 구군')
    mt_dong = Column(String(20), nullable=True, comment='접속위치 읍면동')
    mt_onboarding = Column(Enum('Y', 'N'), default='N', comment='온보딩')
    mt_weather_pop = Column(String(10), nullable=True, comment='강수확률 %')
    mt_weather_sky = Column(TINYINT(1), nullable=True, comment='하늘상태 1-8')
    mt_weather_tmn = Column(TINYINT(2), nullable=True, comment='최저기온 썹시')
    mt_weather_tmx = Column(TINYINT(2), nullable=True, comment='최고기온 썹시')
    mt_weather_date = Column(DateTime, nullable=True, comment='날씨 등록일')
    mt_wdate = Column(DateTime, nullable=True, comment='등록일시')
    mt_ldate = Column(DateTime, nullable=True, comment='로그인일시')
    mt_lgdate = Column(DateTime, nullable=True, comment='로그아웃일시')
    mt_retire_chk = Column(TINYINT(1), nullable=True, comment='회원탈퇴사유 1-4번 이유')
    mt_retire_etc = Column(String(100), nullable=True, comment='회원탈퇴사유 4번 기타이유 입력')
    mt_retire_level = Column(TINYINT(1), nullable=True, comment='이전 탈퇴레벨')
    mt_rdate = Column(DateTime, nullable=True, comment='회원탈퇴일시')
    mt_adate = Column(DateTime, nullable=True, comment='회원최근접속일시')
    mt_udate = Column(DateTime, nullable=True, comment='수정일시')
    mt_update_dt = Column(DateTime, nullable=True, comment='Cache Data관리를 위한 필드')
    mt_reset_token = Column(String(100), nullable=True, comment='비밀번호 인증토큰')
    mt_token_edate = Column(DateTime, nullable=True, comment='토큰만료일시')
    mt_lang = Column(String(2), default='ko', comment='사용자언어')
    mt_map = Column(Enum('Y', 'N'), default='N', comment='지도 선택 - 네이버 : N / 구글 : Y')
    mt_remember_token = Column(String(255), nullable=True)
    mt_token_expiry = Column(DateTime, nullable=True)
    mt_google_id = Column(String(255), nullable=True, comment='Google 계정 ID')
    mt_kakao_id = Column(String(255), nullable=True, comment='Kakao 계정 ID')

    @classmethod
    def find_by_email(cls, db: Session, email: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_email == email).first()

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_idx == idx).first()

    @classmethod
    def find_by_id(cls, db: Session, member_id: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_id == member_id).first()

    @classmethod
    def find_by_token(cls, db: Session, token: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_token_id == token).first()

    @classmethod
    def get_not_join_group_11(cls, db: Session) -> List['Member']:
        before_11 = datetime.now() - datetime.timedelta(days=11)
        before_11_sday = before_11.strftime("%Y-%m-%d 00:00:00")
        before_11_eday = before_11.strftime("%Y-%m-%d 23:59:59")

        sql = text("""
            SELECT a1.*, a2.sgdt_owner_chk 
            FROM member_t a1 
            LEFT JOIN smap_group_detail_t a2 ON a1.mt_idx = a2.mt_idx
            WHERE (a1.mt_level = 2 AND a1.mt_wdate BETWEEN :start_date AND :end_date)
            AND (a2.sgdt_owner_chk = 'Y' AND a2.sgdt_discharge = 'N' 
                 AND a2.sgdt_exit = 'N' AND a2.sgdt_show = 'Y')
            GROUP BY a1.mt_idx
        """)
        
        return db.execute(sql, {
            "start_date": before_11_sday,
            "end_date": before_11_eday
        }).fetchall()

    @classmethod
    def get_token_list(cls, db: Session) -> List['Member']:
        return db.query(cls).filter(
            cls.mt_level > 1,
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != "",
            cls.mt_status == 1
        ).all()

    @classmethod
    def get_sign_in_3(cls, db: Session) -> List['Member']:
        before3h_start = datetime.now() - datetime.timedelta(hours=3)
        before3h_end = before3h_start + datetime.timedelta(hours=1)
        now_stime = before3h_start.strftime("%Y-%m-%d %H:%M:%S")
        now_etime = before3h_end.strftime("%Y-%m-%d %H:%M:%S")
        
        return db.query(cls).filter(
            cls.mt_wdate.between(now_stime, now_etime),
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != ""
        ).all()

    @classmethod
    def get_sign_in_24(cls, db: Session) -> List['Member']:
        before24h_start = datetime.now() - datetime.timedelta(hours=24)
        before24h_end = before24h_start + datetime.timedelta(hours=1)
        now_stime = before24h_start.strftime("%Y-%m-%d %H:%M:%S")
        now_etime = before24h_end.strftime("%Y-%m-%d %H:%M:%S")
        
        return db.query(cls).filter(
            cls.mt_wdate.between(now_stime, now_etime),
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != ""
        ).all() 