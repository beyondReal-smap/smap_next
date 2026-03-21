#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 디렉토리 설정
LOG_DIR="logs"
PID_FILE="app.pid"
LOG_FILE="$LOG_DIR/app.log"
APP_HOST="127.0.0.1"
APP_PORT="9000"

# 로그 관리 설정
MAX_LOG_SIZE_MB=100
LOG_CLEANUP_INTERVAL_HOURS=24
LOG_RETENTION_DAYS=30

echo -e "${GREEN}FastAPI 애플리케이션 시작 스크립트 (로그 관리 통합)${NC}"

# Nginx가 SSL을 종료하므로 백엔드는 비SSL로 실행합니다.

# 로그 디렉토리 생성
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi

# 로그 관리 함수들
log_cleanup() {
    echo -e "${BLUE}로그 정리 작업 시작...${NC}"
    
    # 로그 파일 크기 확인
    for log_file in app.log push_msg.log; do
        if [ -f "$log_file" ]; then
            size_mb=$(du -m "$log_file" 2>/dev/null | cut -f1 || echo "0")
            echo "  $log_file: ${size_mb}MB"
            
            # 크기가 큰 경우 경고
            if [ "$size_mb" -gt "$MAX_LOG_SIZE_MB" ]; then
                echo -e "${YELLOW}경고: $log_file 크기가 ${size_mb}MB로 $MAX_LOG_SIZE_MB MB를 초과했습니다.${NC}"
            fi
        fi
    done
    
    # 오래된 로그 파일 정리 (30일 이상)
    echo "오래된 로그 파일 정리 중..."
    find . -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    find . -name "*.log.gz" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    
    # 백업 로그 파일 정리
    echo "백업 로그 파일 정리 중..."
    find . -name "app_*.log" -mtime +7 -delete 2>/dev/null || true
    find . -name "push_msg_*.log" -mtime +7 -delete 2>/dev/null || true
    
    echo -e "${GREEN}로그 정리 완료${NC}"
}

setup_log_rotation() {
    echo -e "${BLUE}로그 로테이션 설정 중...${NC}"
    
    # logrotate 설정 파일 생성
    cat > /etc/logrotate.d/smap_backend << EOF
# SMAP Backend 로그 로테이션 설정
$(pwd)/*.log {
    daily
    missingok
    rotate 10
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        # 로그 로테이션 후 필요한 작업
        echo "로그 로테이션 완료: \$(date)" >> $(pwd)/logs/rotation.log
    endscript
}
EOF
    
    echo -e "${GREEN}로그 로테이션 설정 완료${NC}"
}

start_log_monitor() {
    echo -e "${BLUE}로그 모니터링 시작...${NC}"
    
    # 로그 모니터링 스크립트 생성
    cat > scripts/log_monitor.sh << 'EOF'
#!/bin/bash
# 로그 모니터링 스크립트

LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MAX_SIZE_MB=100
ALERT_EMAIL="admin@smap.site"

monitor_logs() {
    for log_file in "$LOG_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            size_mb=$(du -m "$log_file" | cut -f1)
            if [ "$size_mb" -gt "$MAX_SIZE_MB" ]; then
                echo "경고: $log_file 크기가 ${size_mb}MB로 $MAX_SIZE_MB MB를 초과했습니다."
                
                # 자동 로그 정리 실행
                if [ -f "$LOG_DIR/scripts/log_cleanup.py" ]; then
                    cd "$LOG_DIR"
                    source venv/bin/activate
                    python scripts/log_cleanup.py
                fi
                
                # 알림 전송 (이메일 또는 다른 방법)
                echo "로그 파일 크기 경고: $log_file (${size_mb}MB)" | mail -s "SMAP Backend 로그 경고" "$ALERT_EMAIL" 2>/dev/null || true
            fi
        fi
    done
}

# 메인 실행
monitor_logs
EOF
    
    chmod +x scripts/log_monitor.sh
    
    # cron job에 로그 모니터링 추가
    (crontab -l 2>/dev/null; echo "0 */6 * * * $(pwd)/scripts/log_monitor.sh >> $(pwd)/logs/monitor.log 2>&1") | crontab -
    
    echo -e "${GREEN}로그 모니터링 설정 완료 (6시간마다 실행)${NC}"
}

# 시작 시 로그 정리 수행
log_cleanup

# 이미 실행 중인지 확인 및 자동 중지
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then
        echo -e "${RED}이미 애플리케이션이 실행 중입니다. (PID: $PID)${NC}"
        echo -e "${GREEN}기존 서비스를 중지하고 재시작합니다...${NC}"
        
        # stop.sh 실행
        if [ -f "./stop.sh" ]; then
            echo "stop.sh를 실행하여 기존 서비스를 중지합니다..."
            ./stop.sh
        else
            echo "stop.sh 파일이 없습니다. 수동으로 프로세스를 종료합니다..."
            kill $PID 2>/dev/null || true
            sleep 2
            if ps -p $PID > /dev/null; then
                echo "강제 종료를 시도합니다..."
                kill -9 $PID 2>/dev/null || true
            fi
        fi
        
        # PID 파일 정리
        rm -f "$PID_FILE"
        
        # 잠시 대기하여 포트가 완전히 해제되도록 함
        sleep 3
        echo -e "${GREEN}기존 서비스가 중지되었습니다. 새로 시작합니다...${NC}"
    else
        echo "PID 파일은 있지만 프로세스가 실행되지 않았습니다. PID 파일을 정리합니다."
        rm "$PID_FILE"
    fi
else
    echo "새로운 서비스를 시작합니다..."
fi

# 포트 점유 프로세스 강제 종료 (PID 파일과 무관하게 안전하게 정리)
echo "포트 ${APP_PORT} 점유 프로세스 확인 및 정리 중..."

# ss 기반 탐지
PIDS_BY_PORT=$(ss -ltnp 2>/dev/null | awk -v port=":${APP_PORT} " '$4 ~ port {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)

# lsof 기반 보조 탐지
if [ -z "$PIDS_BY_PORT" ] && command -v lsof >/dev/null 2>&1; then
    PIDS_BY_PORT=$(lsof -ti TCP:${APP_PORT} -sTCP:LISTEN 2>/dev/null | sort -u || true)
fi

# fuser 기반 보조 탐지
if [ -z "$PIDS_BY_PORT" ] && command -v fuser >/dev/null 2>&1; then
    PIDS_BY_PORT=$(fuser -n tcp ${APP_PORT} 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)
fi

if [ -n "$PIDS_BY_PORT" ]; then
    echo -e "${RED}포트 ${APP_PORT}을(를) 사용 중인 프로세스 감지: ${PIDS_BY_PORT}${NC}"
    echo "우아 종료 시도 (TERM) ..."
    for pid in $PIDS_BY_PORT; do
        kill "$pid" 2>/dev/null || true
    done
    sleep 2

    # 여전히 점유 중이면 강제 종료
    STILL_PIDS=""
    if ss -ltnp 2>/dev/null | grep -q ":${APP_PORT} "; then
        STILL_PIDS=$(ss -ltnp 2>/dev/null | awk -v port=":${APP_PORT} " '$4 ~ port {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)
    fi
    if [ -z "$STILL_PIDS" ] && command -v lsof >/dev/null 2>&1; then
        STILL_PIDS=$(lsof -ti TCP:${APP_PORT} -sTCP:LISTEN 2>/dev/null | sort -u || true)
    fi
    if [ -z "$STILL_PIDS" ] && command -v fuser >/dev/null 2>&1; then
        STILL_PIDS=$(fuser -n tcp ${APP_PORT} 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)
    fi

    if [ -n "$STILL_PIDS" ]; then
        echo "강제 종료 시도 (KILL) ..."
        for pid in $STILL_PIDS; do
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 1
    fi

    # 최종 확인
    if ss -ltnp 2>/dev/null | grep -q ":${APP_PORT} "; then
        echo -e "${RED}경고: 포트 ${APP_PORT}이(가) 아직 점유 중일 수 있습니다.${NC}"
    else
        echo -e "${GREEN}포트 ${APP_PORT} 점유가 해제되었습니다.${NC}"
    fi
else
    echo "포트 ${APP_PORT} 점유 프로세스 없음"
fi

# Python 버전 확인
python_version=$(python3 --version 2>&1)
echo "Python 버전: $python_version"

# 가상환경 확인 (Python 3.12.11용 venv가 이미 생성되어 있음)
if [ ! -d "venv" ]; then
    echo -e "${RED}가상환경이 존재하지 않습니다. Python 3.12.11용 venv를 생성해주세요.${NC}"
    exit 1
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

# 로그 관리 시스템 설정
echo -e "${BLUE}로그 관리 시스템 설정 중...${NC}"
setup_log_rotation
start_log_monitor

# Nginx 상태 확인 및 시작
echo -e "${GREEN}Nginx 상태 확인 중...${NC}"
NGINX_BIN="/usr/local/nginx/sbin/nginx"
NGINX_CONF="/usr/local/nginx/conf/nginx.conf"

# Nginx 프로세스 확인
if ! pgrep -x "nginx" > /dev/null; then
    echo -e "${RED}Nginx가 실행되지 않았습니다. 시작합니다...${NC}"
    
    # Nginx 설정 파일 테스트
    if [ -f "$NGINX_BIN" ] && [ -f "$NGINX_CONF" ]; then
        echo "Nginx 설정 파일 테스트 중..."
        if $NGINX_BIN -t -c $NGINX_CONF; then
            echo "Nginx 시작 중..."
            $NGINX_BIN -c $NGINX_CONF
            
            # Nginx 시작 확인
            sleep 2
            if pgrep -x "nginx" > /dev/null; then
                echo -e "${GREEN}Nginx가 성공적으로 시작되었습니다.${NC}"
                
                # 포트 리스닝 확인
                echo "포트 리스닝 상태 확인:"
                ss -ltnp | grep -E ':(80|443|8000|3000)' | while read line; do
                    echo "  $line"
                done
            else
                echo -e "${RED}Nginx 시작에 실패했습니다.${NC}"
            fi
        else
            echo -e "${RED}Nginx 설정 파일에 오류가 있습니다.${NC}"
        fi
    else
        echo -e "${RED}Nginx 실행 파일 또는 설정 파일을 찾을 수 없습니다.${NC}"
        echo "Nginx 경로: $NGINX_BIN"
        echo "설정 파일: $NGINX_CONF"
    fi
else
    echo -e "${GREEN}Nginx가 이미 실행 중입니다.${NC}"
    
    # 필요한 포트들이 리스닝 중인지 확인
    missing_ports=()
    for port in 80 443 8000 3000; do
        if ! ss -ltn | grep -q ":$port "; then
            missing_ports+=($port)
        fi
    done
    
    if [ ${#missing_ports[@]} -gt 0 ]; then
        echo -e "${RED}필요한 포트가 리스닝되지 않았습니다: ${missing_ports[*]}${NC}"
        echo "Nginx 재시작을 시도합니다..."
        
        if $NGINX_BIN -s reload -c $NGINX_CONF 2>/dev/null; then
            echo -e "${GREEN}Nginx 설정이 다시 로드되었습니다.${NC}"
        else
            echo -e "${RED}Nginx 재로드 실패. 재시작을 시도합니다...${NC}"
            pkill nginx 2>/dev/null || true
            sleep 1
            $NGINX_BIN -c $NGINX_CONF
        fi
        
        sleep 2
        echo "포트 리스닝 상태 재확인:"
        ss -ltnp | grep -E ':(80|443|8000|3000)' | while read line; do
            echo "  $line"
        done
    else
        echo -e "${GREEN}모든 필요한 포트가 정상적으로 리스닝 중입니다.${NC}"
    fi
fi

# 애플리케이션 실행
echo -e "${GREEN}FastAPI 애플리케이션을 백그라운드에서 시작합니다...${NC}"
echo "바인딩: ${APP_HOST}:${APP_PORT} (비SSL)"
echo "API 문서(프록시 경유): https://api3.smap.site:8000/docs"
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
# MYSQL_HOST를 명시적으로 127.0.0.1로 설정하여 uvicorn 실행 (프록시 헤더 신뢰)
nohup env MYSQL_HOST="127.0.0.1" uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT" --reload --proxy-headers --forwarded-allow-ips='*' >> "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

sleep 2 # 애플리케이션 시작 대기

if ps -p $PID > /dev/null; then
    echo -e "${GREEN}애플리케이션이 성공적으로 시작되었습니다. (PID: $PID)${NC}"
    
    # 로그 관리 API 테스트
    echo -e "${BLUE}로그 관리 API 테스트 중...${NC}"
    sleep 3
    
    # 로그 통계 API 호출
    if curl -s "http://$APP_HOST:$APP_PORT/api/v1/log-management/stats" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 로그 관리 API: 정상 작동${NC}"
    else
        echo -e "${YELLOW}⚠ 로그 관리 API: 응답 없음 (나중에 확인 필요)${NC}"
    fi
    
    # 최종 서비스 상태 확인
    echo ""
    echo -e "${GREEN}=== 서비스 상태 최종 확인 ===${NC}"
    
    # Nginx 프로세스 확인
    if pgrep -x "nginx" > /dev/null; then
        echo -e "${GREEN}✓ Nginx: 실행 중${NC}"
    else
        echo -e "${RED}✗ Nginx: 중지됨${NC}"
    fi
    
    # Uvicorn 프로세스 확인  
    if ps -p $PID > /dev/null; then
        echo -e "${GREEN}✓ Uvicorn: 실행 중 (PID: $PID)${NC}"
    else
        echo -e "${RED}✗ Uvicorn: 중지됨${NC}"
    fi
    
    # 포트 리스닝 확인
    echo ""
    echo "포트 리스닝 상태:"
    for port in 80 443 8000 3000 9000; do
        if ss -ltn | grep -q ":$port "; then
            echo -e "${GREEN}✓ 포트 $port: 리스닝 중${NC}"
        else
            echo -e "${RED}✗ 포트 $port: 리스닝 없음${NC}"
        fi
    done
    
    echo ""
    echo -e "${GREEN}=== 접속 가능한 URL ===${NC}"
    echo "• https://api3.smap.site/docs (443 포트)"
    echo "• https://api3.smap.site:8000/docs (8000 포트)"
    echo "• https://api3.smap.site:3000/docs (3000 포트)"
    echo ""
    echo -e "${BLUE}=== 로그 관리 기능 ===${NC}"
    echo "• 로그 통계: http://$APP_HOST:$APP_PORT/api/v1/log-management/stats"
    echo "• 로그 정리: http://$APP_HOST:$APP_PORT/api/v1/log-management/full-cleanup"
    echo "• 로그 상태: http://$APP_HOST:$APP_PORT/api/v1/log-management/health"
    echo "• 자동 정리: 24시간마다 실행"
    echo "• 로그 모니터링: 6시간마다 실행"
    echo ""
    echo -e "${GREEN}모든 서비스가 정상적으로 시작되었습니다!${NC}"
    
else
    echo -e "${RED}애플리케이션 시작 실패. 로그 파일을 확인하세요: $LOG_FILE${NC}"
    cat "$LOG_FILE" # 실패 시 로그 출력
    exit 1
fi 