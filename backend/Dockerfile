# backend/Dockerfile
# 프로덕션에 적합한 Python 이미지 사용 (원하는 버전)
FROM python:3.10-alpine 
WORKDIR /app
# requirements.txt 복사
COPY requirements.txt ./ 
# 의존성 설치
RUN pip install --no-cache-dir -r requirements.txt 
# Gunicorn 또는 Uvicorn 등 프로덕션 서버를 requirements.txt에 추가해야 함
# 예: requirements.txt에 gunicorn==X.Y.Z 추가

# 소스 코드 전체 복사
COPY . . 

# 백엔드 서비스 포트 (컨테이너 내부)
EXPOSE 5000 

# 프로덕션 서버 실행 명령어
# CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"] # Flask + Gunicorn 예시 (-w 4는 워커 수)
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "main:app"] # 간단한 Gunicorn 예시
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"] # FastAPI + Uvicorn 예시