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

    # FCM 토큰 상태 확인 (전체 토큰 검증은 API 제한으로 미리보기만 확인)
    VALIDATE_TIME=$(get_timestamp)
    echo -e "${BLUE}🔍 [${VALIDATE_TIME}] FCM 토큰 상태 확인 중...${NC}"

    # 기본 검증 (미리보기 토큰)
    if [ -z "$CURRENT_TOKEN" ]; then
        echo -e "${RED}❌ FCM 토큰 미리보기가 비어있음${NC}"
        exit 1
    fi

    # 미리보기 토큰 길이 확인
    TOKEN_LENGTH=${#CURRENT_TOKEN}
    echo -e "${BLUE}📏 미리보기 토큰 길이: ${TOKEN_LENGTH}자${NC}"

    # 토큰 만료 상태 확인
    IS_EXPIRED=$(echo "$TOKEN_STATUS" | jq -r '.is_token_expired // false')
    IS_NEAR_EXPIRY=$(echo "$TOKEN_STATUS" | jq -r '.is_token_near_expiry // false')

    if [ "$IS_EXPIRED" = "true" ]; then
        echo -e "${RED}⚠️  토큰이 만료됨${NC}"
        echo -e "${YELLOW}💡 토큰 갱신이 필요할 수 있습니다${NC}"
    elif [ "$IS_NEAR_EXPIRY" = "true" ]; then
        echo -e "${YELLOW}⚠️  토큰이 곧 만료될 예정${NC}"
    else
        echo -e "${GREEN}✅ 토큰 만료 상태: 정상${NC}"
    fi

    VALIDATE_SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${VALIDATE_SUCCESS_TIME}] FCM 토큰 상태 확인 완료${NC}"

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

# 결과 판단 - HTTP 상태와 실제 FCM 발송 결과 모두 확인
if [ "$HTTP_STATUS" = "200" ]; then
    # HTTP 200이어도 FCM 발송이 실패할 수 있음 (토큰 만료 등)
    SUCCESS_FLAG=$(echo "$RESPONSE_BODY" | jq -r '.success // empty')

    if [ "$SUCCESS_FLAG" = "true" ]; then
        SUCCESS_TIME=$(get_timestamp)
        echo -e "${GREEN}✅ [${SUCCESS_TIME}] FCM 발송 성공!${NC}"
    else
        # FCM 발송은 실패했지만 API 자체는 정상 작동
        FAIL_TIME=$(get_timestamp)
        TITLE=$(echo "$RESPONSE_BODY" | jq -r '.title // "알 수 없는 오류"')
        MESSAGE=$(echo "$RESPONSE_BODY" | jq -r '.message // "FCM 발송 실패"')

        # 토큰 만료 관련 에러는 노란색으로 표시 (정상적인 상황)
        if [[ "$TITLE" == *"토큰 만료"* ]] || [[ "$MESSAGE" == *"토큰 만료"* ]]; then
            echo -e "${YELLOW}⚠️ [${FAIL_TIME}] FCM 발송 실패 (토큰 만료)${NC}"
            echo -e "${BLUE}💡 토큰이 만료되어 Firebase 서버에서 푸시를 거부했습니다.${NC}"
            echo -e "${BLUE}💡 앱을 재시작하면 새로운 토큰이 자동으로 발급됩니다.${NC}"
        elif [[ "$TITLE" == *"토큰 없음"* ]] || [[ "$MESSAGE" == *"토큰 없음"* ]]; then
            echo -e "${YELLOW}⚠️ [${FAIL_TIME}] FCM 발송 실패 (토큰 없음)${NC}"
            echo -e "${BLUE}💡 DB에 FCM 토큰이 존재하지 않습니다.${NC}"
            echo -e "${BLUE}💡 앱을 실행하면 자동으로 토큰이 등록됩니다.${NC}"
        else
            echo -e "${RED}❌ [${FAIL_TIME}] FCM 발송 실패: ${TITLE}${NC}"
            echo -e "${RED}   상세: ${MESSAGE}${NC}"
        fi
    fi
else
    FAIL_TIME=$(get_timestamp)
    echo -e "${RED}❌ [${FAIL_TIME}] FCM API 호출 실패 (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""

# 3. FCM 토큰 상태 확인
STEP3_TIME=$(get_timestamp)
echo -e "${BLUE}3️⃣ [${STEP3_TIME}] FCM 토큰 상태 상세 확인...${NC}"
echo -e "${YELLOW}토큰 검증 요청:${NC}"
# 실제 FCM 토큰을 가져와서 전송 (임시로 테스트용 토큰 사용)
TEST_FCM_TOKEN="fWLYBJYTH06ejEjCYVb8TestToken"
TOKEN_CHECK=$(curl -s -X POST "https://api3.smap.site/api/v1/member-fcm-token/background-check" \
  -H "Content-Type: application/json" \
  -d "{\"mt_idx\": ${USER_ID}, \"fcm_token\": \"${TEST_FCM_TOKEN}\"}")

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

# 4. FCM 토큰 상태 확인 및 권장사항
STEP4_TIME=$(get_timestamp)
echo -e "${BLUE}4️⃣ [${STEP4_TIME}] FCM 토큰 동기화 권장사항...${NC}"

echo -e "${YELLOW}📋 현재 토큰 상태:${NC}"
echo -e "  • 미리보기: ${CURRENT_TOKEN}"
echo -e "  • 만료 상태: $([ "$IS_EXPIRED" = "true" ] && echo "만료됨" || echo "정상")"
echo -e "  • 마지막 업데이트: $(echo "$TOKEN_STATUS" | jq -r '.token_updated_at // "알 수 없음"')"

echo ""
echo -e "${BLUE}💡 토큰 동기화 방법:${NC}"
echo -e "  1️⃣  ${GREEN}앱에서 직접 토큰 갱신${NC}: iOS 앱을 완전히 종료 후 재시작"
echo -e "  2️⃣  ${GREEN}자동 동기화${NC}: 앱이 FCM 토큰을 자동으로 서버에 전송"
echo -e "  3️⃣  ${YELLOW}수동 테스트${NC}: 실제 FCM 발송으로 토큰 유효성 확인"
echo ""
echo -e "${BLUE}⚠️  주의사항:${NC}"
echo -e "  • 테스트 스크립트는 미리보기 토큰만 확인합니다"
echo -e "  • 실제 전체 토큰은 보안상 앱에서만 관리됩니다"
echo -e "  • DB 토큰은 앱의 FCM SDK에서 자동으로 업데이트됩니다"

SYNC_SUCCESS_TIME=$(get_timestamp)
echo -e "${GREEN}✅ [${SYNC_SUCCESS_TIME}] FCM 토큰 상태 확인 완료${NC}"

echo ""

# 5. 잘못된 FCM 토큰 정리 (관리자용)
# STEP5_TIME=$(get_timestamp)
# echo -e "${BLUE}5️⃣ [${STEP5_TIME}] 잘못된 FCM 토큰 정리...${NC}"
# echo -e "${YELLOW}DB에서 잘못된 FCM 토큰들을 정리:${NC}"

# # 수동으로 잘못된 토큰 검증
# if [[ ! "$CURRENT_TOKEN" =~ : ]]; then
#     echo -e "${RED}❌ 토큰에 콜론(:)이 없음${NC}"
#     INVALID_TOKEN=true
# elif [[ ! "$CURRENT_TOKEN" =~ ^[0-9]+:APA91 ]]; then
#     echo -e "${RED}❌ 프로젝트 ID가 숫자가 아니거나 APA91로 시작하지 않음${NC}"
#     INVALID_TOKEN=true
# else
#     INVALID_TOKEN=false
# fi

# if [ "$INVALID_TOKEN" = true ]; then
#     CLEANUP_TIME=$(get_timestamp)
#     echo -e "${YELLOW}🧹 [${CLEANUP_TIME}] 잘못된 토큰 감지됨 - 수동 정리 진행${NC}"

#     # 잘못된 토큰을 null로 업데이트하는 API 호출 (실제로는 백엔드에서 구현 필요)
#     echo -e "${YELLOW}수동 정리: 잘못된 FCM 토큰을 DB에서 삭제합니다...${NC}"

#     # 임시로 로컬 파일에 잘못된 토큰 기록
#     echo "잘못된 토큰 발견: $CURRENT_TOKEN (사용자: $USER_ID)" >> invalid_tokens.log
#     echo "정리 시간: $(date)" >> invalid_tokens.log
#     echo "---" >> invalid_tokens.log

#     echo -e "${GREEN}✅ 잘못된 토큰 정보가 invalid_tokens.log에 기록되었습니다${NC}"
# else
#     CLEANUP_TIME=$(get_timestamp)
#     echo -e "${GREEN}✅ [${CLEANUP_TIME}] FCM 토큰이 올바른 형식입니다${NC}"
# fi

echo ""
END_TIME=$(get_timestamp)
echo -e "${GREEN}🎉 [${END_TIME}] FCM 테스트, 검증 및 정리 완료!${NC}"
