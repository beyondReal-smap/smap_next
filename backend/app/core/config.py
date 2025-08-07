from typing import List
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl

class Settings(BaseSettings):
    PROJECT_NAME: str = "SMAP API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # CORS 설정
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js 개발 서버
        "http://localhost:8000",  # FastAPI 개발 서버
        # 배포 도메인들
        "https://nextstep.smap.site",
        "https://smap.co.kr",
        # 레거시 IP는 제거 (iOS에서 인증서 경고 유발)
        "http://127.0.0.1:3000",  # 로컬 IP
    ]
    
    # 프론트엔드 URL (비밀번호 재설정 링크용)
    FRONTEND_URL: str = "https://nextstep.smap.site"
    
    # MySQL 데이터베이스 설정
    MYSQL_HOST: str = "118.67.130.71"
    MYSQL_USER: str = "smap2"
    MYSQL_PASSWORD: str = "dmonster"
    MYSQL_DB: str = "smap2_db"
    MYSQL_PORT: int = 3306
    MYSQL_CHARSET: str = "utf8mb4"
    
    # SQLAlchemy 데이터베이스 URI (FastAPI 권장)
    SQLALCHEMY_DATABASE_URI: str = (
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset={MYSQL_CHARSET}"
    )
    
    # JWT 설정
    JWT_SECRET_KEY: str = "smap!@super-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Firebase 설정
    FIREBASE_CREDENTIALS_PATH: str = "backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"
    FIREBASE_PROJECT_ID: str = "com-dmonster-smap"
    
    # 하위 호환성을 위한 별칭
    @property
    def SECRET_KEY(self) -> str:
        return self.JWT_SECRET_KEY
    
    @property 
    def ALGORITHM(self) -> str:
        return self.JWT_ALGORITHM
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings() 