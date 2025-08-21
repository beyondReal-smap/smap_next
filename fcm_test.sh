#!/bin/bash

# FCM 발송 테스트 스크립트
# 사용법: ./fcm_test.sh [사용자ID] [메시지]

# 기본값 설정
USER_ID=${1:-1186}
MESSAGE=${2:-"FCM 테스트 메시지 - $(date '+%Y-%m-%d %H:%M:%S')"}

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔔 FCM 발송 테스트 스크립트${NC}"
echo -e "${YELLOW}사용자 ID: ${USER_ID}${NC}"
echo -e "${YELLOW}메시지: ${MESSAGE}${NC}"
echo ""

# 1. 현재 FCM 토큰 상태 확인
echo -e "${BLUE}1️⃣ 현재 FCM 토큰 상태 확인...${NC}"
TOKEN_STATUS=$(curl -s "https://api3.smap.site/api/v1/member-fcm-token/status/${USER_ID}")
echo "$TOKEN_STATUS" | jq .

# 토큰 추출
CURRENT_TOKEN=$(echo "$TOKEN_STATUS" | jq -r '.token_preview // empty')
if [ -n "$CURRENT_TOKEN" ]; then
    echo -e "${GREEN}✅ 토큰 발견: ${CURRENT_TOKEN}${NC}"
else
    echo -e "${RED}❌ 토큰을 찾을 수 없음${NC}"
    exit 1
fi

echo ""

# 2. FCM 발송 테스트
echo -e "${BLUE}2️⃣ FCM 발송 테스트...${NC}"

# FCM 발송 데이터 준비
FCM_DATA=$(cat <<EOF
{
  "plt_type": "TEST",
  "sst_idx": "0",
  "plt_condition": "curl 테스트",
  "plt_memo": "${MESSAGE}",
  "mt_idx": ${USER_ID},
  "plt_title": "🔔 FCM 테스트",
  "plt_content": "${MESSAGE}"
}
EOF
)

echo -e "${YELLOW}발송 데이터:${NC}"
echo "$FCM_DATA" | jq .

echo ""

# FCM 발송 실행
echo -e "${BLUE}📤 FCM 발송 중...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "https://api3.smap.site/api/v1/fcm_sendone/" \
  -H "Content-Type: application/json" \
  -d "$FCM_DATA")

# HTTP 상태 코드와 응답 분리
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo -e "${YELLOW}HTTP 상태 코드: ${HTTP_STATUS}${NC}"
echo -e "${YELLOW}응답:${NC}"
echo "$RESPONSE_BODY" | jq .

# 결과 판단
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ FCM 발송 성공!${NC}"
else
    echo -e "${RED}❌ FCM 발송 실패 (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""

# 3. 푸시 로그 확인 (선택사항)
echo -e "${BLUE}3️⃣ 최근 푸시 로그 확인...${NC}"
echo -e "${YELLOW}최근 푸시 로그:${NC}"
PUSH_LOGS=$(curl -s "https://api3.smap.site/api/v1/push-logs/recent/${USER_ID}")
if [ $? -eq 0 ] && [ -n "$PUSH_LOGS" ]; then
    echo "$PUSH_LOGS" | jq .
else
    echo -e "${YELLOW}⚠️ 푸시 로그를 가져올 수 없거나 비어있습니다.${NC}"
fi

echo ""
echo -e "${GREEN}�� FCM 테스트 완료!${NC}"
