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
    FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH', '/app/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json') 