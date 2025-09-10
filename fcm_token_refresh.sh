#!/bin/bash

# FCM 토큰 강제 새로고침 스크립트
# 사용법: ./fcm_token_refresh.sh [mt_idx]

# 타임스탬프 함수
get_timestamp() {
    date '+%H:%M:%S'
}

# 기본값 설정
MT_IDX=${1:-2350}
TIMESTAMP=$(get_timestamp)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 [${TIMESTAMP}] FCM 토큰 강제 새로고침${NC}"
echo -e "${YELLOW}mt_idx: ${MT_IDX}${NC}"
echo ""

# FCM 토큰 새로고침 요청
REFRESH_DATA=$(cat <<EOF
{
  "mt_idx": ${MT_IDX},
  "force_refresh": true
}
EOF
)

SEND_TIME=$(get_timestamp)
echo -e "${BLUE}📤 [${SEND_TIME}] FCM 토큰 새로고침 요청 중...${NC}"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "https://api3.smap.site/api/v1/member-fcm-token/refresh-token" \
  -H "Content-Type: application/json" \
  -d "$REFRESH_DATA")

# HTTP 상태 코드와 응답 분리
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

RESULT_TIME=$(get_timestamp)
echo -e "${YELLOW}[${RESULT_TIME}] HTTP 상태 코드: ${HTTP_STATUS}${NC}"
echo -e "${YELLOW}응답:${NC}"
echo "$RESPONSE_BODY" | jq .

# 결과 판단
if [ "$HTTP_STATUS" = "200" ]; then
    SUCCESS_FLAG=$(echo "$RESPONSE_BODY" | jq -r '.success // empty')
    
    if [ "$SUCCESS_FLAG" = "true" ]; then
        SUCCESS_TIME=$(get_timestamp)
        echo -e "${GREEN}✅ [${SUCCESS_TIME}] FCM 토큰 새로고침 성공!${NC}"
        echo -e "${GREEN}📱 이제 FCM 푸시 테스트를 다시 시도해보세요.${NC}"
    else
        FAIL_TIME=$(get_timestamp)
        TITLE=$(echo "$RESPONSE_BODY" | jq -r '.title // "알 수 없는 오류"')
        MESSAGE=$(echo "$RESPONSE_BODY" | jq -r '.message // "FCM 토큰 새로고침 실패"')
        echo -e "${RED}❌ [${FAIL_TIME}] FCM 토큰 새로고침 실패: ${TITLE}${NC}"
        echo -e "${RED}   상세: ${MESSAGE}${NC}"
    fi
else
    FAIL_TIME=$(get_timestamp)
    echo -e "${RED}❌ [${FAIL_TIME}] FCM 토큰 새로고침 API 호출 실패 (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""
END_TIME=$(get_timestamp)
echo -e "${GREEN}🎉 [${END_TIME}] FCM 토큰 새로고침 완료!${NC}"

