from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class BaseModel(Base):
    __abstract__ = True
    # 공통 컬럼은 실제 DB에 존재할 때만 선언 