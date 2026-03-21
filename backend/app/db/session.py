from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=settings.DB_POOL_RECYCLE,
    # 연결 풀 설정 추가
    pool_size=settings.DB_POOL_SIZE,           # 기본 연결 풀 크기
    max_overflow=settings.DB_MAX_OVERFLOW,    # 오버플로우 연결 수
    pool_timeout=settings.DB_POOL_TIMEOUT,    # 연결 대기 시간
    pool_reset_on_return='commit',  # 연결 반환 시 자동 커밋
)
logger.info(f"Engine URL in session.py: {engine.url}")
logger.info(f"Database pool settings - Size: {settings.DB_POOL_SIZE}, Max Overflow: {settings.DB_MAX_OVERFLOW}, Timeout: {settings.DB_POOL_TIMEOUT}s")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 데이터베이스 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 