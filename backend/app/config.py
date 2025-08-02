import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

class Config:
    # 데이터베이스 설정
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{os.getenv('MYSQL_USER', 'smap2')}:{os.getenv('MYSQL_PASSWORD', 'dmonster')}@{os.getenv('MYSQL_HOST', 'localhost')}:{os.getenv('MYSQL_PORT', '3306')}/{os.getenv('MYSQL_DATABASE', 'smap2_db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 3600,
        'pool_pre_ping': True
    }

    # Flask 설정
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    
    # Firebase 설정
    FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH', 'backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json')
    
    # 비밀번호 해시화 설정 (PHP PASSWORD_DEFAULT와 유사)
    PASSWORD_DEFAULT = "2y"  # bcrypt 알고리즘 식별자
    PASSWORD_BCRYPT_COST = int(os.getenv('PASSWORD_BCRYPT_COST', '12'))  # bcrypt 비용 (기본값: 12)
    PASSWORD_MIN_LENGTH = int(os.getenv('PASSWORD_MIN_LENGTH', '8'))  # 최소 비밀번호 길이
    
    # 비밀번호 정책 설정
    PASSWORD_REQUIRE_UPPERCASE = os.getenv('PASSWORD_REQUIRE_UPPERCASE', 'true').lower() == 'true'
    PASSWORD_REQUIRE_LOWERCASE = os.getenv('PASSWORD_REQUIRE_LOWERCASE', 'true').lower() == 'true'
    PASSWORD_REQUIRE_NUMBERS = os.getenv('PASSWORD_REQUIRE_NUMBERS', 'true').lower() == 'true'
    PASSWORD_REQUIRE_SPECIAL = os.getenv('PASSWORD_REQUIRE_SPECIAL', 'true').lower() == 'true'
    
    # 프론트엔드 URL 설정
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # 이메일 설정
    EMAIL_SENDER = os.getenv('EMAIL_SENDER', 'your-email@gmail.com')
    EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', 'your-app-password') 