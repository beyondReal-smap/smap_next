#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PID_FILE="app.pid"

echo -e "${GREEN}FastAPI 애플리케이션 중지 스크립트${NC}"

# uvicorn 프로세스 종료
echo -e "${YELLOW}uvicorn 프로세스를 찾아서 종료합니다...${NC}"

# 포트 8000을 사용하는 프로세스 찾기
PORT_8000_PIDS=$(lsof -ti:8000 2>/dev/null)

if [ ! -z "$PORT_8000_PIDS" ]; then
    echo "포트 8000을 사용하는 프로세스들을 종료합니다:"
    for pid in $PORT_8000_PIDS; do
        echo "  - PID $pid 종료 중..."
        kill -9 $pid 2>/dev/null
    done
    echo -e "${GREEN}포트 8000 프로세스들이 종료되었습니다.${NC}"
else
    echo -e "${YELLOW}포트 8000을 사용하는 프로세스가 없습니다.${NC}"
fi

# uvicorn 프로세스 직접 찾기
UVICORN_PIDS=$(pgrep -f "uvicorn.*8000" 2>/dev/null)

if [ ! -z "$UVICORN_PIDS" ]; then
    echo "uvicorn 프로세스들을 종료합니다:"
    for pid in $UVICORN_PIDS; do
        echo "  - uvicorn PID $pid 종료 중..."
        kill -9 $pid 2>/dev/null
    done
    echo -e "${GREEN}uvicorn 프로세스들이 종료되었습니다.${NC}"
else
    echo -e "${YELLOW}실행 중인 uvicorn 프로세스가 없습니다.${NC}"
fi

# 기존 PID 파일 기반 종료
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}실행 중인 애플리케이션이 없습니다.${NC}"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p $PID > /dev/null; then
    echo "애플리케이션을 중지합니다. (PID: $PID)"
    kill $PID
    rm "$PID_FILE"
    echo -e "${GREEN}애플리케이션이 중지되었습니다.${NC}"
else
    echo -e "${YELLOW}애플리케이션이 이미 중지되었습니다.${NC}"
    rm "$PID_FILE"
fi

echo -e "${GREEN}모든 서비스가 중지되었습니다.${NC}" 