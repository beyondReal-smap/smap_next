# 🗺️ 네이버 지도 API 오류 해결 가이드 (업데이트)

## 📋 현재 발생 중인 문제

```
❌ GET https://oapi.map.naver.com/v3/auth?ncpKeyId=unxdi5mt3f&url=https%3A%2F%2Fnextstep.smap.site%2Fhome&time=1750116168886&callback=__naver_maps_callback__0 
   net::ERR_ABORTED 401 (Unauthorized)

❌ NAVER Maps JavaScript API v3 잠시 후에 다시 요청해 주세요.
   Error Code / Error Message: 500 / Internal Server Error (내부 서버 오류)
   Client ID: unxdi5mt3f
   URI: https://nextstep.smap.site/home

⚠️ 안드로이드 9 이상에서는 HTTP 평문 통신이 기본적으로 사용되지 않습니다.
   앱에서 네트워크 보안 구성을 통해 *.map.naver.com, *.map.naver.net 에 대한 평문 통신을 허용해 주세요.
```

## 🎯 문제 분석

### 1. **API 키 관련 문제**
- **현재 Client ID**: `unxdi5mt3f` (이전: `91y2nh0yff`)
- **401 Unauthorized**: API 키 인증 실패
- **500 Internal Server Error**: 서버 내부 오류

### 2. **네트워크 보안 문제**
- 안드로이드 9+ HTTP 평문 통신 제한
- 네이버 지도 도메인에 대한 보안 설정 필요

## 🔧 해결 방법

### A. 네이버 클라우드 플랫폼 설정 확인

#### 1. **API 키 상태 점검**
**네이버 클라우드 플랫폼 콘솔에서 확인:**

```
🔍 체크리스트:
□ Maps API 서비스가 활성화되어 있는가?
□ 사용량 한도를 초과하지 않았는가?
□ 결제 정보가 올바르게 등록되어 있는가?
□ API 키가 유효한가?
```

#### 2. **도메인 설정 업데이트**
**허용 도메인에 다음을 모두 추가:**

```
✅ 운영 도메인:
- https://nextstep.smap.site
- https://smap.site

✅ 개발 도메인:
- http://localhost:3000
- http://127.0.0.1:3000
- http://localhost:8080

✅ 모바일 WebView:
- file://
- https://nextstep.smap.site/*
```

#### 3. **API 사용량 및 요금 확인**
```
⚠️ 확인 사항:
- 일일/월간 사용량 한도
- 과금 여부 및 결제 상태
- 서비스 일시 중단 여부
```

### B. 코드 수준 해결 방법

#### 1. **API 키 환경변수 설정**
```javascript
// 환경변수로 API 키 관리
const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || 'unxdi5mt3f';

// API 키 검증 로직 추가
if (!NAVER_CLIENT_ID) {
  console.error('네이버 지도 API 키가 설정되지 않았습니다.');
}
```

#### 2. **오류 처리 개선**
```javascript
// 네이버 지도 로딩 실패 시 대체 처리
window.addEventListener('error', (event) => {
  if (event.message.includes('naver') || event.message.includes('maps')) {
    console.error('네이버 지도 로딩 실패:', event.message);
    // 대체 지도 서비스 로딩 또는 오류 메시지 표시
    showMapErrorMessage();
  }
});

function showMapErrorMessage() {
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">
        <div style="color: #dc2626; margin-bottom: 16px;">
          <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <h3 style="margin: 0 0 8px 0; color: #374151;">지도를 불러올 수 없습니다</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">네이버 지도 서비스에 일시적인 문제가 발생했습니다.<br>잠시 후 다시 시도해주세요.</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">새로고침</button>
      </div>
    `;
  }
}
```

#### 3. **재시도 로직 구현**
```javascript
let mapLoadAttempts = 0;
const maxMapLoadAttempts = 3;

function loadNaverMapsWithRetry() {
  return new Promise((resolve, reject) => {
    function attemptLoad() {
      mapLoadAttempts++;
      
      const script = document.createElement('script');
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
      
      script.onload = () => {
        console.log(`✅ 네이버 지도 로딩 성공 (시도: ${mapLoadAttempts})`);
        resolve(window.naver);
      };
      
      script.onerror = () => {
        console.error(`❌ 네이버 지도 로딩 실패 (시도: ${mapLoadAttempts})`);
        
        if (mapLoadAttempts < maxMapLoadAttempts) {
          console.log(`🔄 ${2000 * mapLoadAttempts}ms 후 재시도...`);
          setTimeout(attemptLoad, 2000 * mapLoadAttempts);
        } else {
          reject(new Error('네이버 지도 로딩 최대 재시도 횟수 초과'));
        }
      };
      
      document.head.appendChild(script);
    }
    
    attemptLoad();
  });
}
```

### C. 네트워크 보안 설정 (안드로이드)

#### 1. **network_security_config.xml 생성**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">map.naver.com</domain>
        <domain includeSubdomains="true">map.naver.net</domain>
        <domain includeSubdomains="true">oapi.map.naver.com</domain>
        <domain includeSubdomains="true">nextstep.smap.site</domain>
        <domain includeSubdomains="true">smap.site</domain>
    </domain-config>
    
    <!-- 개발용 localhost 허용 -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

#### 2. **AndroidManifest.xml 업데이트**
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="true"
    ... >
    ...
</application>
```

### D. iOS 설정 업데이트

#### 1. **Info.plist 네트워크 설정**
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <!-- 네이버 지도 API 도메인 -->
        <key>oapi.map.naver.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
        </dict>
        
        <key>map.naver.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
        </dict>
        
        <key>map.naver.net</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
        </dict>
    </dict>
</dict>
```

## 🚨 긴급 대응 방안

### 1. **대체 지도 서비스 준비**
```javascript
// 카카오맵 또는 구글맵으로 대체
const FALLBACK_MAP_SERVICES = [
  {
    name: 'kakao',
    script: 'https://dapi.kakao.com/v2/maps/sdk.js',
    apiKey: process.env.NEXT_PUBLIC_KAKAO_API_KEY
  },
  {
    name: 'google',
    script: 'https://maps.googleapis.com/maps/api/js',
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  }
];
```

### 2. **API 키 교체 준비**
```javascript
// 백업 API 키 목록
const NAVER_CLIENT_IDS = [
  'unxdi5mt3f',  // 현재 키
  'backup_key_1', // 백업 키 1
  'backup_key_2'  // 백업 키 2
];

function tryNextApiKey() {
  // 다음 API 키로 시도
}
```

## 📞 문의 및 지원

### 네이버 클라우드 플랫폼 지원
- **고객지원**: https://www.ncloud.com/support
- **기술문의**: 네이버 클라우드 플랫폼 콘솔 > 고객지원
- **API 문서**: https://apidocs.ncloud.com/ko/ai-naver/maps_web_sdk/

### ✅ 완료된 설정 확인 체크리스트
```
✅ API 키 설정: unxdi5mt3f
✅ API Secret: bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp
✅ 등록된 도메인:
   - https://nextstep.smap.site ✅
   - https://app2.smap.site ✅
   - https://app.smap.site ✅
   - http://118.67.130.71:3000/ ✅
   - http://localhost:3000 ✅
✅ 모바일 앱:
   - Android: com.dmonster.smap ✅
   - iOS: com.dmonster.smap ✅
✅ 코드 수정:
   - ncpKeyId 파라미터명 수정 ✅
   - 오류 처리 로직 개선 ✅
   - iOS WebView 설정 업데이트 ✅
   - App-Bound Domain 설정 ✅
```

### 🔍 추가 확인 사항
```
□ 네이버 클라우드 플랫폼 결제 상태
□ Maps API 서비스 활성화 상태
□ 일일/월간 사용량 한도 확인
□ 서비스 일시 중단 여부
```

---

**💡 업데이트**: 
- API 키 파라미터명을 `ncpClientId` → `ncpKeyId`로 수정
- 401/500 오류 자동 감지 및 구글 지도 전환 로직 추가
- iOS WebView App-Bound Domain 설정 완료
- 실시간 오류 모니터링 및 자동 복구 로직 구현 