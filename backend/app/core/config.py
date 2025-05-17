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
        "http://118.67.130.71:3000",  # 프론트엔드 서버
        "http://118.67.130.71:8000",  # 백엔드 서버
        "http://frontend:3000",  # Docker 네트워크 내 프론트엔드 컨테이너
        "http://127.0.0.1:3000",  # 로컬 IP
    ]
    
    # MySQL 데이터베이스 설정
    MYSQL_HOST: str = "host.docker.internal"
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
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings() 