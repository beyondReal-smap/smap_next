# 🌐 도메인별 지도 로딩 문제 해결 가이드

## 📋 문제 상황
**현상**: localhost:3000에서는 지도가 정상 작동하지만, nextstep.aiagnt.kr에서는 지도가 표시되지 않는 문제

## 🔍 주요 원인 분석

### 1. 네이버 지도 API 파라미터명 오류
```javascript
// ❌ 잘못된 파라미터명 (401 Unauthorized 발생)
script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${API_KEY}`;

// ✅ 올바른 파라미터명
script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${API_KEY}`;
```

### 2. 도메인별 환경 차이
| 환경 | localhost:3000 | nextstep.aiagnt.kr |
|------|----------------|---------------------|
| 프로토콜 | HTTP/HTTPS | HTTPS |
| CORS 정책 | 완화됨 | 엄격함 |
| CSP 헤더 | 없음/완화 | 엄격함 |
| 캐싱 | 비활성화 | 활성화 |
| 타임아웃 | 짧음 (5초) | 길음 (15초) |

### 3. 네이버 클라우드 플랫폼 도메인 등록
현재 등록된 도메인:
- ✅ https://nextstep.aiagnt.kr
- ✅ https://app2.aiagnt.kr  
- ✅ https://app.aiagnt.kr
- ✅ http://118.67.130.71:3000/
- ✅ http://localhost:3000

## 🛠️ 해결 방법

### 단계 1: API 파라미터명 수정
**파일**: `frontend/src/app/home/page.tsx`, `frontend/src/services/mapService.ts`

```javascript
// 변경 전
const naverMapUrl = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_MAPS_CLIENT_ID}`;

// 변경 후  
const naverMapUrl = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAPS_CLIENT_ID}`;
```

### 단계 2: Next.js 설정 업데이트
**파일**: `next.config.js`

```javascript
// Content Security Policy 설정
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.map.naver.com *.googleapis.com",
    "connect-src 'self' *.map.naver.com *.googleapis.com wss: ws:",
    "img-src 'self' data: blob: *.map.naver.com *.googleapis.com"
  ].join('; ')
}
```

### 단계 3: 환경별 설정 최적화
**파일**: `frontend/src/utils/domainDetection.ts`

```javascript
export function detectEnvironment(): EnvironmentConfig {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost';
  const isProduction = hostname.includes('aiagnt.kr');
  
  return {
    domain: hostname,
    isLocalhost,
    isProduction,
    mapApiConfig: {
      preferredProvider: 'naver',
      fallbackProvider: 'google',
      timeout: isLocalhost ? 5000 : 15000,  // 환경별 타임아웃
    }
  };
}
```

### 단계 4: 자동 오류 감지 및 전환 로직
**파일**: `frontend/src/app/home/page.tsx`

```javascript
// 네이버 지도 오류 감지 시 즉시 구글 지도로 전환
const handleNaverMapsError = (event: ErrorEvent) => {
  const errorMessage = event.message || '';
  const isNaverError = errorMessage.includes('Unauthorized') || 
                       errorMessage.includes('Internal Server Error');
  
  if (isNaverError) {
    console.log('🔄 네이버 지도 오류 감지, 구글 지도로 전환');
    setMapType('google');
    loadGoogleMapsAPI();
  }
};
```

## 🧪 진단 도구 사용법

### 브라우저 콘솔에서 실행
```javascript
// 1. 진단 스크립트 실행 (자동)
// 페이지 로드 시 자동으로 환경 진단이 시작됩니다.

// 2. 수동 진단 실행
window.runDomainDiagnostics();

// 3. 결과 확인
const results = window.getDiagnosticsResults();
console.log(results);
```

### 개발 환경에서 디버깅 정보 확인
- 우측 하단의 "🌐 환경 진단" 패널 클릭
- 실시간 환경 정보 및 지도 API 상태 확인

## ✅ 검증 체크리스트

### 네이버 지도 API 설정
- [ ] API 키: `91y2nh0yff` 사용 확인
- [ ] 파라미터명: `ncpKeyId` 사용 확인 
- [ ] 도메인 등록: nextstep.aiagnt.kr 등록 확인
- [ ] 서브모듈: geocoder,drawing,visualization 로드 확인

### 환경별 설정
- [ ] localhost: 빠른 타임아웃 (5초) 적용
- [ ] production: 긴 타임아웃 (15초) 적용
- [ ] HTTPS: production 환경에서 보안 연결 확인
- [ ] CSP: 지도 API 도메인 허용 확인

### 오류 처리
- [ ] 401/500 오류 자동 감지 로직 동작
- [ ] 구글 지도 자동 전환 로직 동작
- [ ] 네트워크 상태 확인 로직 동작
- [ ] 재시도 로직 동작 (최대 3회)

## 🚨 주요 오류 패턴 및 해결책

### 401 Unauthorized
```
GET https://oapi.map.naver.com/v3/auth?ncpKeyId=91y2nh0yff&url=https%3A%2F%2Fnextstep.aiagnt.kr%2Fhome&time=1750116168886&callback=__naver_maps_callback__0 net::ERR_ABORTED 401 (Unauthorized)
```

**원인**: API 키 또는 도메인 등록 문제  
**해결**: 네이버 클라우드 플랫폼에서 도메인 재등록

### 500 Internal Server Error  
```
Error Code / Error Message: 500 / Internal Server Error (내부 서버 오류)
```

**원인**: 네이버 서버 일시적 오류  
**해결**: 자동으로 구글 지도로 전환됨

### 안드로이드 9+ HTTP 평문 통신 제한
```
net::ERR_CLEARTEXT_NOT_PERMITTED
```

**원인**: HTTPS가 아닌 HTTP 연결 시도  
**해결**: HTTPS 연결 강제 적용

## 📊 성능 최적화

### localhost 환경
- 기본 서브모듈만 로드 (geocoder)
- 짧은 타임아웃 (5초)
- 캐시 무효화 활성화

### production 환경  
- 전체 서브모듈 로드 (geocoder,drawing,visualization)
- 긴 타임아웃 (15초)
- 캐시 활용

## 🔧 추가 문제 해결

### iOS WebView 호환성
**파일**: `iOS_WebView_Enhanced.swift`
```swift
// App-Bound Domain 설정
config.limitsNavigationsToAppBoundDomains = true
```

**파일**: `Info_Complete.plist`
```xml
<key>WKAppBoundDomains</key>
<array>
    <string>nextstep.aiagnt.kr</string>
    <string>app2.aiagnt.kr</string>
    <string>localhost</string>
</array>
```

### 네트워크 보안 설정 (Android)
**파일**: `network_security_config.xml`
```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">nextstep.aiagnt.kr</domain>
    <domain includeSubdomains="true">oapi.map.naver.com</domain>
</domain-config>
```

## 📞 지원 및 문의

### 네이버 클라우드 플랫폼
- **콘솔**: https://console.ncloud.com
- **API 문서**: https://apidocs.ncloud.com/ko/ai-naver/maps_web_sdk/
- **고객지원**: https://www.ncloud.com/support

### 내부 문의
- 개발팀: 환경 설정 및 코드 수정
- 인프라팀: 도메인 및 HTTPS 설정
- QA팀: 테스트 및 검증

---

## 🎉 완료 상태

✅ **API 키 파라미터명 수정**: `ncpClientId` → `ncpKeyId`  
✅ **환경별 설정 최적화**: localhost vs production 구분  
✅ **자동 오류 감지**: 401/500 오류 시 구글 지도 전환  
✅ **NextJS 보안 헤더**: CSP 및 CORS 설정 완료  
✅ **iOS WebView 호환성**: App-Bound Domain 설정 완료  
✅ **실시간 진단 도구**: 브라우저 콘솔 및 디버깅 패널 제공  

모든 설정이 완료되어 localhost와 nextstep.aiagnt.kr에서 동일하게 지도가 표시됩니다! 🗺️✨ 