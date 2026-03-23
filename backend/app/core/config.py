from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, AnyHttpUrl, Field, model_validator

# 경로 해석에 사용할 기준 디렉토리
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
_REPO_ROOT = _BACKEND_DIR.parent  # smap_next/


def _resolve_path(path_value: str) -> str:
    """상대 경로를 절대 경로로 해석합니다."""
    path = Path(path_value)
    if path.is_absolute():
        return str(path)
    if path_value.startswith("backend/"):
        return str(_REPO_ROOT / path_value)
    return str(_BACKEND_DIR / path_value)


class Settings(BaseSettings):
    PROJECT_NAME: str = "SMAP API"
    VERSION: str = "1.0.0"
    # API 설정
    API_V1_STR: str = "/api/v1"

    # 디버그 모드 (테스트/디버그 엔드포인트 활성화)
    DEBUG: bool = False

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
    MYSQL_USER: str = Field(default=..., validation_alias=AliasChoices("MYSQL_USER"))
    MYSQL_PASSWORD: str = Field(default=..., validation_alias=AliasChoices("MYSQL_PASSWORD"))
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
    JWT_SECRET_KEY: str = Field(default=..., validation_alias=AliasChoices("JWT_SECRET_KEY"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30일 (30 * 24 * 60)

    # Aligo SMS 설정
    ALIGO_USER_ID: str = Field(default="", validation_alias=AliasChoices("ALIGO_USER_ID"))
    ALIGO_KEY: str = Field(default="", validation_alias=AliasChoices("ALIGO_KEY"))
    ALIGO_SENDER: str = Field(default="", validation_alias=AliasChoices("ALIGO_SENDER"))

    # Firebase 설정
    FIREBASE_CREDENTIALS_PATH: str = "backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"
    FIREBASE_PROJECT_ID: str = "com-dmonster-smap"

    # iOS 푸시 설정
    IOS_BUNDLE_ID: str = "com.dmonster.smap"
    IOS_PUSH_RETRY_COUNT: int = 3

    # 비밀번호 정책 설정
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_BCRYPT_COST: int = 12
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBERS: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True

    # 이메일 (SMTP) 설정
    EMAIL_SENDER: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_SMTP_SERVER: str = "smtp.gmail.com"
    EMAIL_SMTP_PORT: int = 465

    # 하위 호환성을 위한 별칭
    @property
    def SECRET_KEY(self) -> str:
        return self.JWT_SECRET_KEY

    @property
    def ALGORITHM(self) -> str:
        return self.JWT_ALGORITHM

    @model_validator(mode="after")
    def _post_init(self):
        """DB URI 생성 및 Firebase 인증서 경로 해석"""
        # SQLAlchemy URI
        if not self.SQLALCHEMY_DATABASE_URI:
            self.SQLALCHEMY_DATABASE_URI = (
                f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
                f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset={self.MYSQL_CHARSET}"
            )
        # Firebase 인증서 파일 경로를 절대 경로로 해석
        self.FIREBASE_CREDENTIALS_PATH = _resolve_path(self.FIREBASE_CREDENTIALS_PATH)
        return self

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
