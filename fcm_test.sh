#!/bin/bash

# FCM 발송 테스트 스크립트 (단순 버전)
# 사용법: ./fcm_test.sh [사용자ID] [메시지]
# 기능: 토큰 업데이트 없이 그냥 FCM 푸시 메시지만 발송

# 타임스탬프 함수
get_timestamp() {
    date '+%H:%M:%S'
}

# 기본값 설정
USER_ID=${1:-1186}
MESSAGE=${2:-"FCM 테스트 메시지 - $(date '+%Y-%m-%d %H:%M:%S')"}
TIMESTAMP=$(get_timestamp)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔔 [${TIMESTAMP}] FCM 푸시 발송 테스트${NC}"
echo -e "${YELLOW}사용자 ID: ${USER_ID}${NC}"
echo -e "${YELLOW}메시지: ${MESSAGE}${NC}"
echo ""

# FCM 발송 실행 (test-ios-push 엔드포인트)
TEST_DATA=$(cat <<EOF
{
  "mt_idx": ${USER_ID},
  "test_type": "simple"
}
EOF
)

SEND_TIME=$(get_timestamp)
echo -e "${BLUE}📤 [${SEND_TIME}] FCM 푸시 발송 중...${NC}"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "https://api3.smap.site/api/v1/member-fcm-token/test-ios-push" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

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
        echo -e "${GREEN}✅ [${SUCCESS_TIME}] FCM 푸시 발송 성공!${NC}"
        echo -e "${GREEN}📱 iOS 기기에서 알림이 수신되었는지 확인해주세요.${NC}"
    else
        FAIL_TIME=$(get_timestamp)
        TITLE=$(echo "$RESPONSE_BODY" | jq -r '.title // "알 수 없는 오류"')
        MESSAGE=$(echo "$RESPONSE_BODY" | jq -r '.message // "FCM 발송 실패"')
        echo -e "${RED}❌ [${FAIL_TIME}] FCM 푸시 발송 실패: ${TITLE}${NC}"
        echo -e "${RED}   상세: ${MESSAGE}${NC}"
    fi
else
    FAIL_TIME=$(get_timestamp)
    echo -e "${RED}❌ [${FAIL_TIME}] FCM API 호출 실패 (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""
END_TIME=$(get_timestamp)
echo -e "${GREEN}🎉 [${END_TIME}] FCM 푸시 발송 테스트 완료!${NC}"
