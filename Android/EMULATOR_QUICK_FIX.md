# 🚀 안드로이드 에뮬레이터 빠른 해결 가이드

## 📋 현재 문제
- `net::ERR_NAME_NOT_RESOLVED` 오류 발생
- DNS 해석 실패로 서버 접속 불가
- Google Play Services 타임아웃

## ⚡ 빠른 해결 방법

### 1️⃣ 자동 해결 스크립트 실행 (권장)
```bash
./AndroidWebView/fix-emulator-dns.sh
```

### 2️⃣ 수동 해결 (스크립트가 안될 경우)
```bash
# 1. Google Play Services 재시작
adb shell am force-stop com.google.android.gms
adb shell am force-stop com.google.android.gsf

# 2. 앱 데이터 초기화
adb shell pm clear com.dmonster.smap

# 3. 앱 재시작
adb shell am start -n com.dmonster.smap/.MainActivity
```

### 3️⃣ 에뮬레이터 설정 변경
1. **에뮬레이터 설정 열기**: 설정 앱 → 네트워크 및 인터넷 → 고급
2. **DNS 서버 변경**: 
   - 자동 → 수동으로 변경
   - DNS 1: `8.8.8.8`
   - DNS 2: `8.8.4.4`
3. **에뮬레이터 재시작**

### 4️⃣ 에뮬레이터 성능 최적화
Android Studio에서 에뮬레이터 설정:
- **RAM**: 4GB 이상
- **VM heap**: 512MB 이상  
- **Graphics**: Hardware - GLES 2.0
- **Boot option**: Cold Boot

## 🔍 문제 확인 방법

### 로그 확인
```bash
# 앱 관련 로그
adb logcat -s SmapApplication:* SMAP_WebView:* DevServer:*

# DNS 오류만 확인
adb logcat | grep -E "(ERR_NAME_NOT_RESOLVED|DNS)"
```

### 네트워크 연결 테스트
```bash
# Google DNS 테스트
adb shell ping -c 3 8.8.8.8

# 도메인 해석 테스트
adb shell nslookup nextstep.smap.site 8.8.8.8

# IP 직접 연결 테스트
adb shell "echo -n | nc -w 3 216.198.79.65 443"
```

## ✅ 해결 확인

앱이 정상적으로 작동하면 다음과 같은 로그가 나타납니다:
```
SmapApplication: ✅ DNS 해석 성공: nextstep.smap.site -> 216.198.79.65
SMAP_WebView: Page loaded successfully: https://nextstep.smap.site/
DevServer: ✅ 서버 연결 성공
```

## 🆘 그래도 안 되는 경우

1. **에뮬레이터 완전 재시작**: Cold Boot 실행
2. **다른 에뮬레이터 사용**: API 30+ 권장
3. **실제 기기 테스트**: USB 디버깅으로 실기기 연결
4. **개발 서버 실행**: `npm run dev`로 로컬 서버 사용

## 💡 예방 방법

- 에뮬레이터 생성 시 Google APIs 포함 이미지 사용
- 안정적인 인터넷 연결 확인
- 방화벽/VPN이 DNS를 차단하지 않는지 확인
- 에뮬레이터는 하나만 실행 (리소스 절약)

---
**📞 추가 도움이 필요하면 로그와 함께 문의해주세요!** 