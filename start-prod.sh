#!/bin/bash

# 화면 지우기
clear

echo "====================================================="
echo "  Next.js 및 Backend 운영 환경 시작 스크립트"
echo "====================================================="
echo ""

# Docker Compose 실행
echo "🔄 컨테이너 빌드 및 시작 중..."
docker-compose -f docker-compose.prod.yml up --build -d

echo ""
echo "✅ 운영 환경이 시작되었습니다."
echo ""
echo "📊 로그 보기:"
echo "  - 전체 로그: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - 프론트엔드 로그: docker-compose -f docker-compose.prod.yml logs -f nextjs"
echo "  - 백엔드 로그: docker-compose -f docker-compose.prod.yml logs -f backend"
echo ""
echo "🌐 접속 URL:"
echo "  - Next.js: http://localhost:3000"
echo "  - Backend API: http://localhost:8000"
echo ""
echo "🛑 종료하려면: docker-compose -f docker-compose.prod.yml down"
echo "=====================================================" 