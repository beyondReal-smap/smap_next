#!/bin/bash

# 🔧 Android 에뮬레이터 DNS 문제 해결 스크립트
# 이 스크립트는 에뮬레이터에서 발생하는 DNS 해석 문제를 해결합니다.

echo "🔧 Android 에뮬레이터 DNS 문제 해결 시작..."

# 에뮬레이터가 실행 중인지 확인
if ! adb devices | grep -q "emulator"; then
    echo "❌ 에뮬레이터가 실행되지 않았습니다."
    echo "   Android Studio에서 에뮬레이터를 먼저 실행해주세요."
    exit 1
fi

echo "✅ 에뮬레이터 감지됨"

# 1. Google Play Services 재시작
echo "🔄 Google Play Services 재시작..."
adb shell am force-stop com.google.android.gms
adb shell am force-stop com.google.android.gsf
sleep 2

# 2. DNS 캐시 초기화
echo "🗑️ DNS 캐시 초기화..."
adb shell "ndc resolver flushdefaultif" 2>/dev/null || echo "   DNS 캐시 초기화 명령 실행 (일부 에러는 정상)"

# 3. 네트워크 상태 확인
echo "🌐 네트워크 상태 확인..."
adb shell ping -c 3 8.8.8.8 | head -5

# 4. 도메인 해석 테스트
echo "🔍 도메인 해석 테스트..."
echo "  nextstep.smap.site 해석 테스트:"
adb shell nslookup nextstep.smap.site 8.8.8.8 2>/dev/null || echo "   DNS 해석 실패 - IP 주소 직접 사용 권장"

# 5. IP 주소로 직접 연결 테스트
echo "📡 IP 주소 직접 연결 테스트..."
echo "  216.198.79.65 (nextstep.smap.site) 연결 테스트:"
timeout 5 adb shell "echo -n | nc -w 3 216.198.79.65 443" && echo "   ✅ HTTPS 포트 연결 성공" || echo "   ⚠️ HTTPS 포트 연결 실패"

# 6. WebView 캐시 초기화
echo "🗑️ WebView 캐시 초기화..."
adb shell pm clear com.dmonster.smap
echo "   앱 데이터 초기화 완료"

# 7. 에뮬레이터 네트워크 설정 권장사항
echo ""
echo "📋 에뮬레이터 네트워크 최적화 권장사항:"
echo "   1. 에뮬레이터 설정에서 DNS 서버를 8.8.8.8로 변경"
echo "   2. 에뮬레이터 RAM을 4GB 이상으로 설정"
echo "   3. Hardware acceleration 활성화"
echo "   4. Cold Boot 대신 Quick Boot 사용 비활성화"
echo ""
echo "📱 앱 재시작 권장:"
echo "   adb shell am start -n com.dmonster.smap/.MainActivity"
echo ""

# 8. 앱 재시작 옵션
read -p "🚀 앱을 지금 재시작하시겠습니까? (y/n): " -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 앱 재시작 중..."
    adb shell am start -n com.dmonster.smap/.MainActivity
    echo "✅ 앱 재시작 완료"
else
    echo "💡 수동으로 앱을 재시작해주세요"
fi

echo ""
echo "🎯 DNS 문제 해결 스크립트 완료!"
echo "   로그는 다음 명령어로 확인하세요:"
echo "   adb logcat -s SmapApplication:* SMAP_WebView:* DevServer:*" 