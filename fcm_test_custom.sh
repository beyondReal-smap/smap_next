#!/bin/bash

# FCM 발송 테스트 스크립트 (커스텀 토큰)
# 사용법: ./fcm_test_custom.sh [토큰] [메시지]

TOKEN="$1"
MESSAGE="${2:-FCM 커스텀 토큰 테스트 - $(date '+%Y-%m-%d %H:%M:%S')}"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔔 FCM 커스텀 토큰 발송 테스트${NC}"
echo -e "${YELLOW}토큰: ${TOKEN}${NC}"
echo -e "${YELLOW}메시지: ${MESSAGE}${NC}"
echo ""

# FCM 발송 데이터 준비
FCM_DATA=$(cat <<EOF_JSON
{
  "plt_type": "TEST",
  "sst_idx": "0", 
  "plt_condition": "커스텀 토큰 테스트",
  "plt_memo": "${MESSAGE}",
  "mt_idx": 1186,
  "plt_title": "🔔 FCM 커스텀 테스트",
  "plt_content": "${MESSAGE}",
  "fcm_token": "${TOKEN}"
}
EOF_JSON
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
echo -e "${GREEN}🎯 FCM 커스텀 토큰 테스트 완료!${NC}"
