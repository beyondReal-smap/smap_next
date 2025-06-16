# 🔐 iOS App-Bound Domain 오류 해결 가이드

## 📋 문제 상황
```
❌ [SMAP-HAPTIC] JavaScript 함수 등록 실패: 
Error Domain=WKErrorDomain Code=14 
"JavaScript execution targeted a frame that is not in an app-bound domain" 
UserInfo={WKJavaScriptExceptionLineNumber=0, 
WKJavaScriptExceptionMessage=Unable to execute JavaScript in a frame that is not in an app-bound domain, 
WKJavaScriptExceptionColumnNumber=0, 
NSLocalizedDescription=JavaScript execution targeted a frame that is not in an app-bound domain}
```

## 🎯 해결 방법

### 1. Info.plist 설정 추가 ✅ (완료됨)

`Info_Complete.plist` 파일에 다음 설정이 추가되었습니다:

```xml
<!-- 🔐 App-Bound Domains 설정 (JavaScript 실행 허용) -->
<key>WKAppBoundDomains</key>
<array>
    <string>nextstep.smap.site</string>
    <string>smap.site</string>
    <string>localhost</string>
</array>
```

### 2. WebView 설정 업데이트 ✅ (완료됨)

`iOS_WebView_Enhanced.swift` 파일에 App-Bound Domain 설정이 추가되었습니다:

```swift
// 🔐 App-Bound Domain 관련 설정 (iOS 14+)
if #available(iOS 14.0, *) {
    config.limitsNavigationsToAppBoundDomains = true
    print("🔐 [WebView] App-Bound Domain 제한 활성화됨")
    print("🔐 [WebView] 허용된 도메인: nextstep.smap.site, smap.site, localhost")
}
```

### 3. 추가 설정 방법

#### A. 대안 방법 1: App-Bound Domain 제한 해제
만약 계속 문제가 발생한다면, 일시적으로 제한을 해제할 수 있습니다:

```swift
// 🔐 개발 중에만 사용 - App-Bound Domain 제한 해제
if #available(iOS 14.0, *) {
    config.limitsNavigationsToAppBoundDomains = false
    print("🔓 [WebView] App-Bound Domain 제한 해제됨 (개발용)")
}
```

#### B. 대안 방법 2: JavaScript 실행 방식 변경
WKWebView의 `evaluateJavaScript` 메서드를 사용할 때 completion handler를 활용:

```swift
// 안전한 JavaScript 실행
webView.evaluateJavaScript("""
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
        window.webkit.messageHandlers.smapIos.postMessage({
            type: 'haptic', 
            param: 'success'
        });
    } else {
        console.log('Message handler not available');
    }
""") { result, error in
    if let error = error {
        print("❌ [JavaScript] 실행 오류: \(error)")
    } else {
        print("✅ [JavaScript] 실행 성공")
    }
}
```

### 4. 문제 진단 및 테스트

#### A. 현재 도메인 확인
JavaScript 콘솔에서 다음 명령어로 현재 도메인 확인:

```javascript
console.log('현재 도메인:', window.location.hostname);
console.log('현재 URL:', window.location.href);
console.log('Message Handler 사용 가능:', !!window.webkit?.messageHandlers?.smapIos);
```

#### B. WebView 설정 확인
iOS 코드에서 설정 상태 확인:

```swift
func checkWebViewConfiguration() {
    if #available(iOS 14.0, *) {
        print("🔍 [Debug] App-Bound Domain 제한:", webView.configuration.limitsNavigationsToAppBoundDomains)
    }
    print("🔍 [Debug] JavaScript 활성화:", webView.configuration.preferences.javaScriptEnabled)
    print("🔍 [Debug] 현재 URL:", webView.url?.absoluteString ?? "None")
}
```

### 5. 햅틱 피드백 테스트 방법

#### A. 웹 브라우저에서 테스트
개발자 도구 콘솔에서:

```javascript
// 기본 햅틱 테스트
window.webkit.messageHandlers.smapIos.postMessage({
    type: 'haptic', 
    param: 'success'
});

// 고급 햅틱 테스트
window.webkit.messageHandlers.smapIos.postMessage({
    type: 'hapticFeedback',
    param: {
        type: 'impact',
        style: 'medium',
        intensity: 0.8
    }
});
```

#### B. iOS 시뮬레이터에서 테스트
시뮬레이터는 햅틱을 지원하지 않으므로 실제 기기에서 테스트해야 합니다.

### 6. 로깅 및 디버깅

#### A. 상세 로깅 활성화
`iOS_Haptic_Handler.swift`에 추가 로깅:

```swift
func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    // App-Bound Domain 체크
    if #available(iOS 14.0, *) {
        let isAppBound = webView.configuration.limitsNavigationsToAppBoundDomains
        print("🔐 [Debug] App-Bound Domain 제한: \(isAppBound)")
        print("🔐 [Debug] 현재 URL: \(webView.url?.absoluteString ?? "Unknown")")
    }
    
    // 기존 메시지 처리 로직...
}
```

#### B. 오류 처리 개선
```swift
// JavaScript 실행 시 오류 처리
webView.evaluateJavaScript(scriptCode) { result, error in
    if let error = error as NSError? {
        if error.domain == "WKErrorDomain" && error.code == 14 {
            print("❌ [App-Bound] App-Bound Domain 오류 발생")
            print("💡 [Fix] Info.plist에 WKAppBoundDomains 설정을 확인하세요")
        } else {
            print("❌ [JavaScript] 다른 오류: \(error)")
        }
    }
}
```

### 7. 프로덕션 배포 시 고려사항

#### A. 보안 설정
- App-Bound Domain은 보안을 위한 기능이므로 프로덕션에서는 필요한 도메인만 포함
- `limitsNavigationsToAppBoundDomains = false`는 개발 중에만 사용

#### B. 도메인 관리
```xml
<!-- 프로덕션용 최소 도메인 설정 -->
<key>WKAppBoundDomains</key>
<array>
    <string>nextstep.smap.site</string>
    <string>smap.site</string>
    <!-- 개발용 localhost는 프로덕션에서 제거 -->
</array>
```

## 🚀 빠른 해결 체크리스트

- [x] **Info.plist에 WKAppBoundDomains 추가됨**
- [x] **WebView 설정에 limitsNavigationsToAppBoundDomains = true 추가됨**
- [ ] **앱 재빌드 및 재설치 필요**
- [ ] **실제 기기에서 테스트 (시뮬레이터는 햅틱 미지원)**
- [ ] **Safari 개발자 도구로 웹페이지 디버깅**

## 🔧 추가 문제 해결

만약 위 설정 후에도 문제가 계속된다면:

1. **앱 완전 재설치**: 기존 앱 삭제 후 새로 설치
2. **캐시 클리어**: WebView 캐시 및 쿠키 삭제
3. **iOS 버전 확인**: iOS 14+ 이상인지 확인
4. **실제 기기 테스트**: 시뮬레이터 대신 실제 iPhone에서 테스트

## 📞 문제 지속 시 체크포인트

```swift
// 디버깅용 종합 체크 함수
func debugAppBoundDomainStatus() {
    print("🔍 [Debug] App-Bound Domain 진단 시작")
    print("📱 [Device] iOS 버전: \(UIDevice.current.systemVersion)")
    print("🌐 [URL] 현재 URL: \(webView.url?.absoluteString ?? "None")")
    
    if #available(iOS 14.0, *) {
        print("🔐 [Config] App-Bound 제한: \(webView.configuration.limitsNavigationsToAppBoundDomains)")
    }
    
    print("🔧 [Config] JavaScript 활성화: \(webView.configuration.preferences.javaScriptEnabled)")
    print("📬 [Handlers] 등록된 핸들러: \(webView.configuration.userContentController.debugDescription)")
}
```

이 가이드를 따라 설정하면 App-Bound Domain 오류가 해결되어야 합니다! 🎉 