#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 로그 디렉토리 설정
LOG_DIR="logs"
PID_FILE="app.pid"
LOG_FILE="$LOG_DIR/app.log"
SSL_CERT_FILE="cert.pem"
SSL_KEY_FILE="key.pem"

echo -e "${GREEN}FastAPI 애플리케이션 시작 스크립트${NC}"

# SSL 인증서 확인
if [ ! -f "$SSL_CERT_FILE" ] || [ ! -f "$SSL_KEY_FILE" ]; then
    echo -e "${RED}SSL 인증서 파일이 없습니다.${NC}"
    echo "인증서 파일을 생성합니다..."
    openssl req -x509 -newkey rsa:4096 -nodes -out "$SSL_CERT_FILE" -keyout "$SSL_KEY_FILE" -days 365 -subj "/CN=localhost"
    if [ $? -ne 0 ]; then
        echo -e "${RED}SSL 인증서 생성 실패${NC}"
        exit 1
    fi
    echo -e "${GREEN}SSL 인증서가 생성되었습니다.${NC}"
fi

# 로그 디렉토리 생성
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi

# 이미 실행 중인지 확인
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then
        echo -e "${RED}이미 애플리케이션이 실행 중입니다. (PID: $PID)${NC}"
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

# Python 버전 확인
python_version=$(python3 --version 2>&1)
echo "Python 버전: $python_version"

# 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "가상환경 생성 중..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}가상환경 생성 실패${NC}"
        exit 1
    fi
fi

# 가상환경 활성화
echo "가상환경 활성화 중..."
source venv/bin/activate

# 필요한 패키지 설치
echo "의존성 패키지 설치 중..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}패키지 설치 실패${NC}"
    exit 1
fi

# 환경 변수 파일 확인
if [ ! -f ".env" ]; then
    echo -e "${RED}경고: .env 파일이 없습니다.${NC}"
    echo "기본 환경 변수를 사용합니다."
fi

# 애플리케이션 실행
echo -e "${GREEN}FastAPI 애플리케이션을 백그라운드에서 시작합니다...${NC}"
echo "포트: 8000"
echo "API 문서: https://localhost:8000/docs 또는 https://localhost:8000/redoc"
echo "로그 파일: $LOG_FILE"
echo "PID 파일: $PID_FILE"

# MYSQL_HOST를 127.0.0.1로 강제 설정
export MYSQL_HOST_VAL="127.0.0.1"
export MYSQL_USER_VAL=${MYSQL_USER:-smap2}
export MYSQL_PASSWORD_VAL=${MYSQL_PASSWORD:-dmonster}
export MYSQL_DB_VAL=${MYSQL_DB:-smap2_db}
export MYSQL_PORT_VAL=${MYSQL_PORT:-3306}
export MYSQL_CHARSET_VAL=${MYSQL_CHARSET:-utf8mb4}

export SQLALCHEMY_DATABASE_URI="mysql+pymysql://${MYSQL_USER_VAL}:${MYSQL_PASSWORD_VAL}@${MYSQL_HOST_VAL}:${MYSQL_PORT_VAL}/${MYSQL_DB_VAL}?charset=${MYSQL_CHARSET_VAL}"

echo "Using SQLALCHEMY_DATABASE_URI: $SQLALCHEMY_DATABASE_URI" >> "$LOG_FILE"

# 애플리케이션 실행 (백그라운드)
echo "FastAPI 애플리케이션을 백그라운드에서 시작합니다..."
# MYSQL_HOST를 명시적으로 127.0.0.1로 설정하여 uvicorn 실행
nohup env MYSQL_HOST="127.0.0.1" uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile "$SSL_KEY_FILE" --ssl-certfile "$SSL_CERT_FILE" >> "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

sleep 2 # 애플리케이션 시작 대기

if ps -p $PID > /dev/null; then
    echo -e "${GREEN}애플리케이션이 성공적으로 시작되었습니다. (PID: $PID)${NC}"
else
    echo -e "${RED}애플리케이션 시작 실패. 로그 파일을 확인하세요: $LOG_FILE${NC}"
    cat "$LOG_FILE" # 실패 시 로그 출력
    exit 1
fi 