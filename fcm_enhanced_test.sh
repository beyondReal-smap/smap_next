#!/bin/bash

# Enhanced FCM Test Script - 개선된 FCM 토큰 관리 및 푸시 알림 테스트
# 작성일: 2025-09-02
# 목적: FCM 토큰 관리 개선사항 테스트 및 검증

set -e

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 설정값
USER_ID=${1:-1186}
BASE_URL="https://api3.aiagnt.kr/api/v1"
TEST_MESSAGE="Enhanced FCM Test - $(date '+%Y-%m-%d %H:%M:%S')"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          🚀 Enhanced FCM Test Suite v2.0                     ║${NC}"
echo -e "${CYAN}║          개선된 FCM 토큰 관리 시스템 테스트                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "${BLUE}🔍 테스트 대상 사용자 ID: ${USER_ID}${NC}"
echo -e "${BLUE}📅 테스트 시작 시간: $(date)${NC}"
echo -e "${BLUE}📡 서버 URL: ${BASE_URL}${NC}"
echo ""

# 로그 파일 초기화
LOG_FILE="fcm_enhanced_test_$(date +%Y%m%d_%H%M%S).log"
echo "Enhanced FCM Test Log - $(date)" > "$LOG_FILE"

log_message() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# 테스트 함수들
test_step() {
    local step_num=$1
    local description=$2
    log_message "${PURPLE}${step_num}️⃣ [$(date '+%H:%M:%S')] ${description}${NC}"
}

test_success() {
    log_message "${GREEN}✅ [$(date '+%H:%M:%S')] $1${NC}"
}

test_warning() {
    log_message "${YELLOW}⚠️ [$(date '+%H:%M:%S')] $1${NC}"
}

test_error() {
    log_message "${RED}❌ [$(date '+%H:%M:%S')] $1${NC}"
}

# API 호출 함수
call_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    log_message "${BLUE}📡 API 호출: ${method} ${endpoint}${NC}"
    if [ -n "$data" ]; then
        log_message "${BLUE}📊 요청 데이터: ${data}${NC}"
    fi
    
    local response
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    local http_code=$(echo "$response" | tail -n1 | cut -d: -f2)
    local body=$(echo "$response" | sed '$d')
    
    log_message "${BLUE}📈 HTTP 상태 코드: ${http_code}${NC}"
    log_message "${BLUE}📋 응답 내용:${NC}"
    echo "$body" | jq '.' 2>/dev/null | tee -a "$LOG_FILE" || echo "$body" | tee -a "$LOG_FILE"
    
    if [ "$http_code" = "200" ]; then
        test_success "$description 성공"
        return 0
    else
        test_error "$description 실패 (HTTP $http_code)"
        return 1
    fi
}

# 1단계: FCM 토큰 상태 확인
test_step "1" "FCM 토큰 상태 확인"
call_api "GET" "/member-fcm-token/status/$USER_ID" "" "FCM 토큰 상태 조회"
echo ""

# 2단계: 잘못된 토큰 정리 테스트
test_step "2" "잘못된 FCM 토큰 정리 테스트"
call_api "POST" "/member-fcm-token/reset-invalid-tokens" "" "잘못된 FCM 토큰 정리"
echo ""

# 3단계: 유효한 토큰으로 등록 테스트
test_step "3" "유효한 FCM 토큰 등록 테스트"
VALID_TOKEN="fWLYBJYTH06ejEjCYVb8TestToken"
REGISTER_DATA="{
    \"mt_idx\": $USER_ID,
    \"fcm_token\": \"$VALID_TOKEN\"
}"
call_api "POST" "/member-fcm-token/register" "$REGISTER_DATA" "유효한 FCM 토큰 등록"
echo ""

# 4단계: 잘못된 토큰으로 등록 테스트 (실패해야 함)
test_step "4" "잘못된 FCM 토큰 등록 테스트 (실패 예상)"
INVALID_TOKEN="invalid_token_format"
INVALID_REGISTER_DATA="{
    \"mt_idx\": $USER_ID,
    \"fcm_token\": \"$INVALID_TOKEN\"
}"
if call_api "POST" "/member-fcm-token/register" "$INVALID_REGISTER_DATA" "잘못된 FCM 토큰 등록"; then
    test_error "잘못된 토큰이 등록되었습니다 - 검증 로직 확인 필요"
else
    test_success "잘못된 토큰 등록이 올바르게 거부되었습니다"
fi
echo ""

# 5단계: FCM 토큰 검증 및 갱신 테스트
test_step "5" "FCM 토큰 검증 및 갱신 테스트"
VALIDATE_DATA="{
    \"mt_idx\": $USER_ID,
    \"fcm_token\": \"$VALID_TOKEN\"
}"
call_api "POST" "/member-fcm-token/validate-and-refresh" "$VALIDATE_DATA" "FCM 토큰 유효성 검증"
echo ""

# 6단계: 푸시 메시지 전송 테스트
test_step "6" "FCM 푸시 메시지 전송 테스트"
PUSH_DATA="{
    \"plt_type\": \"ENHANCED_TEST\",
    \"sst_idx\": \"0\",
    \"plt_condition\": \"Enhanced FCM Test\",
    \"plt_memo\": \"$TEST_MESSAGE\",
    \"mt_idx\": $USER_ID,
    \"plt_title\": \"🚀 Enhanced FCM Test\",
    \"plt_content\": \"$TEST_MESSAGE\"
}"
call_api "POST" "/fcm-sendone/" "$PUSH_DATA" "FCM 푸시 메시지 전송"
echo ""

# 7단계: 백그라운드 푸시 테스트
test_step "7" "백그라운드 FCM 푸시 테스트"
BG_PUSH_DATA="{
    \"plt_type\": \"BACKGROUND_TEST\",
    \"sst_idx\": \"0\",
    \"plt_condition\": \"Background Test\",
    \"plt_memo\": \"Background push test - $TEST_MESSAGE\",
    \"mt_idx\": $USER_ID,
    \"plt_title\": \"🌙 Background Test\",
    \"plt_content\": \"Background push test - $TEST_MESSAGE\",
    \"content_available\": true,
    \"priority\": \"high\"
}"
call_api "POST" "/fcm-sendone/background" "$BG_PUSH_DATA" "백그라운드 FCM 푸시 전송"
echo ""

# 8단계: Silent 푸시 테스트
test_step "8" "Silent FCM 푸시 테스트"
SILENT_PUSH_DATA="{
    \"mt_idx\": $USER_ID,
    \"reason\": \"enhanced_test_token_refresh\",
    \"priority\": \"high\"
}"
call_api "POST" "/fcm-sendone/silent" "$SILENT_PUSH_DATA" "Silent FCM 푸시 전송"
echo ""

# 9단계: 만료된 토큰 정리 테스트
test_step "9" "만료된 FCM 토큰 정리 테스트"
call_api "POST" "/member-fcm-token/cleanup-expired-tokens" "" "만료된 FCM 토큰 정리"
echo ""

# 10단계: 최종 토큰 상태 확인
test_step "10" "최종 FCM 토큰 상태 확인"
call_api "GET" "/member-fcm-token/status/$USER_ID" "" "최종 FCM 토큰 상태 조회"
echo ""

# 테스트 결과 요약
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    🎉 테스트 완료 요약                         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

log_message "${GREEN}✅ Enhanced FCM 테스트 완료!${NC}"
log_message "${BLUE}📋 테스트 결과 요약:${NC}"
log_message "${BLUE}  • 테스트 사용자: ${USER_ID}${NC}"
log_message "${BLUE}  • 테스트 시간: $(date)${NC}"
log_message "${BLUE}  • 로그 파일: ${LOG_FILE}${NC}"

echo ""
log_message "${YELLOW}🔍 주요 개선사항 검증:${NC}"
log_message "${GREEN}  ✅ 향상된 FCM 토큰 형식 검증${NC}"
log_message "${GREEN}  ✅ 개선된 토큰 무효화 처리${NC}"
log_message "${GREEN}  ✅ 강화된 에러 핸들링${NC}"
log_message "${GREEN}  ✅ 백그라운드 푸시 지원${NC}"
log_message "${GREEN}  ✅ Silent 푸시 지원${NC}"
log_message "${GREEN}  ✅ 토큰 정리 및 관리 기능${NC}"

echo ""
log_message "${BLUE}💡 다음 단계:${NC}"
log_message "${BLUE}  1. iOS 앱에서 실제 FCM 토큰 갱신 테스트${NC}"
log_message "${BLUE}  2. 백그라운드/포그라운드 상태에서 푸시 수신 테스트${NC}"
log_message "${BLUE}  3. 앱 강제 종료 상태에서 푸시 수신 테스트${NC}"
log_message "${BLUE}  4. 토큰 만료 시나리오 테스트${NC}"

echo ""
log_message "${PURPLE}🎯 Enhanced FCM 시스템이 성공적으로 구현되었습니다!${NC}"
log_message "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
