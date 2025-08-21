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

# 2. FCM 발송
echo "2️⃣ FCM 발송:"
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

echo "✅ 완료!"
