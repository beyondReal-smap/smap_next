#!/bin/bash

# 화면 지우기
clear

echo "====================================================="
echo "  Next.js 및 Backend 개발 환경 시작 스크립트"
echo "====================================================="
echo ""

# 이전 컨테이너 정리
echo "🧹 이전 컨테이너 정리 중..."
docker-compose -f docker-compose.dev.yml down

# Docker Compose 실행
echo "🔄 컨테이너 빌드 시작..."
echo "✓ Python FastAPI 백엔드 빌드 중..."
echo "✓ Next.js 프론트엔드 빌드 중..."

# 이미지 빌드
docker-compose -f docker-compose.dev.yml build --no-cache

echo "🚀 컨테이너 실행 중..."
docker-compose -f docker-compose.dev.yml up -d

# 컨테이너 상태 확인
echo ""
echo "📊 컨테이너 상태:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "✅ 개발 환경이 시작되었습니다."
echo ""
echo "📊 로그 보기:"
echo "  - 전체 로그: docker-compose -f docker-compose.dev.yml logs -f"
echo "  - 프론트엔드 로그: docker-compose -f docker-compose.dev.yml logs -f nextjs"
echo "  - 백엔드 로그: docker-compose -f docker-compose.dev.yml logs -f backend"
echo ""
echo "📝 로그 확인 중..." 
echo "백엔드 로그 (5초간):"
docker-compose -f docker-compose.dev.yml logs -f --tail=20 backend & pid=$! ; sleep 5 ; kill $pid

echo ""
echo "프론트엔드 로그 (5초간):"
docker-compose -f docker-compose.dev.yml logs -f --tail=20 nextjs & pid=$! ; sleep 5 ; kill $pid

echo ""
echo "🌐 접속 URL:"
echo "  - Next.js: http://localhost:3000"
echo "  - Backend API: http://localhost:8000"
echo ""
echo "🛑 종료하려면: docker-compose -f docker-compose.dev.yml down"
echo "====================================================="
