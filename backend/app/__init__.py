# Flask 관련 코드는 FastAPI와 충돌하므로 주석 처리
# from flask import Flask
# from flask_sqlalchemy import SQLAlchemy
# from .config import Config

# # SQLAlchemy 인스턴스 생성
# db = SQLAlchemy()

# def create_app(config_class=Config):
#     app = Flask(__name__)
#     app.config.from_object(config_class)

#     # 데이터베이스 초기화
#     db.init_app(app)

#     # 블루프린트 등록
#     from .api import main
#     app.register_blueprint(main.bp)

#     # 데이터베이스 테이블 생성
#     with app.app_context():
#         db.create_all()

#     return app

# FastAPI 전용으로 변경
pass 