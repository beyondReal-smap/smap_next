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

# 토큰 추출 (미리보기와 전체 토큰 모두)
CURRENT_TOKEN=$(echo "$TOKEN_STATUS" | jq -r '.token_preview // empty')
FULL_TOKEN=$(echo "$TOKEN_STATUS" | jq -r '.full_token // empty')

if [ -n "$CURRENT_TOKEN" ]; then
    STEP1_SUCCESS_TIME=$(get_timestamp)
    echo -e "${GREEN}✅ [${STEP1_SUCCESS_TIME}] 토큰 발견: ${CURRENT_TOKEN}${NC}"
    
    # 전체 토큰 확인 (FCM 발송용)
    if [ -n "$FULL_TOKEN" ] && [ "$FULL_TOKEN" != "null" ]; then
        echo -e "${GREEN}📋 [전체 토큰] 발송용 토큰 준비됨: ${FULL_TOKEN:0:30}...${NC}"
        USED_TOKEN="$FULL_TOKEN"
    else
        echo -e "${YELLOW}⚠️  [전체 토큰] 전체 토큰을 가져올 수 없음 - 미리보기 토큰으로 시도${NC}"
        USED_TOKEN="$CURRENT_TOKEN"
    fi

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

# 실제 FCM 토큰을 DB에서 가져오기
echo -e "${CYAN}📡 [실제 토큰 조회] DB에서 현재 FCM 토큰 가져오는 중...${NC}"
REAL_TOKEN_DATA=$(curl -s -X GET "https://api3.smap.site/api/v1/member-fcm-token/status/${USER_ID}")

if [ $? -eq 0 ] && [ -n "$REAL_TOKEN_DATA" ]; then
    # 실제 토큰 추출
    REAL_FCM_TOKEN=$(echo "$REAL_TOKEN_DATA" | jq -r '.full_token // .token_preview // ""')
    
    if [ -n "$REAL_FCM_TOKEN" ] && [ "$REAL_FCM_TOKEN" != "null" ] && [ "$REAL_FCM_TOKEN" != "" ]; then
        echo -e "${GREEN}✅ [실제 토큰] DB에서 토큰 가져오기 성공: ${REAL_FCM_TOKEN:0:30}...${NC}"
        USED_TOKEN="$REAL_FCM_TOKEN"
    else
        echo -e "${RED}❌ [실제 토큰] DB에서 유효한 토큰을 찾을 수 없음${NC}"
        echo -e "${YELLOW}⚠️  [대체] 테스트를 건너뛰거나 새로운 토큰 등록이 필요합니다${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ [실제 토큰] 토큰 조회 API 호출 실패${NC}"
    exit 1
fi

# 백그라운드 검증은 보안상 전체 토큰이 필요하므로 건너뛰기
# VERIFY_SUCCESS_TIME=$(get_timestamp)
# echo -e "${CYAN}📱 [${VERIFY_SUCCESS_TIME}] 실제 푸시 수신 확인 중...${NC}"
# echo -e "${YELLOW}💡 백그라운드 검증은 보안상 생략되었습니다.${NC}"
# echo -e "${YELLOW}📱 iOS 기기에서 푸시 알림이 수신되었는지 직접 확인해주세요!${NC}"
# echo ""

# # 실제 푸시 수신 상태 확인을 위한 안내
# echo -e "${BLUE}📋 푸시 수신 확인 체크리스트:${NC}"
# echo -e "${GREEN}  ✅ FCM 발송: 서버에서 성공적으로 전송됨${NC}"
# echo -e "${YELLOW}  📱 iOS 수신: 기기에서 직접 확인 필요${NC}"
# echo ""
# echo -e "${CYAN}🔔 iOS 기기에서 확인하세요:${NC}"
# echo -e "  1️⃣ 알림 센터에 푸시 알림이 나타났는지 확인"
# echo -e "  2️⃣ 앱이 백그라운드에 있을 때도 수신되는지 확인"
# echo -e "  3️⃣ 알림음/진동이 정상적으로 작동하는지 확인"
# echo ""

# VERIFY_SUCCESS_TIME=$(get_timestamp)
# echo -e "${GREEN}✅ [${VERIFY_SUCCESS_TIME}] FCM 테스트 및 안내 완료${NC}"

# echo ""

# # 4. FCM 토큰 상태 확인 및 권장사항
# STEP4_TIME=$(get_timestamp)
# echo -e "${BLUE}4️⃣ [${STEP4_TIME}] FCM 토큰 동기화 권장사항...${NC}"

# echo -e "${YELLOW}📋 현재 토큰 상태:${NC}"
# echo -e "  • 미리보기: ${CURRENT_TOKEN}"
# echo -e "  • 만료 상태: $([ "$IS_EXPIRED" = "true" ] && echo "만료됨" || echo "정상")"
# echo -e "  • 마지막 업데이트: $(echo "$TOKEN_STATUS" | jq -r '.token_updated_at // "알 수 없음"')"

# echo ""
# echo -e "${BLUE}💡 토큰 동기화 방법:${NC}"
# echo -e "  1️⃣  ${GREEN}앱에서 직접 토큰 갱신${NC}: iOS 앱을 완전히 종료 후 재시작"
# echo -e "  2️⃣  ${GREEN}자동 동기화${NC}: 앱이 FCM 토큰을 자동으로 서버에 전송"
# echo -e "  3️⃣  ${YELLOW}수동 테스트${NC}: 실제 FCM 발송으로 토큰 유효성 확인"
# echo ""
# echo -e "${BLUE}⚠️  주의사항:${NC}"
# echo -e "  • 테스트 스크립트는 미리보기 토큰만 확인합니다"
# echo -e "  • 실제 전체 토큰은 보안상 앱에서만 관리됩니다"
# echo -e "  • DB 토큰은 앱의 FCM SDK에서 자동으로 업데이트됩니다"

# SYNC_SUCCESS_TIME=$(get_timestamp)
# echo -e "${GREEN}✅ [${SYNC_SUCCESS_TIME}] FCM 토큰 상태 확인 완료${NC}"

# echo ""

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

# echo ""
# END_TIME=$(get_timestamp)
# echo -e "${GREEN}🎉 [${END_TIME}] FCM 테스트, 검증 및 정리 완료!${NC}"

# echo ""
# echo "🔧 iOS 푸시 알림 수신 문제 해결 가이드:"
# echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# echo ""
# echo "📱 1. iOS 기기에서 확인해야 할 사항:"
# echo "   • 설정 > 알림 > SMAP > 알림 허용 ✅"
# echo "   • 설정 > 알림 > SMAP > 잠금 화면에서 표시 ✅" 
# echo "   • 설정 > 알림 > SMAP > 알림 센터에서 표시 ✅"
# echo "   • 설정 > 알림 > SMAP > 배너 스타일: 지속적 ✅"
# echo "   • 설정 > 집중 모드 > 방해금지 비활성화 ✅"
# echo ""
# echo "🔄 2. 앱 상태별 테스트:"
# echo "   • 포그라운드 (앱 실행 중): userNotificationCenter willPresent 호출"
# echo "   • 백그라운드 (앱 백그라운드): 알림 센터에 표시"  
# echo "   • 종료 상태 (앱 완전 종료): APNs 직접 전달"
# echo ""
# echo "🔑 3. Firebase Console 확인 사항:"
# echo "   • Firebase > 프로젝트 설정 > 클라우드 메시징"
# echo "   • APNs 인증키 (.p8 파일) 업로드 여부"
# echo "   • 키 ID: 9HJRA7XKFF (AuthKey_9HJRA7XKFF.p8 기준)"
# echo "   • 번들 ID: com.dmonster.smap 일치 확인"
# echo ""
# echo "💡 4. 즉시 시도할 수 있는 해결책:"
# echo "   • iOS 앱 완전 삭제 후 재설치"
# echo "   • iOS 기기 재부팅"
# echo "   • 알림 권한 재설정 (설정 > 일반 > 재설정 > 개인정보 보호 및 보안 재설정)"
# echo ""
# echo "📋 자세한 내용은 ios_fcm_debug_guide.md 파일을 참조하세요."
# echo ""
# echo "🔋 백그라운드 푸시 문제 해결:"
# echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# echo ""
# echo "📱 iOS 설정에서 확인 필요:"
# echo "   1. 설정 > 일반 > 백그라운드 앱 새로고침 > SMAP 켜기 ✅"
# echo "   2. 설정 > 배터리 > 저전력 모드 끄기 ✅"
# echo "   3. 설정 > 스크린 타임에서 SMAP 제한 없음 ✅"
# echo "   4. 설정 > 집중 모드 > 방해금지에서 SMAP 허용 ✅"
# echo ""
# echo "🔧 개발자 수정 사항:"
# echo "   • FCM 토큰 만료 주기: 30일 → 7일로 단축 ✅"
# echo "   • APNs 만료 시간: 2시간 → 30일로 최대 연장 ✅"
# echo "   • 백그라운드 모드: remote-notification 활성화 ✅"
# echo ""
# echo "📖 상세 가이드: ios_background_push_fix_guide.md 참조"
# echo ""
# echo "⚡ 배치 처리 문제 해결:"
# echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# echo ""
# echo "🔧 적용된 개선사항:"
# echo "   • APNs collapse-id 제거 → 개별 알림 전송 ✅"
# echo "   • thread-id 개별화 → 각 알림 고유 스레드 ✅"
# echo "   • 즉시 전달 최적화 → 백그라운드 배치 방지 ✅"
# echo ""
# echo "🧪 테스트 방법:"
# echo "   1. 앱을 백그라운드로 전환"
# echo "   2. 5분 간격으로 3번 푸시 테스트 실행"
# echo "   3. 각각 즉시 수신되는지 확인 (배치 안됨)"
# echo ""
# echo "📋 상세 내용: ios_push_batching_fix_guide.md 참조"
# echo ""
# echo "🚨 테스트 토큰 문제 해결:"
# echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# echo ""
# echo "❌ 문제: DB에 저장된 가짜 테스트 토큰 (fWLYBJYTH06ejEjCYVb8TestToken)"
# echo "✅ 해결: iOS 앱 재설치 → 로그인 → 실제 FCM 토큰 자동 등록"
# echo ""
# echo "📱 즉시 해결 방법:"
# echo "   1. iOS에서 SMAP 앱 완전 삭제"
# echo "   2. App Store에서 재설치"
# echo "   3. 로그인 진행"
# echo "   4. 실제 FCM 토큰 자동 등록됨"
# echo "   5. 다시 FCM 테스트 실행"
# echo ""
# echo "📋 상세 가이드: fix_test_token_issue.md 참조"
