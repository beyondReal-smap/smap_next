# iOS WebView 트러블슈팅 가이드 📱
## next.smap.site 데이터 로딩 및 화면 전환 문제 해결

### 🚨 현재 문제 상황
- ✅ 일반 웹브라우저에서는 next.smap.site가 정상 작동
- ❌ iOS WebView에서는 데이터 로딩이 안되고 화면 전환이 원활하지 않음

### 🔍 문제 진단 체크리스트

#### 1. 네트워크 연결 확인
```swift
// iOS 앱에 추가할 네트워크 상태 체크 코드
import Network

let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    if path.status == .satisfied {
        print("✅ 네트워크 연결됨")
        print("🌐 연결 타입: \(path.usesInterfaceType(.wifi) ? "WiFi" : "Cellular")")
    } else {
        print("❌ 네트워크 연결 안됨")
    }
}
let queue = DispatchQueue(label: "NetworkMonitor")
monitor.start(queue: queue)
```

#### 2. User-Agent 문제 확인
iOS WebView의 User-Agent가 웹사이트에서 차단되는지 확인:

```swift
// 현재 WebView의 User-Agent 확인
webView.evaluateJavaScript("navigator.userAgent") { result, error in
    if let userAgent = result as? String {
        print("🔍 현재 User-Agent: \(userAgent)")
    }
}

// User-Agent 변경 (데스크톱 Chrome으로 위장)
webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
```

#### 3. JavaScript 실행 환경 확인
```javascript
// WebView에서 실행할 진단 스크립트
function diagnoseWebViewEnvironment() {
    const diagnostics = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        cookieEnabled: navigator.cookieEnabled,
        localStorageAvailable: typeof(Storage) !== "undefined",
        sessionStorageAvailable: typeof(sessionStorage) !== "undefined",
        fetchAvailable: typeof(fetch) !== "undefined",
        webkitMessageHandlers: typeof(window.webkit) !== "undefined",
        currentURL: window.location.href,
        documentReady: document.readyState,
        viewportSize: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
    
    console.log('🔍 [WebView 진단]', JSON.stringify(diagnostics, null, 2));
    
    // iOS 앱에 진단 결과 전송
    if (window.webkit?.messageHandlers?.iosDebug) {
        window.webkit.messageHandlers.iosDebug.postMessage({
            type: 'environmentDiagnostics',
            data: diagnostics
        });
    }
    
    return diagnostics;
}

// 페이지 로드 후 자동 실행
document.addEventListener('DOMContentLoaded', diagnoseWebViewEnvironment);
```

#### 4. API 요청 실패 원인 확인
```javascript
// Fetch 요청 모니터링 스크립트
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    console.log('🌐 [Fetch 시작]', url, options);
    
    const startTime = Date.now();
    
    return originalFetch.apply(this, args)
        .then(response => {
            const duration = Date.now() - startTime;
            console.log('✅ [Fetch 성공]', url, {
                status: response.status,
                statusText: response.statusText,
                duration: duration + 'ms',
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // iOS 앱에 성공 정보 전송
            if (window.webkit?.messageHandlers?.performanceDebug) {
                window.webkit.messageHandlers.performanceDebug.postMessage({
                    type: 'fetchSuccess',
                    url: url,
                    status: response.status,
                    duration: duration
                });
            }
            
            return response;
        })
        .catch(error => {
            const duration = Date.now() - startTime;
            console.error('❌ [Fetch 실패]', url, {
                error: error.message,
                duration: duration + 'ms'
            });
            
            // iOS 앱에 에러 정보 전송
            if (window.webkit?.messageHandlers?.iosDebug) {
                window.webkit.messageHandlers.iosDebug.postMessage({
                    type: 'fetchError',
                    url: url,
                    error: error.message,
                    duration: duration
                });
            }
            
            throw error;
        });
};
```

### 🛠️ 해결 방법들

#### 방법 1: WebView 설정 최적화
```swift
// ViewController.swift에 추가
override func viewDidLoad() {
    super.viewDidLoad()
    
    let config = WKWebViewConfiguration()
    
    // 🔧 핵심 설정들
    config.preferences.javaScriptEnabled = true
    config.preferences.javaScriptCanOpenWindowsAutomatically = true
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    
    // 🌐 네트워크 설정
    config.websiteDataStore = WKWebsiteDataStore.default()
    
    // 📱 iOS 14+ 설정
    if #available(iOS 14.0, *) {
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.limitsNavigationsToAppBoundDomains = false
    }
    
    // 🎯 User-Agent 설정 (중요!)
    let webView = WKWebView(frame: view.bounds, configuration: config)
    webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    
    // 📬 메시지 핸들러 등록
    config.userContentController.add(self, name: "iosDebug")
    config.userContentController.add(self, name: "performanceDebug")
    
    webView.navigationDelegate = self
    webView.uiDelegate = self
    
    view.addSubview(webView)
    
    // 🌐 SMAP 사이트 로드
    if let url = URL(string: "https://next.smap.site") {
        let request = URLRequest(url: url)
        webView.load(request)
    }
}
```

#### 방법 2: 네트워크 요청 헤더 수정
```swift
// URLRequest 인터셉트하여 헤더 추가
func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    
    guard let url = navigationAction.request.url else {
        decisionHandler(.cancel)
        return
    }
    
    // SMAP 도메인인 경우 헤더 최적화
    if url.host?.contains("smap.site") == true {
        var request = navigationAction.request
        
        // 🔧 중요 헤더들 추가
        request.setValue("same-origin", forHTTPHeaderField: "Sec-Fetch-Site")
        request.setValue("navigate", forHTTPHeaderField: "Sec-Fetch-Mode")
        request.setValue("document", forHTTPHeaderField: "Sec-Fetch-Dest")
        request.setValue("?1", forHTTPHeaderField: "Sec-Fetch-User")
        request.setValue("gzip, deflate, br", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", forHTTPHeaderField: "Accept")
        request.setValue("ko-KR,ko;q=0.9,en;q=0.8", forHTTPHeaderField: "Accept-Language")
        
        webView.load(request)
        decisionHandler(.cancel)
        return
    }
    
    decisionHandler(.allow)
}
```

#### 방법 3: JavaScript 주입으로 환경 수정
```swift
// WebView 설정 시 JavaScript 스크립트 주입
private func addFixingScript() {
    let fixScript = """
    // iOS WebView 호환성 수정 스크립트
    (function() {
        'use strict';
        
        console.log('🔧 [SMAP-iOS] 호환성 수정 스크립트 시작');
        
        // 1. User-Agent 확인 및 수정
        if (navigator.userAgent.includes('Mobile')) {
            console.log('📱 [SMAP-iOS] 모바일 환경 감지됨');
            
            // 모바일 최적화 CSS 클래스 추가
            document.documentElement.classList.add('ios-webview');
        }
        
        // 2. 네트워크 요청 재시도 로직
        const originalFetch = window.fetch;
        let retryCount = 0;
        const maxRetries = 3;
        
        window.fetch = function(url, options = {}) {
            return originalFetch(url, {
                ...options,
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/plain, */*',
                    ...options.headers
                }
            }).catch(error => {
                console.warn('🔄 [SMAP-iOS] Fetch 실패, 재시도:', retryCount + 1);
                
                if (retryCount < maxRetries) {
                    retryCount++;
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(window.fetch(url, options));
                        }, 1000 * retryCount);
                    });
                }
                throw error;
            });
        };
        
        // 3. localStorage 접근 에러 처리
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            try {
                return originalSetItem.call(this, key, value);
            } catch (e) {
                console.warn('📦 [SMAP-iOS] localStorage 저장 실패:', key);
                // sessionStorage로 대체
                try {
                    sessionStorage.setItem(key, value);
                } catch (e2) {
                    console.error('❌ [SMAP-iOS] sessionStorage도 실패:', e2);
                }
            }
        };
        
        // 4. 페이지 로딩 상태 모니터링
        function checkPageReady() {
            const isReactReady = window.React !== undefined;
            const isNextReady = window.next !== undefined;
            const isDataLoaded = document.querySelectorAll('[data-loading="true"]').length === 0;
            
            console.log('📊 [SMAP-iOS] 페이지 상태:', {
                domReady: document.readyState,
                reactReady: isReactReady,
                nextReady: isNextReady,
                dataLoaded: isDataLoaded
            });
            
            if (document.readyState === 'complete' && isDataLoaded) {
                console.log('✅ [SMAP-iOS] 페이지 로딩 완료');
                
                // iOS 앱에 로딩 완료 알림
                if (window.webkit?.messageHandlers?.performanceDebug) {
                    window.webkit.messageHandlers.performanceDebug.postMessage({
                        type: 'pageLoadComplete',
                        timestamp: Date.now()
                    });
                }
            } else {
                // 5초 후 재확인
                setTimeout(checkPageReady, 5000);
            }
        }
        
        // 페이지 로드 완료 확인 시작
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkPageReady);
        } else {
            checkPageReady();
        }
        
        // 5. 에러 핸들링 강화
        window.addEventListener('error', function(e) {
            console.error('🚨 [SMAP-iOS] JavaScript 에러:', e.error);
            
            if (window.webkit?.messageHandlers?.iosDebug) {
                window.webkit.messageHandlers.iosDebug.postMessage({
                    type: 'jsError',
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno
                });
            }
        });
        
        window.addEventListener('unhandledrejection', function(e) {
            console.error('🚨 [SMAP-iOS] Promise 에러:', e.reason);
            
            if (window.webkit?.messageHandlers?.iosDebug) {
                window.webkit.messageHandlers.iosDebug.postMessage({
                    type: 'promiseError',
                    reason: String(e.reason)
                });
            }
        });
        
        console.log('✅ [SMAP-iOS] 호환성 수정 스크립트 완료');
    })();
    """
    
    let userScript = WKUserScript(source: fixScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    webView.configuration.userContentController.addUserScript(userScript)
}
```

#### 방법 4: Info.plist 설정 확인
```xml
<!-- Info.plist에 추가해야 할 설정들 -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <!-- 또는 특정 도메인만 허용 -->
    <key>NSExceptionDomains</key>
    <dict>
        <key>smap.site</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>

<!-- WebView에서 디버깅 허용 (개발 빌드에서만) -->
<key>WKWebViewDebugEnabled</key>
<true/>
```

### 🔍 단계별 디버깅 절차

#### 1단계: 기본 연결 확인
```swift
// 간단한 테스트 페이지 로드
if let url = URL(string: "https://httpbin.org/user-agent") {
    webView.load(URLRequest(url: url))
}
```

#### 2단계: SMAP 도메인 직접 접근
```swift
// SMAP API 직접 호출 테스트
if let url = URL(string: "https://next.smap.site/api/health") {
    URLSession.shared.dataTask(with: url) { data, response, error in
        DispatchQueue.main.async {
            if let error = error {
                print("❌ [API 테스트] 실패: \(error)")
            } else if let httpResponse = response as? HTTPURLResponse {
                print("✅ [API 테스트] 성공: \(httpResponse.statusCode)")
            }
        }
    }.resume()
}
```

#### 3단계: WebView 상세 로깅 활성화
```swift
// 모든 WebView 이벤트 로깅
extension ViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("🔄 [WebView] 로딩 시작: \(webView.url?.absoluteString ?? "unknown")")
    }
    
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        print("📄 [WebView] 컨텐츠 로드 시작")
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ [WebView] 로딩 완료")
        
        // 페이지 상태 확인
        webView.evaluateJavaScript("document.readyState") { result, error in
            print("📊 [WebView] Document 상태: \(result ?? "unknown")")
        }
        
        // JavaScript 오류 확인
        webView.evaluateJavaScript("window.onerror = function(msg, url, line) { console.log('JS Error:', msg, 'at', url, ':', line); };") { _, _ in }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("❌ [WebView] 네비게이션 실패: \(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("❌ [WebView] 프로비저널 네비게이션 실패: \(error.localizedDescription)")
    }
}
```

### 📊 성능 모니터링

#### JavaScript 성능 측정
```javascript
// 페이지 로드 성능 측정
window.addEventListener('load', function() {
    const perfData = performance.getEntriesByType('navigation')[0];
    console.log('📊 [성능] 로드 시간:', {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        totalTime: perfData.loadEventEnd - perfData.fetchStart
    });
    
    // iOS 앱에 성능 데이터 전송
    if (window.webkit?.messageHandlers?.performanceDebug) {
        window.webkit.messageHandlers.performanceDebug.postMessage({
            type: 'performanceMetrics',
            data: {
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
                totalTime: perfData.loadEventEnd - perfData.fetchStart
            }
        });
    }
});
```

### 🚀 최종 확인 사항

#### iOS 앱에서 확인할 것들:
1. ✅ 네트워크 연결 상태
2. ✅ User-Agent 설정
3. ✅ JavaScript 실행 권한
4. ✅ 쿠키 및 스토리지 접근 권한
5. ✅ CORS 및 CSP 정책
6. ✅ SSL 인증서 유효성

#### 웹사이트에서 확인할 것들:
1. ✅ 모바일 반응형 디자인
2. ✅ API 응답 시간
3. ✅ JavaScript 번들 크기
4. ✅ 이미지 최적화 상태
5. ✅ CDN 연결 상태

### 🔧 권장 해결 순서

1. **User-Agent 변경**: 가장 일반적인 원인
2. **네트워크 헤더 추가**: API 요청 인증 문제 해결
3. **JavaScript 환경 수정**: 호환성 문제 해결
4. **캐시 및 스토리지 최적화**: 성능 개선
5. **에러 핸들링 강화**: 안정성 향상

### 📞 추가 지원

이 가이드로 해결되지 않는 경우:
1. Xcode 콘솔에서 상세 로그 확인
2. Safari Web Inspector로 WebView 디버깅
3. 네트워크 탭에서 실패한 요청 확인
4. JavaScript 콘솔에서 에러 메시지 확인

모든 로그와 에러 메시지를 수집하여 추가 분석을 진행할 수 있습니다. 