#!/bin/bash

echo "🚀 Next.js 개발 서버 시작 스크립트"
echo "=================================="

# 현재 디렉토리가 frontend인지 확인
if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
    echo "❌ 오류: frontend 디렉토리에서 실행해주세요."
    echo "현재 디렉토리: $(pwd)"
    exit 1
fi

echo "📁 현재 디렉토리: $(pwd)"

# 포트 3000 사용 중인 프로세스 확인
echo "🔍 포트 3000 사용 중인 프로세스 확인 중..."
PORT_PIDS=$(lsof -ti:3000 2>/dev/null)

if [[ -n "$PORT_PIDS" ]]; then
    echo "⚠️  포트 3000을 사용 중인 프로세스 발견:"
    echo "$PORT_PIDS" | while read pid; do
        PROCESS_INFO=$(ps -p "$pid" -o pid,ppid,command --no-headers 2>/dev/null)
        echo "  PID: $pid - $PROCESS_INFO"
    done
    
    echo "🔄 프로세스 종료 중..."
    echo "$PORT_PIDS" | while read pid; do
        if kill -9 "$pid" 2>/dev/null; then
            echo "  ✅ PID $pid 종료 완료"
        else
            echo "  ❌ PID $pid 종료 실패"
        fi
    done
    
    # 프로세스가 완전히 종료될 때까지 잠시 대기
    sleep 2
    
    # 다시 한번 포트 상태 확인
    REMAINING_PIDS=$(lsof -ti:3000 2>/dev/null)
    if [[ -n "$REMAINING_PIDS" ]]; then
        echo "❌ 일부 프로세스가 여전히 실행 중입니다."
        echo "남은 PID: $REMAINING_PIDS"
        exit 1
    else
        echo "✅ 모든 프로세스 종료 완료"
    fi
else
    echo "✅ 포트 3000 사용 중인 프로세스 없음"
fi

# Next.js 캐시 정리
echo "🧹 Next.js 캐시 정리 중..."
if [[ -d ".next" ]]; then
    rm -rf .next
    echo "✅ .next 캐시 폴더 삭제 완료"
else
    echo "ℹ️  .next 캐시 폴더가 없습니다."
fi

# 개발 서버 시작
echo "🚀 Next.js 개발 서버 시작 중..."
echo "📍 서버 주소: http://localhost:3000"
echo "📍 새로고침: Ctrl+R"
echo "📍 서버 중지: Ctrl+C"
echo "=================================="

# npm run dev 실행
npm run dev
