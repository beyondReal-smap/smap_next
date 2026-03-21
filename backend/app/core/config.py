from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, AnyHttpUrl, Field, model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "SMAP API"
    VERSION: str = "1.0.0"
    # API 설정
    API_V1_STR: str = "/api/v1"
    
    # CORS 설정
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js 개발 서버
        "http://localhost:8000",  # FastAPI 개발 서버
        # 배포 도메인들
        "https://nextstep.smap.site",
        "https://smap.co.kr",
        # 추가 허용 도메인
        "http://api3.smap.site:3000",
        "https://api3.smap.site:3000",
        # 레거시 IP는 제거 (iOS에서 인증서 경고 유발)
        "http://127.0.0.1:3000",  # 로컬 IP
    ]
    
    # 프론트엔드 URL (비밀번호 재설정 링크용)
    FRONTEND_URL: str = "https://nextstep.smap.site"
    
    # MySQL 데이터베이스 설정
    MYSQL_HOST: str = "127.0.0.1"
    MYSQL_USER: str = "smap2"
    MYSQL_PASSWORD: str = "dmonster"
    MYSQL_DB: str = Field(
        default="smap2_db",
        validation_alias=AliasChoices("MYSQL_DB", "MYSQL_DATABASE"),
    )
    MYSQL_PORT: int = 3306
    MYSQL_CHARSET: str = "utf8mb4"
    
    # SQLAlchemy 데이터베이스 URI (FastAPI 권장)
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    
    # 데이터베이스 연결 풀 설정
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_TIMEOUT: int = 60
    DB_POOL_RECYCLE: int = 3600
    
    # JWT 설정
    JWT_SECRET_KEY: str = "smap!@super-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 129600  # 90일 (90 * 24 * 60)
    
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

    @model_validator(mode="after")
    def build_database_uri(self):
        if not self.SQLALCHEMY_DATABASE_URI:
            self.SQLALCHEMY_DATABASE_URI = (
                f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
                f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset={self.MYSQL_CHARSET}"
            )
        return self
    
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
