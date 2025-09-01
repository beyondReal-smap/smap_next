#!/bin/bash

# FCM 발송 테스트 스크립트
# 사용법: ./fcm_test.sh [사용자ID] [메시지]

# 타임스탬프 함수 (시분초 포함)
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

echo -e "${BLUE}🔔 [${TIMESTAMP}] FCM 발송 테스트 스크립트${NC}"
echo -e "${YELLOW}사용자 ID: ${USER_ID}${NC}"
echo -e "${YELLOW}메시지: ${MESSAGE}${NC}"
echo ""

# 1. 현재 FCM 토큰 상태 확인
STEP1_TIME=$(get_timestamp)
echo -e "${BLUE}1️⃣ [${STEP1_TIME}] 현재 FCM 토큰 상태 확인...${NC}"
TOKEN_STATUS=$(curl -s "https://api3.smap.site/api/v1/member-fcm-token/status/${USER_ID}")
echo "$TOKEN_STATUS" | jq .

# 토큰 추출
CURRENT_TOKEN=$(echo "$TOKEN_STATUS" | jq -r '.token_preview // empty')
if [ -n "$CURRENT_TOKEN" ]; then
    STEP1_SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${STEP1_SUCCESS_TIME}] 토큰 발견: ${CURRENT_TOKEN}${NC}"
else
    STEP1_FAIL_TIME=$(get_timestamp)
    echo -e "${RED}❌ [${STEP1_FAIL_TIME}] 토큰을 찾을 수 없음${NC}"
    exit 1
fi

echo ""

# 2. FCM 발송 테스트
STEP2_TIME=$(get_timestamp)
echo -e "${BLUE}2️⃣ [${STEP2_TIME}] FCM 발송 테스트...${NC}"

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
SEND_TIME=$(get_timestamp)
echo -e "${BLUE}📤 [${SEND_TIME}] FCM 발송 중...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "https://api3.smap.site/api/v1/fcm_sendone/" \
  -H "Content-Type: application/json" \
  -d "$FCM_DATA")

# HTTP 상태 코드와 응답 분리
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

RESULT_TIME=$(get_timestamp)
echo -e "${YELLOW}[${RESULT_TIME}] HTTP 상태 코드: ${HTTP_STATUS}${NC}"
echo -e "${YELLOW}응답:${NC}"
echo "$RESPONSE_BODY" | jq .

# 결과 판단
if [ "$HTTP_STATUS" = "200" ]; then
    SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${SUCCESS_TIME}] FCM 발송 성공!${NC}"
else
    FAIL_TIME=$(get_timestamp)
    echo -e "${RED}❌ [${FAIL_TIME}] FCM 발송 실패 (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""

# 3. FCM 토큰 상태 확인
STEP3_TIME=$(get_timestamp)
echo -e "${BLUE}3️⃣ [${STEP3_TIME}] FCM 토큰 상태 상세 확인...${NC}"
echo -e "${YELLOW}토큰 검증 요청:${NC}"
TOKEN_CHECK=$(curl -s -X POST "https://api3.smap.site/api/v1/member-fcm-token/background-check" \
  -H "Content-Type: application/json" \
  -d "{\"mt_idx\": ${USER_ID}}")

if [ $? -eq 0 ] && [ -n "$TOKEN_CHECK" ]; then
    echo "$TOKEN_CHECK" | jq .
    echo ""
    VERIFY_SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${VERIFY_SUCCESS_TIME}] FCM 백그라운드 검증 완료${NC}"
else
    VERIFY_FAIL_TIME=$(get_timestamp)
    echo -e "${YELLOW}⚠️ [${VERIFY_FAIL_TIME}] FCM 토큰 검증을 수행할 수 없습니다.${NC}"
fi

echo ""

# 4. FCM 토큰 강제 동기화 (옵션)
STEP4_TIME=$(get_timestamp)
echo -e "${BLUE}4️⃣ [${STEP4_TIME}] FCM 토큰 강제 동기화...${NC}"
echo -e "${YELLOW}현재 FCM 토큰을 DB에 강제 업데이트:${NC}"
FORCE_SYNC=$(curl -s -X POST "https://api3.smap.site/api/v1/member-fcm-token/register" \
  -H "Content-Type: application/json" \
  -d "{\"mt_idx\": ${USER_ID}, \"fcm_token\": \"${CURRENT_TOKEN}\"}")

if [ $? -eq 0 ] && [ -n "$FORCE_SYNC" ]; then
    echo "$FORCE_SYNC" | jq .
    echo ""
    SYNC_SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${SYNC_SUCCESS_TIME}] FCM 토큰 강제 동기화 완료${NC}"
    echo -e "${GREEN}💡 이제 Xcode 토큰과 DB 토큰이 일치합니다!${NC}"
else
    SYNC_FAIL_TIME=$(get_timestamp)
    echo -e "${YELLOW}⚠️ [${SYNC_FAIL_TIME}] FCM 토큰 강제 동기화 실패${NC}"
fi

echo ""
END_TIME=$(get_timestamp)
echo -e "${GREEN}🎉 [${END_TIME}] FCM 테스트 및 동기화 완료!${NC}"
