# 🔧 Android 에뮬레이터 서버 연결 가이드

## 📋 개요

안드로이드 에뮬레이터에서 서버에 연결할 때 발생하는 문제와 해결 방법을 설명합니다.

## 🚨 에뮬레이터에서 발생하는 주요 문제들

### 1. 네트워크 접근 문제
- **문제**: `localhost`나 `127.0.0.1`로 접근이 안됨
- **원인**: 에뮬레이터는 별도의 가상 네트워크에서 실행됨
- **해결**: `10.0.2.2`를 사용해야 함

### 2. DNS 해석 지연
- **문제**: 도메인 이름 해석이 느리거나 실패
- **원인**: 에뮬레이터의 DNS 설정
- **해결**: IP 주소 직접 사용 또는 fallback URL 설정

### 3. 네트워크 보안 정책
- **문제**: HTTPS가 아닌 HTTP 연결 차단
- **원인**: Android 9+ 기본 보안 정책
- **해결**: `network_security_config.xml`에서 cleartext 트래픽 허용

## 🛠️ 현재 앱의 해결 방법

### 1. 스마트 URL 설정
```kotlin
private val fallbackUrls: List<String> get() {
    return if (isEmulator() && BuildConfig.DEBUG) {
        listOf(
            "http://10.0.2.2:3000/",          // 에뮬레이터용 로컬 개발서버
            "https://nextstep.smap.site/",     // 운영서버 (Primary)
            "https://smap-next.vercel.app/",   // Vercel 백업
            "http://localhost:3000/",          // 로컬백업
            "http://192.168.1.100:3000/"      // 네트워크 로컬 IP
        )
    } else if (isEmulator()) {
        listOf(
            "https://nextstep.smap.site/",     // 운영서버 (Primary)
            "https://smap-next.vercel.app/",   // Vercel 백업
            "http://10.0.2.2:3000/",          // 에뮬레이터용 로컬 개발서버
            "http://localhost:3000/"          // 로컬백업
        )
    } else {
        // 실제 기기용 설정...
    }
}
```

### 2. 개발 서버 연결 테스트
```kotlin
private fun testDevServerConnection(callback: (Boolean) -> Unit) {
    val testUrls = listOf(
        "http://10.0.2.2:3000/api/health",     // Health check endpoint
        "http://10.0.2.2:3000/",               // Root endpoint
        "http://localhost:3000/api/health",     // Alternative localhost
        "http://127.0.0.1:3000/api/health"     // Alternative loopback
    )
    
    // 각 URL에 대해 연결 테스트 수행
    // 연결 성공하면 개발 서버 사용, 실패하면 운영 서버로 fallback
}
```

### 3. 에뮬레이터 감지
```kotlin
private fun isEmulator(): Boolean {
    return (android.os.Build.FINGERPRINT.startsWith("generic")
            || android.os.Build.FINGERPRINT.startsWith("unknown")
            || android.os.Build.MODEL.contains("google_sdk")
            || android.os.Build.MODEL.contains("Emulator")
            || android.os.Build.MODEL.contains("Android SDK built for x86")
            || android.os.Build.MANUFACTURER.contains("Genymotion")
            || (android.os.Build.BRAND.startsWith("generic") && android.os.Build.DEVICE.startsWith("generic"))
            || "google_sdk" == android.os.Build.PRODUCT)
}
```

### 4. 네트워크 보안 설정
`app/src/main/res/xml/network_security_config.xml`:
```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <!-- 에뮬레이터 개발 환경 -->
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">0.0.0.0</domain>
        
        <!-- 로컬 네트워크 범위 -->
        <domain includeSubdomains="true">192.168.0.0</domain>
        <domain includeSubdomains="true">192.168.1.0</domain>
        <domain includeSubdomains="true">10.0.0.0</domain>
        <domain includeSubdomains="true">172.16.0.0</domain>
    </domain-config>
</network-security-config>
```

### 5. WebView 설정 최적화
```kotlin
webView.settings.apply {
    // 에뮬레이터에서는 캐시 사용 안함 (최신 개발 내용 반영)
    cacheMode = if (isEmulator()) {
        WebSettings.LOAD_NO_CACHE
    } else {
        WebSettings.LOAD_DEFAULT
    }
    
    // 에뮬레이터용 User Agent 설정
    userAgentString = if (isEmulator()) {
        "Mozilla/5.0 (Linux; Android 14; Emulator) AppleWebKit/537.36 SMAP-Android-Emulator/1.0"
    } else {
        "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 SMAP-Android/1.0"
    }
}
```

## 🔍 디버깅 방법

### 1. 로그 확인
Android Studio의 Logcat에서 다음 태그들을 필터링:
- `SMAP_WebView`: WebView 관련 로그
- `DevServer`: 개발 서버 연결 테스트 로그
- `Network`: 네트워크 연결 상태 로그

### 2. 네트워크 상태 확인
```bash
# 에뮬레이터에서 개발 서버 접근 테스트
adb shell
curl -I http://10.0.2.2:3000/
```

### 3. 개발 서버 실행 확인
```bash
# 개발 서버가 실행 중인지 확인
netstat -an | grep 3000
# 또는
lsof -i :3000
```

## 🚀 빠른 해결 방법

### 에뮬레이터에서 서버 연결이 안 될 때:

1. **개발 서버 실행 확인**:
   ```bash
   npm run dev
   # 또는
   yarn dev
   ```

2. **에뮬레이터 재시작**:
   - Android Studio에서 에뮬레이터 종료 후 재시작

3. **앱 재빌드**:
   ```bash
   ./gradlew clean assembleDebug
   ```

4. **네트워크 설정 확인**:
   - 에뮬레이터 설정 > 네트워크 > 고급 설정 확인

5. **Wipe Data**:
   - 에뮬레이터의 Cold Boot 또는 Wipe Data 실행

### Google Play Services 타임아웃 문제 해결:

1. **에뮬레이터에서 Google Play Services 업데이트**:
   - Play Store 앱에서 Google Play Services 검색 후 업데이트

2. **Google Play Services 재시작**:
   ```bash
   adb shell am force-stop com.google.android.gms
   adb shell am force-stop com.google.android.gsf
   ```

3. **에뮬레이터 DNS 설정**:
   - 에뮬레이터 설정 > 네트워크 > DNS 서버를 8.8.8.8로 변경

4. **에뮬레이터 성능 개선**:
   - RAM: 4GB 이상 할당
   - VM heap: 512MB 이상
   - Hardware acceleration 활성화

## 📱 에뮬레이터별 주의사항

### Android Studio 기본 에뮬레이터
- `10.0.2.2`가 호스트 PC의 `localhost`에 매핑됨
- DNS 해석이 느릴 수 있음

### Genymotion
- `10.0.3.2`를 사용해야 할 수 있음
- 별도의 네트워크 설정 필요

### BlueStacks
- 네트워크 설정이 다를 수 있음
- 실제 네트워크 어댑터를 사용하는 경우 있음

## 🛠️ DNS 문제 자동 해결 스크립트

에뮬레이터에서 DNS 문제가 발생할 때 자동으로 해결하는 스크립트를 제공합니다:

```bash
# 스크립트 실행
./AndroidWebView/fix-emulator-dns.sh
```

**스크립트가 수행하는 작업들:**
1. Google Play Services 재시작
2. DNS 캐시 초기화  
3. 네트워크 상태 확인
4. 도메인 해석 테스트
5. IP 주소 직접 연결 테스트
6. WebView 캐시 초기화
7. 앱 자동 재시작 옵션

## 🔧 수동 DNS 문제 해결

### 1. Google Play Services 재시작
```bash
adb shell am force-stop com.google.android.gms
adb shell am force-stop com.google.android.gsf
```

### 2. DNS 캐시 초기화
```bash
adb shell "ndc resolver flushdefaultif"
```

### 3. 앱 데이터 초기화
```bash
adb shell pm clear com.dmonster.smap
```

### 4. 에뮬레이터 DNS 서버 변경
- 에뮬레이터 설정 → 네트워크 → DNS 서버를 `8.8.8.8`로 변경

## 💡 개발 팁

1. **개발 중에는 에뮬레이터에서 캐시 비활성화**
2. **로그를 통해 현재 시도 중인 URL 확인**
3. **네트워크 상태와 연결 오류 모니터링**
4. **fallback URL 순서 최적화 (IP 주소 우선)**
5. **개발 서버와 운영 서버 간 자동 전환**
6. **DNS 문제 발생 시 자동 해결 스크립트 사용**

### 로그 모니터링
```bash
# 앱 관련 로그만 필터링
adb logcat -s SmapApplication:* SMAP_WebView:* DevServer:* GoogleSignIn:*

# 네트워크 오류만 확인
adb logcat | grep -E "(DNS|ERR_NAME_NOT_RESOLVED|net::)"
```

이러한 설정을 통해 에뮬레이터에서도 안정적인 서버 연결을 보장할 수 있습니다. 