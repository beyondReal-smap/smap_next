#!/bin/bash

# 배포 스크립트 - smap_next 프로젝트 배포

# 실행중인 컨테이너 중지 및 삭제
echo "기존 컨테이너 정리 중..."
docker-compose -f docker-compose.prod.yml down

# 이미지 빌드 및 컨테이너 시작
echo "새 이미지 빌드 및 컨테이너 시작 중..."
docker-compose -f docker-compose.prod.yml up -d --build

# 로그 확인
echo "컨테이너가 성공적으로 배포되었습니다."
echo "로그를 확인하려면 다음 명령어를 사용하세요:"
echo "docker-compose -f docker-compose.prod.yml logs -f" 