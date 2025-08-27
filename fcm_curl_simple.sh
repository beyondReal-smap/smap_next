#!/bin/bash

# 간단한 FCM 발송 curl 명령어
# 사용법: ./fcm_curl_simple.sh [사용자ID]

USER_ID=${1:-1186}
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🔔 FCM 발송 테스트 (사용자 ID: ${USER_ID})"
echo ""

# 1. 토큰 상태 확인
echo "1️⃣ 토큰 상태 확인:"
curl -s "https://api3.smap.site/api/v1/member-fcm-token/status/${USER_ID}" | jq .
echo ""

# 2. FCM 발송 (일반 푸시)
echo "2️⃣ FCM 발송 (일반 푸시):"
curl -X POST "https://api3.smap.site/api/v1/fcm_sendone/" \
  -H "Content-Type: application/json" \
  -d "{
    \"plt_type\": \"TEST\",
    \"sst_idx\": \"0\",
    \"plt_condition\": \"curl 테스트\",
    \"plt_memo\": \"FCM 테스트 메시지 - ${TIMESTAMP}\",
    \"mt_idx\": ${USER_ID},
    \"plt_title\": \"🔔 FCM 테스트\",
    \"plt_content\": \"curl 명령어로 발송된 테스트 메시지입니다. - ${TIMESTAMP}\"
  }" | jq .
echo ""

# 3. 백그라운드 푸시 발송
echo "3️⃣ 백그라운드 푸시 발송:"
curl -X POST "https://api3.smap.site/api/v1/fcm_sendone/background" \
  -H "Content-Type: application/json" \
  -d "{
    \"plt_type\": \"BACKGROUND_TEST\",
    \"sst_idx\": \"0\",
    \"plt_condition\": \"백그라운드 curl 테스트\",
    \"plt_memo\": \"백그라운드 FCM 테스트 메시지 - ${TIMESTAMP}\",
    \"mt_idx\": ${USER_ID},
    \"plt_title\": \"🔄 백그라운드 FCM 테스트\",
    \"plt_content\": \"백그라운드에서 수신된 테스트 메시지입니다. - ${TIMESTAMP}\",
    \"content_available\": true,
    \"priority\": \"normal\",
    \"show_notification\": false,
    \"event_url\": \"https://smap.site/test/123\",
    \"schedule_id\": \"test_schedule_456\"
  }" | jq .
echo ""

# 4. 긴급 백그라운드 푸시 발송
echo "4️⃣ 긴급 백그라운드 푸시 발송:"
curl -X POST "https://api3.smap.site/api/v1/fcm_sendone/background" \
  -H "Content-Type: application/json" \
  -d "{
    \"plt_type\": \"URGENT_BACKGROUND_TEST\",
    \"sst_idx\": \"0\",
    \"plt_condition\": \"긴급 백그라운드 curl 테스트\",
    \"plt_memo\": \"긴급 백그라운드 FCM 테스트 메시지 - ${TIMESTAMP}\",
    \"mt_idx\": ${USER_ID},
    \"plt_title\": \"🚨 긴급 백그라운드 FCM 테스트\",
    \"plt_content\": \"긴급 백그라운드에서 수신된 테스트 메시지입니다. - ${TIMESTAMP}\",
    \"content_available\": true,
    \"priority\": \"high\",
    \"show_notification\": true,
    \"event_url\": \"https://smap.site/urgent/789\",
    \"schedule_id\": \"urgent_schedule_101\"
  }" | jq .
echo ""

echo "✅ 완료!"
echo ""
echo "📋 테스트 결과 확인:"
echo "  - 일반 푸시: 앱이 포그라운드에 있으면 즉시 표시"
echo "  - 백그라운드 푸시: 앱이 백그라운드/종료 상태에서도 수신"
echo "  - 긴급 백그라운드 푸시: 백그라운드에서도 알림 표시"
echo ""
echo "🔍 iOS 콘솔 로그에서 다음 메시지들을 확인:"
echo "  - '🔄 [FCM] 백그라운드 푸시 감지'"
echo "  - '✅ [FCM] 백그라운드 푸시 처리 완료'"
echo "  - '📨 [FCM] 백그라운드 푸시 데이터를 WebView에 전달'"
