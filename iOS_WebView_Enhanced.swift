// iOS WebView 종합 최적화 - 데이터 로딩 및 화면 전환 문제 해결
// nextstep.smap.site 웹사이트와 iOS WebView 간의 호환성 개선

import WebKit
import UIKit
import Network
import os.log
import CoreLocation

class EnhancedWebViewController: UIViewController {
    
    // MARK: - 🏷️ 로깅 시스템
    private static let networkLog = OSLog(subsystem: "com.smap.app", category: "🌐_Network")
    private static let performanceLog = OSLog(subsystem: "com.smap.app", category: "⚡_Performance")
    private static let navigationLog = OSLog(subsystem: "com.smap.app", category: "🧭_Navigation")
    private static let debugLog = OSLog(subsystem: "com.smap.app", category: "🔍_Debug")
    
    // MARK: - 🎯 WebView 및 관련 속성
    var webView: WKWebView!
    private var progressView: UIProgressView!
    private var activityIndicator: UIActivityIndicatorView!
    
    // MARK: - 📊 성능 모니터링
    private var pageLoadStartTime: Date?
    private var networkMonitor: NWPathMonitor?
    private var isOnline = true
    private var retryCount = 0
    private let maxRetryCount = 3
    
    // MARK: - 🛠️ 설정 상수
    private let targetURL = "https://nextstep.smap.site"
    private let requestTimeout: TimeInterval = 30.0
    private let cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy
    
    // MARK: - 📍 위치 관련
    private var locationManager: CLLocationManager?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        logSystemInfo()
        setupNetworkMonitoring()
        setupWebView()
        setupUI()
        loadWebsite()
    }
    
    // MARK: - 📱 시스템 정보 로깅
    private func logSystemInfo() {
        let device = UIDevice.current
        let systemVersion = ProcessInfo.processInfo.operatingSystemVersion
        
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 📱 [SMAP-iOS] WebView 초기화 시작                                              ║")
        print("╠═══════════════════════════════════════════════════════════════════════════════╣")
        print("║ 🏷️ 앱 버전: SMAP iOS v1.0                                                     ║")
        print("║ 📱 기기: \(device.model) (\(device.systemName) \(systemVersion.majorVersion).\(systemVersion.minorVersion))                              ║")
        print("║ 🌐 대상 URL: \(targetURL)                                                      ║")
        print("║ ⏰ 시작 시간: \(Date().formatted(date: .omitted, time: .standard))                                       ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        os_log("📱 [WebView] 초기화 시작 - %{public}@ %{public}@", 
               log: Self.debugLog, type: .info, device.model, device.systemVersion)
    }
    
    // MARK: - 🌐 네트워크 모니터링 설정
    private func setupNetworkMonitoring() {
        networkMonitor = NWPathMonitor()
        let queue = DispatchQueue(label: "NetworkMonitor")
        
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.handleNetworkChange(path: path)
            }
        }
        
        networkMonitor?.start(queue: queue)
        print("🌐 [Network] 네트워크 모니터링 시작")
    }
    
    private func handleNetworkChange(path: NWPath) {
        let wasOnline = isOnline
        isOnline = path.status == .satisfied
        
        let connectionType = path.usesInterfaceType(.wifi) ? "WiFi" : 
                           path.usesInterfaceType(.cellular) ? "Cellular" : "Unknown"
        
        print("🌐 [Network] 상태 변경: \(isOnline ? "온라인" : "오프라인") (\(connectionType))")
        os_log("🌐 [Network] 상태: %{public}@ (%{public}@)", 
               log: Self.networkLog, type: .info, isOnline ? "온라인" : "오프라인", connectionType)
        
        // 오프라인에서 온라인으로 복구된 경우 자동 새로고침
        if !wasOnline && isOnline && webView != nil {
            print("🔄 [Network] 네트워크 복구됨, 페이지 새로고침")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.webView.reload()
            }
        }
    }
    
    // MARK: - 🔐 App-Bound Domain 디버깅 함수
    private func debugAppBoundDomainStatus() {
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 🔍 [App-Bound Domain] 진단 시작                                               ║")
        print("╠═══════════════════════════════════════════════════════════════════════════════╣")
        print("║ 📱 iOS 버전: \(UIDevice.current.systemVersion.padding(toLength: 20, withPad: " ", startingAt: 0))                                                ║")
        print("║ 🌐 현재 URL: \(webView.url?.absoluteString?.prefix(60) ?? "None".padding(toLength: 60, withPad: " ", startingAt: 0))    ║")
        
        if #available(iOS 14.0, *) {
            let isAppBound = webView.configuration.limitsNavigationsToAppBoundDomains
            print("║ 🔐 App-Bound 제한: \(isAppBound ? "활성화" : "비활성화".padding(toLength: 15, withPad: " ", startingAt: 0))                                         ║")
        } else {
            print("║ 🔐 App-Bound 제한: iOS 14 미만 (미지원)                                       ║")
        }
        
        let jsEnabled = webView.configuration.preferences.javaScriptEnabled
        print("║ 🔧 JavaScript: \(jsEnabled ? "활성화" : "비활성화".padding(toLength: 15, withPad: " ", startingAt: 0))                                              ║")
        
        let handlerCount = webView.configuration.userContentController.userScripts.count
        print("║ 📬 User Scripts: \(String(handlerCount).padding(toLength: 15, withPad: " ", startingAt: 0))                                                    ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // JavaScript로 핸들러 상태 확인
        checkMessageHandlersAvailability()
    }
    
    private func checkMessageHandlersAvailability() {
        let checkScript = """
        (function() {
            const result = {
                hasWebKit: !!window.webkit,
                hasMessageHandlers: !!window.webkit?.messageHandlers,
                handlers: [],
                smapHapticSystem: !!window.SMAP_HAPTIC_SYSTEM,
                currentURL: window.location.href,
                domain: window.location.hostname
            };
            
            if (window.webkit?.messageHandlers) {
                const handlers = window.webkit.messageHandlers;
                result.handlers = Object.keys(handlers);
            }
            
            return JSON.stringify(result);
        })();
        """
        
        webView.evaluateJavaScript(checkScript) { [weak self] result, error in
            if let error = error {
                print("❌ [JavaScript] 핸들러 확인 오류: \(error)")
                if let nsError = error as NSError? {
                    print("❌ [Error Details] Domain: \(nsError.domain), Code: \(nsError.code)")
                    if nsError.domain == "WKErrorDomain" && nsError.code == 14 {
                        print("🔐 [App-Bound] App-Bound Domain 오류 감지!")
                        self?.handleAppBoundDomainError()
                    }
                }
            } else if let resultString = result as? String,
                      let data = resultString.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                self?.printHandlerStatus(json)
            }
        }
    }
    
    private func printHandlerStatus(_ status: [String: Any]) {
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 📊 [JavaScript] 핸들러 상태 확인 결과                                          ║")
        print("╠═══════════════════════════════════════════════════════════════════════════════╣")
        
        let hasWebKit = status["hasWebKit"] as? Bool ?? false
        let hasHandlers = status["hasMessageHandlers"] as? Bool ?? false
        let handlers = status["handlers"] as? [String] ?? []
        let hasHapticSystem = status["smapHapticSystem"] as? Bool ?? false
        let domain = status["domain"] as? String ?? "Unknown"
        
        print("║ 🔧 WebKit: \((hasWebKit ? "✅ 사용가능" : "❌ 없음").padding(toLength: 20, withPad: " ", startingAt: 0))                                                ║")
        print("║ 📬 MessageHandlers: \((hasHandlers ? "✅ 사용가능" : "❌ 없음").padding(toLength: 20, withPad: " ", startingAt: 0))                                      ║")
        print("║ 🎮 SMAP 햅틱 시스템: \((hasHapticSystem ? "✅ 초기화됨" : "❌ 없음").padding(toLength: 20, withPad: " ", startingAt: 0))                                   ║")
        print("║ 🌐 도메인: \(domain.padding(toLength: 60, withPad: " ", startingAt: 0))           ║")
        print("║ 📋 핸들러 목록: \(handlers.joined(separator: ", ").padding(toLength: 50, withPad: " ", startingAt: 0))      ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // 햅틱 시스템이 없으면 강제 초기화 시도
        if !hasHapticSystem {
            print("🔧 [SMAP-HAPTIC] 시스템 미초기화, 강제 초기화 시도")
            forceInitializeHapticSystem()
        }
    }
    
    private func handleAppBoundDomainError() {
        print("🚨 [App-Bound Domain] 오류 해결 시도 시작")
        
        // 1. 현재 도메인이 허용 목록에 있는지 확인
        guard let currentURL = webView.url else {
            print("❌ [App-Bound] 현재 URL을 가져올 수 없음")
            return
        }
        
        let allowedDomains = ["nextstep.smap.site", "app2.smap.site", "app.smap.site", "smap.site", "localhost"]
        let currentDomain = currentURL.host ?? ""
        
        print("🔍 [App-Bound] 현재 도메인: \(currentDomain)")
        print("🔍 [App-Bound] 허용된 도메인들: \(allowedDomains)")
        
        if allowedDomains.contains(currentDomain) {
            print("✅ [App-Bound] 도메인이 허용 목록에 있음")
            
            // 2. 햅틱 시스템 강제 재초기화
            forceInitializeHapticSystem()
            
        } else {
            print("❌ [App-Bound] 도메인이 허용 목록에 없음: \(currentDomain)")
            
            // 허용되지 않은 도메인에서는 App-Bound 제한 일시 해제
            if #available(iOS 14.0, *) {
                print("🔓 [App-Bound] 일시적으로 제한 해제")
                // 주의: 프로덕션에서는 보안상 권장되지 않음
            }
        }
    }
    
    private func forceInitializeHapticSystem() {
        let initScript = """
        (function() {
            console.log('🔧 [FORCE-INIT] 햅틱 시스템 강제 초기화 시작');
            
            // 1. WebKit messageHandlers 강제 생성 시도
            try {
                if (window.webkit && !window.webkit.messageHandlers) {
                    console.log('🔧 [FORCE-INIT] messageHandlers 객체 생성 시도');
                    Object.defineProperty(window.webkit, 'messageHandlers', {
                        value: {},
                        writable: true,
                        configurable: true
                    });
                }
                
                // 2. 핸들러 모의 객체 생성
                const handlerNames = ['smapIos', 'iosHandler', 'hapticHandler', 'messageHandler'];
                for (const name of handlerNames) {
                    if (window.webkit && window.webkit.messageHandlers && !window.webkit.messageHandlers[name]) {
                        console.log('🔧 [FORCE-INIT] 핸들러 생성:', name);
                        
                        // 네이티브 메시지 전송을 시뮬레이션하는 함수
                        window.webkit.messageHandlers[name] = {
                            postMessage: function(message) {
                                console.log('📤 [SIMULATED-HANDLER]', name, '메시지:', message);
                                
                                // 네이티브 앱으로 메시지 전송 시뮬레이션
                                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos && window.webkit.messageHandlers.smapIos !== this) {
                                    window.webkit.messageHandlers.smapIos.postMessage(message);
                                } else {
                                    // 실제 네이티브 핸들러가 없는 경우 이벤트로 전달
                                    window.dispatchEvent(new CustomEvent('smap-haptic-fallback', { 
                                        detail: { handler: name, message: message } 
                                    }));
                                }
                            }
                        };
                    }
                }
                
            } catch (error) {
                console.log('⚠️ [FORCE-INIT] 핸들러 생성 실패:', error);
            }
            
            // 3. SMAP 햅틱 시스템 초기화
            if (window.SMAP_HAPTIC_SYSTEM) {
                console.log('🔧 [FORCE-INIT] 기존 시스템 재초기화');
                window.SMAP_HAPTIC_SYSTEM.initialized = false;
                window.SMAP_HAPTIC_SYSTEM.handlers = [];
                return window.SMAP_HAPTIC_SYSTEM.init();
            } else {
                console.log('❌ [FORCE-INIT] SMAP_HAPTIC_SYSTEM 없음, 기본 시스템 생성');
                
                // 기본 햅틱 시스템 생성
                window.SMAP_HAPTIC_SYSTEM = {
                    initialized: false,
                    handlers: [],
                    init: function() {
                        if (window.webkit && window.webkit.messageHandlers) {
                            const available = Object.keys(window.webkit.messageHandlers);
                            this.handlers = available;
                            this.initialized = true;
                            console.log('✅ [FORCE-INIT] 기본 시스템 초기화 완료:', available);
                            return true;
                        }
                        return false;
                    }
                };
                
                return window.SMAP_HAPTIC_SYSTEM.init();
            }
        })();
        """
        
        webView.evaluateJavaScript(initScript) { [weak self] result, error in
            if let error = error {
                print("❌ [FORCE-INIT] 강제 초기화 실패: \(error)")
                // 네이티브 레벨에서 강제 핸들러 재등록 시도
                self?.forceRegisterNativeHandlers()
            } else {
                print("✅ [FORCE-INIT] 강제 초기화 완료: \(result ?? "unknown")")
                
                // 테스트 햅틱 실행
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self?.testHapticFunction()
                }
            }
        }
    }
    
    private func forceRegisterNativeHandlers() {
        print("🔧 [NATIVE-FORCE] 네이티브 핸들러 강제 재등록 시작")
        
        // 기존 사용자 콘텐츠 컨트롤러 정리
        webView.configuration.userContentController.removeAllUserScripts()
        
        // 모든 메시지 핸들러 제거 후 재등록
        let handlerNames = ["smapIos", "iosHandler", "jsToNative", "webViewHandler", "nativeHandler", "hapticHandler", "messageHandler"]
        for handlerName in handlerNames {
            webView.configuration.userContentController.removeScriptMessageHandler(forName: handlerName)
        }
        
        // 메시지 핸들러 재등록
        setupMessageHandlers(config: webView.configuration)
        
        print("✅ [NATIVE-FORCE] 네이티브 핸들러 재등록 완료")
        
        // 강제 초기화 재시도
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.forceInitializeHapticSystem()
        }
    }
    
    private func setupFallbackHapticSystem() {
        let fallbackScript = """
        (function() {
            console.log('🔄 [FALLBACK] Fallback 햅틱 시스템 설정 시작');
            
            // Fallback 이벤트 리스너 등록
            window.addEventListener('smap-haptic-fallback', function(event) {
                console.log('🎯 [FALLBACK] Fallback 햅틱 이벤트 수신:', event.detail);
                
                const message = event.detail.message;
                if (message && message.type === 'haptic') {
                    console.log('🎮 [FALLBACK] 웹 기반 햅틱 피드백 실행:', message.param);
                    
                    // 웹 기반 햅틱 대안 (Vibration API)
                    if (navigator.vibrate) {
                        const hapticMap = {
                            'success': [100, 50, 100],
                            'warning': [200, 100, 200],
                            'error': [300, 100, 300, 100, 300],
                            'light': [50],
                            'medium': [100],
                            'heavy': [200],
                            'selection': [25]
                        };
                        
                        const pattern = hapticMap[message.param] || [100];
                        navigator.vibrate(pattern);
                        console.log('✅ [FALLBACK] 진동 패턴 실행:', pattern);
                    } else {
                        console.log('⚠️ [FALLBACK] 진동 API 미지원');
                    }
                    
                    // 시각적 피드백 제공
                    const body = document.body;
                    if (body) {
                        body.style.transition = 'transform 0.1s ease-out';
                        body.style.transform = 'scale(0.998)';
                        setTimeout(() => {
                            body.style.transform = 'scale(1)';
                            setTimeout(() => {
                                body.style.transition = '';
                            }, 100);
                        }, 50);
                        console.log('✅ [FALLBACK] 시각적 피드백 제공');
                    }
                }
            });
            
            // 강화된 햅틱 함수 오버라이드
            const originalSMAPHaptic = window.SMAP_HAPTIC;
            window.SMAP_HAPTIC = function(type, intensity = 1.0) {
                console.log('🎮 [ENHANCED-HAPTIC] 강화된 햅틱 함수 호출:', type);
                
                // 1. 원본 함수 시도
                if (originalSMAPHaptic && typeof originalSMAPHaptic === 'function') {
                    try {
                        const result = originalSMAPHaptic(type, intensity);
                        if (result) {
                            console.log('✅ [ENHANCED-HAPTIC] 원본 함수 성공');
                            return true;
                        }
                    } catch (error) {
                        console.log('⚠️ [ENHANCED-HAPTIC] 원본 함수 실패:', error);
                    }
                }
                
                // 2. Fallback 이벤트 발생
                console.log('🔄 [ENHANCED-HAPTIC] Fallback 이벤트 발생');
                window.dispatchEvent(new CustomEvent('smap-haptic-fallback', {
                    detail: {
                        handler: 'enhanced',
                        message: {
                            type: 'haptic',
                            param: type,
                            intensity: intensity,
                            timestamp: Date.now()
                        }
                    }
                }));
                
                return true;
            };
            
            // 디버깅 함수 강화
            const originalDebugHaptic = window.SMAP_DEBUG_HAPTIC;
            window.SMAP_DEBUG_HAPTIC = function() {
                console.log('🔍 [ENHANCED-DEBUG] 강화된 디버그 함수 실행');
                
                // 원본 함수 실행
                if (originalDebugHaptic && typeof originalDebugHaptic === 'function') {
                    try {
                        const result = originalDebugHaptic();
                        console.log('🔍 [ENHANCED-DEBUG] 원본 디버그 결과:', result);
                    } catch (error) {
                        console.log('⚠️ [ENHANCED-DEBUG] 원본 디버그 실패:', error);
                    }
                }
                
                // 추가 정보 제공
                console.log('🔍 [ENHANCED-DEBUG] 강화된 디버그 정보:');
                console.log('  - WebKit 존재:', !!window.webkit);
                console.log('  - MessageHandlers 존재:', !!window.webkit?.messageHandlers);
                console.log('  - 사용 가능한 핸들러:', window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : []);
                console.log('  - Vibration API 지원:', !!navigator.vibrate);
                console.log('  - User Agent:', navigator.userAgent);
                console.log('  - 현재 URL:', window.location.href);
                
                // Fallback 테스트 실행
                console.log('🧪 [ENHANCED-DEBUG] Fallback 테스트 실행');
                window.SMAP_HAPTIC('success');
                
                return {
                    enhanced: true,
                    webkit: !!window.webkit,
                    messageHandlers: !!window.webkit?.messageHandlers,
                    handlers: window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : [],
                    vibrationSupport: !!navigator.vibrate,
                    fallbackActive: true
                };
            };
            
            console.log('✅ [FALLBACK] Fallback 햅틱 시스템 설정 완료');
            
            // 즉시 테스트 실행
            setTimeout(() => {
                console.log('🧪 [FALLBACK] 자동 테스트 실행');
                window.SMAP_DEBUG_HAPTIC();
            }, 1000);
            
            return true;
        })();
        """
        
        webView.evaluateJavaScript(fallbackScript) { result, error in
            if let error = error {
                print("❌ [FALLBACK] Fallback 시스템 설정 실패: \(error)")
            } else {
                print("✅ [FALLBACK] Fallback 시스템 설정 완료: \(result ?? "unknown")")
            }
        }
    }
    
    private func testHapticFunction() {
        let testScript = """
        (function() {
            console.log('🧪 [TEST] 햅틱 테스트 시작');
            
            if (window.SMAP_HAPTIC) {
                console.log('🧪 [TEST] SMAP_HAPTIC 함수 실행');
                return window.SMAP_HAPTIC('success');
            } else if (window.SMAP_DEBUG_HAPTIC) {
                console.log('🧪 [TEST] SMAP_DEBUG_HAPTIC 함수 실행');
                return window.SMAP_DEBUG_HAPTIC();
            } else {
                console.log('❌ [TEST] 햅틱 함수 없음');
                return false;
            }
        })();
        """
        
        webView.evaluateJavaScript(testScript) { result, error in
            if let error = error {
                print("❌ [TEST] 테스트 햅틱 실패: \(error)")
            } else {
                print("✅ [TEST] 테스트 햅틱 결과: \(result ?? "unknown")")
            }
        }
    }
    
    // MARK: - 🛠️ WebView 설정 (최적화된)
    private func setupWebView() {
        let config = createOptimizedWebViewConfiguration()
        webView = WKWebView(frame: view.bounds, configuration: config)
        
        // Delegates 설정
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        // 🔍 웹 인스펙터 활성화 (Safari 개발자 도구 연결용)
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
            print("🔍 [WebView] 웹 인스펙터 활성화됨 (iOS 16.4+)")
        }
        
        // iOS WebView 최적화 설정
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true
        
        // 성능 최적화
        webView.configuration.suppressesIncrementalRendering = false
        webView.configuration.allowsAirPlayForMediaPlayback = true
        
        // 메모리 관리
        webView.configuration.processPool = WKProcessPool()
        
        // Custom User Agent
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        
        // Auto Layout 설정
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        print("🛠️ [WebView] 설정 완료")
        print("🔍 [WebView] Safari 개발자 도구 연결 가능 - Safari > 개발 > [기기명] > [앱명]")
    }
    
    private func createOptimizedWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        
        // JavaScript 및 미디어 설정
        config.preferences.javaScriptEnabled = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // 🔍 개발자 도구 활성화 (Safari 웹 인스펙터 연결용)
        #if DEBUG
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.preferences.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        print("🔍 [WebView] 개발자 도구 활성화됨 (DEBUG 모드)")
        #endif
        
        // 🔐 App-Bound Domain 관련 설정 (iOS 14+) - 햅틱 동작을 위해 비활성화
        if #available(iOS 14.0, *) {
            config.limitsNavigationsToAppBoundDomains = true
            print("🔐 [WebView] App-Bound Domain 제한 활성화")
            print("🔐 [WebView] 허용된 도메인: nextstep.smap.site, smap.site, localhost")
            print("🔐 [WebView] Info.plist WKAppBoundDomains 설정 적용됨")
        }
        
        // 데이터 감지 설정
        config.dataDetectorTypes = [.phoneNumber, .link]
        
        // WebKit 기능 설정
        config.allowsAirPlayForMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        
        // 메시지 핸들러 등록
        setupMessageHandlers(config: config)
        
        // WebView에 JavaScript 주입 (iOS WebView 최적화 스크립트)
        injectIOSOptimizationScript(config: config)
        
        print("⚙️ [WebView] 설정 생성 완료")
        return config
    }
    
    private func setupMessageHandlers(config: WKWebViewConfiguration) {
        let userContentController = WKUserContentController()
        
        // 메인 메시지 핸들러
        userContentController.add(self, name: "smapIos")
        
        // 햅틱을 위한 추가 핸들러들 (여러 이름으로 등록)
        let hapticHandlerNames = ["iosHandler", "jsToNative", "webViewHandler", "nativeHandler", "hapticHandler", "messageHandler"]
        for handlerName in hapticHandlerNames {
            userContentController.add(self, name: handlerName)
            print("🎮 [HAPTIC-HANDLER] 등록: \(handlerName)")
        }
        
        // 디버깅 및 진단용 핸들러
        userContentController.add(self, name: "iosDebug")
        userContentController.add(self, name: "navigationDebug")
        userContentController.add(self, name: "performanceDebug")
        userContentController.add(self, name: "consoleLog")
        print("🔍 [DEBUG] 콘솔 로그 핸들러 등록됨")
        
        // 강제 햅틱 이벤트 리스너 스크립트 추가
        let hapticEventScript = """
        (function() {
            'use strict';
            console.log('🔧 [SMAP-HAPTIC] 햅틱 시스템 초기화 시작');
            
            // App-Bound Domain 호환 햅틱 시스템
            window.SMAP_HAPTIC_SYSTEM = {
                initialized: false,
                handlers: [],
                pendingMessages: [],
                
                // 초기화 함수
                init: function() {
                    if (this.initialized) return;
                    
                    try {
                        // WebKit 핸들러 확인
                        if (!window.webkit || !window.webkit.messageHandlers) {
                            console.warn('⚠️ [SMAP-HAPTIC] WebKit messageHandlers 없음');
                            return false;
                        }
                        
                        // 사용 가능한 핸들러 검색
                        const handlerNames = ['smapIos', 'iosHandler', 'hapticHandler', 'messageHandler'];
                        for (const name of handlerNames) {
                            if (window.webkit.messageHandlers[name]) {
                                this.handlers.push(name);
                                console.log('✅ [SMAP-HAPTIC] 핸들러 발견:', name);
                            }
                        }
                        
                        if (this.handlers.length === 0) {
                            console.error('❌ [SMAP-HAPTIC] 사용 가능한 핸들러 없음');
                            return false;
                        }
                        
                        this.initialized = true;
                        console.log('✅ [SMAP-HAPTIC] 시스템 초기화 완료');
                        
                        // 대기 중인 메시지 처리
                        this.processPendingMessages();
                        return true;
                        
                    } catch (error) {
                        console.error('❌ [SMAP-HAPTIC] 초기화 오류:', error);
                        return false;
                    }
                },
                
                // 안전한 메시지 전송
                sendMessage: function(message) {
                    if (!this.initialized) {
                        console.log('📤 [SMAP-HAPTIC] 시스템 미초기화, 메시지 대기열 추가');
                        this.pendingMessages.push(message);
                        return false;
                    }
                    
                    let success = false;
                    for (const handlerName of this.handlers) {
                        try {
                            window.webkit.messageHandlers[handlerName].postMessage(message);
                            console.log('✅ [SMAP-HAPTIC] 메시지 전송 성공:', handlerName);
                            success = true;
                            break;
                        } catch (error) {
                            console.warn('⚠️ [SMAP-HAPTIC] 핸들러 실패:', handlerName, error);
                        }
                    }
                    
                    if (!success) {
                        console.error('❌ [SMAP-HAPTIC] 모든 핸들러 실패');
                    }
                    
                    return success;
                },
                
                // 대기 메시지 처리
                processPendingMessages: function() {
                    console.log('📦 [SMAP-HAPTIC] 대기 메시지 처리:', this.pendingMessages.length);
                    while (this.pendingMessages.length > 0) {
                        const message = this.pendingMessages.shift();
                        this.sendMessage(message);
                    }
                }
            };
            
            // 햅틱 함수들 등록
            window.SMAP_HAPTIC = function(type, intensity = 1.0) {
                return window.SMAP_HAPTIC_SYSTEM.sendMessage({
                    type: 'haptic',
                    param: type,
                    intensity: intensity,
                    timestamp: Date.now()
                });
            };
            
            window.SMAP_HAPTIC_FEEDBACK = function(feedbackType, style = 'medium') {
                return window.SMAP_HAPTIC_SYSTEM.sendMessage({
                    type: 'hapticFeedback',
                    param: {
                        type: feedbackType,
                        style: style,
                        timestamp: Date.now()
                    }
                });
            };
            
            // 커스텀 이벤트 리스너
            window.addEventListener('smap-haptic', function(event) {
                console.log('🎯 [SMAP-HAPTIC] 커스텀 이벤트 수신:', event.detail);
                if (event.detail && event.detail.message) {
                    window.SMAP_HAPTIC_SYSTEM.sendMessage(event.detail.message);
                }
            });
            
            // DOM 로드 완료 시 초기화
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    setTimeout(() => window.SMAP_HAPTIC_SYSTEM.init(), 100);
                });
            } else {
                setTimeout(() => window.SMAP_HAPTIC_SYSTEM.init(), 100);
            }
            
            // 디버깅 함수들
            window.SMAP_DEBUG_HAPTIC = function() {
                console.log('🔍 [SMAP-HAPTIC] 디버그 정보:');
                console.log('  - 초기화됨:', window.SMAP_HAPTIC_SYSTEM.initialized);
                console.log('  - 핸들러들:', window.SMAP_HAPTIC_SYSTEM.handlers);
                console.log('  - 대기 메시지:', window.SMAP_HAPTIC_SYSTEM.pendingMessages.length);
                
                // 테스트 햅틱 실행
                console.log('🧪 [SMAP-HAPTIC] 테스트 햅틱 실행');
                return window.SMAP_HAPTIC('success');
            };
            
            console.log('✅ [SMAP-HAPTIC] 스크립트 등록 완료');
        })();
        """
        
        let hapticUserScript = WKUserScript(source: hapticEventScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        userContentController.addUserScript(hapticUserScript)
        
        // 추가: Document End에서도 한 번 더 주입하여 확실하게 등록
        let hapticUserScriptEnd = WKUserScript(source: hapticEventScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        userContentController.addUserScript(hapticUserScriptEnd)
        
        config.userContentController = userContentController
        
        print("📬 [WebView] 메시지 핸들러 등록 완료")
    }
    
    private func injectIOSOptimizationScript(config: WKWebViewConfiguration) {
        let script = """
        // iOS WebView 최적화 스크립트
        (function() {
            'use strict';
            
            // 🔍 콘솔 로그 캡처 및 Safari 개발자 도구 연동
            (function setupConsoleCapture() {
                const originalConsole = {
                    log: console.log,
                    warn: console.warn,
                    error: console.error,
                    info: console.info,
                    debug: console.debug
                };
                
                function createConsoleWrapper(type, originalMethod) {
                    return function(...args) {
                        // 원본 콘솔 메서드 호출 (Safari 개발자 도구에서 볼 수 있음)
                        originalMethod.apply(console, args);
                        
                        // iOS 네이티브로도 전달 (선택적)
                        try {
                            if (window.webkit?.messageHandlers?.consoleLog) {
                                const message = args.map(arg => 
                                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                ).join(' ');
                                
                                window.webkit.messageHandlers.consoleLog.postMessage({
                                    type: type,
                                    message: message,
                                    timestamp: new Date().toISOString(),
                                    url: window.location.href
                                });
                            }
                        } catch (e) {
                            // 네이티브 전달 실패는 무시
                        }
                    };
                }
                
                // 모든 콘솔 메서드 래핑
                console.log = createConsoleWrapper('log', originalConsole.log);
                console.warn = createConsoleWrapper('warn', originalConsole.warn);
                console.error = createConsoleWrapper('error', originalConsole.error);
                console.info = createConsoleWrapper('info', originalConsole.info);
                console.debug = createConsoleWrapper('debug', originalConsole.debug);
                
                console.log('🔍 [SMAP-iOS] 콘솔 로그 캡처 활성화됨 - Safari 개발자 도구에서 확인 가능');
            })();
            
            // 🚨 전역 에러 캐처 (Safari 개발자 도구에서 에러 확인용)
            window.addEventListener('error', function(event) {
                console.error('🚨 [GLOBAL-ERROR]', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error ? event.error.stack : 'No stack trace'
                });
            });
            
            window.addEventListener('unhandledrejection', function(event) {
                console.error('🚨 [UNHANDLED-PROMISE]', {
                    reason: event.reason,
                    promise: 'Promise rejection not handled'
                });
            });
            
            console.log('SMAP iOS WebView 최적화 스크립트 시작');
            
            // 1. iOS WebView 감지 및 환경 설정
            window.SMAP_IOS_WEBVIEW = true;
            window.SMAP_DEVICE_INFO = {
                platform: 'iOS',
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            };
            
            // 2. 네트워크 요청 최적화
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
                const startTime = Date.now();
                
                const optimizedOptions = {
                    ...options,
                    cache: 'default',
                    credentials: 'same-origin',
                    headers: {
                        'X-Requested-With': 'SMAP-iOS-WebView',
                        ...options.headers
                    }
                };
                
                return originalFetch(url, optimizedOptions)
                    .then(response => {
                        const duration = Date.now() - startTime;
                        console.log(`[SMAP-iOS] Fetch 완료: ${url} (${duration}ms)`);
                        
                        // 성능 정보 iOS 앱에 전달
                        if (window.webkit?.messageHandlers?.performanceDebug) {
                            window.webkit.messageHandlers.performanceDebug.postMessage({
                                type: 'fetchComplete',
                                url: url,
                                duration: duration,
                                status: response.status
                            });
                        }
                        
                        return response;
                    })
                    .catch(error => {
                        const duration = Date.now() - startTime;
                        console.error(`[SMAP-iOS] Fetch 에러: ${url} (${duration}ms)`, error);
                        
                        // 에러 정보 iOS 앱에 전달
                        if (window.webkit?.messageHandlers?.iosDebug) {
                            window.webkit.messageHandlers.iosDebug.postMessage({
                                type: 'fetchError',
                                url: url,
                                duration: duration,
                                error: error.message
                            });
                        }
                        
                        throw error;
                    });
            };
            
            // 3. 페이지 전환 감지 및 최적화
            let currentPath = window.location.pathname;
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            function handleRouteChange(newPath) {
                if (newPath !== currentPath) {
                    currentPath = newPath;
                    console.log(`[SMAP-iOS] 경로 변경: ${newPath}`);
                    
                    // 경로 변경 정보 iOS 앱에 전달
                    if (window.webkit?.messageHandlers?.navigationDebug) {
                        window.webkit.messageHandlers.navigationDebug.postMessage({
                            type: 'routeChange',
                            from: currentPath,
                            to: newPath,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
            history.pushState = function(...args) {
                originalPushState.apply(history, args);
                handleRouteChange(window.location.pathname);
            };
            
            history.replaceState = function(...args) {
                originalReplaceState.apply(history, args);
                handleRouteChange(window.location.pathname);
            };
            
            window.addEventListener('popstate', () => {
                handleRouteChange(window.location.pathname);
            });
            
            // 4. 데이터 로딩 상태 모니터링
            let pendingRequests = 0;
            const originalXMLHttpRequest = XMLHttpRequest;
            
            function XMLHttpRequestProxy() {
                const xhr = new originalXMLHttpRequest();
                
                xhr.addEventListener('loadstart', () => {
                    pendingRequests++;
                    updateLoadingState();
                });
                
                xhr.addEventListener('loadend', () => {
                    pendingRequests--;
                    updateLoadingState();
                });
                
                return xhr;
            }
            
            Object.setPrototypeOf(XMLHttpRequestProxy.prototype, originalXMLHttpRequest.prototype);
            Object.setPrototypeOf(XMLHttpRequestProxy, originalXMLHttpRequest);
            window.XMLHttpRequest = XMLHttpRequestProxy;
            
            function updateLoadingState() {
                if (window.webkit?.messageHandlers?.performanceDebug) {
                    window.webkit.messageHandlers.performanceDebug.postMessage({
                        type: 'loadingState',
                        pendingRequests: pendingRequests,
                        isLoading: pendingRequests > 0
                    });
                }
            }
            
            // 5. 메모리 관리 최적화
            window.addEventListener('pagehide', () => {
                console.log('[SMAP-iOS] 페이지 숨김, 리소스 정리');
                
                // 타이머 정리
                const highestTimeoutId = setTimeout(() => {}, 0);
                for (let i = 0; i < highestTimeoutId; i++) {
                    clearTimeout(i);
                }
                
                const highestIntervalId = setInterval(() => {}, 999999999);
                for (let i = 0; i < highestIntervalId; i++) {
                    clearInterval(i);
                }
            });
            
            // 6. 에러 처리 및 로깅
            window.addEventListener('error', (event) => {
                console.error('[SMAP-iOS] JavaScript 에러:', event.error);
                
                if (window.webkit?.messageHandlers?.iosDebug) {
                    window.webkit.messageHandlers.iosDebug.postMessage({
                        type: 'jsError',
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        stack: event.error?.stack
                    });
                }
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                console.error('[SMAP-iOS] Promise 거부:', event.reason);
                
                if (window.webkit?.messageHandlers?.iosDebug) {
                    window.webkit.messageHandlers.iosDebug.postMessage({
                        type: 'promiseRejection',
                        reason: String(event.reason)
                    });
                }
            });
            
            // 7. 페이지 로드 완료 알림
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    notifyPageReady('DOMContentLoaded');
                });
            } else {
                notifyPageReady('already-loaded');
            }
            
            window.addEventListener('load', () => {
                notifyPageReady('load');
            });
            
            function notifyPageReady(event) {
                console.log(`[SMAP-iOS] 페이지 준비: ${event}`);
                
                if (window.webkit?.messageHandlers?.navigationDebug) {
                    window.webkit.messageHandlers.navigationDebug.postMessage({
                        type: 'pageReady',
                        event: event,
                        url: window.location.href,
                        timestamp: Date.now()
                    });
                }
            }
            
            console.log('[SMAP-iOS] 최적화 스크립트 초기화 완료');
        })();
        """
        
        let userScript = WKUserScript(
            source: script,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        
        config.userContentController.addUserScript(userScript)
        print("📝 [WebView] iOS 최적화 스크립트 주입 완료")
    }
    
    // MARK: - 🎨 UI 설정
    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground
        
        // 프로그래스 바 설정
        progressView = UIProgressView(progressViewStyle: .default)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor.systemBlue
        progressView.trackTintColor = UIColor.systemGray5
        view.addSubview(progressView)
        
        // 로딩 인디케이터 설정
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.color = UIColor.systemBlue
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
        
        // Auto Layout 설정
        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 3),
            
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        // WebView의 로딩 진행률 관찰
        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress), options: .new, context: nil)
        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.isLoading), options: .new, context: nil)
        
        print("🎨 [UI] 사용자 인터페이스 설정 완료")
    }
    
    // MARK: - 🌐 웹사이트 로드
    private func loadWebsite() {
        guard let url = URL(string: targetURL) else {
            showErrorAlert(title: "URL 에러", message: "유효하지 않은 URL입니다: \(targetURL)")
            return
        }
        
        pageLoadStartTime = Date()
        
        var request = URLRequest(url: url)
        request.cachePolicy = cachePolicy
        request.timeoutInterval = requestTimeout
        
        // iOS WebView 식별을 위한 헤더 추가
        request.setValue("SMAP-iOS-WebView/1.0", forHTTPHeaderField: "X-Requested-With")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        
        print("🌐 [WebView] 웹사이트 로드 시작: \(targetURL)")
        os_log("🌐 [Navigation] 로드 시작: %{public}@", log: Self.navigationLog, type: .info, targetURL)
        
        webView.load(request)
    }
    
    // MARK: - 📊 성능 모니터링
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == #keyPath(WKWebView.estimatedProgress) {
            let progress = Float(webView.estimatedProgress)
            progressView.setProgress(progress, animated: true)
            
            if progress == 1.0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.progressView.isHidden = true
                }
            } else {
                progressView.isHidden = false
            }
        } else if keyPath == #keyPath(WKWebView.isLoading) {
            if webView.isLoading {
                activityIndicator.startAnimating()
            } else {
                activityIndicator.stopAnimating()
            }
        }
    }
    
    // MARK: - 🚨 에러 처리
    private func showErrorAlert(title: String, message: String) {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            
            alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in
                self.retryLoad()
            })
            
            alert.addAction(UIAlertAction(title: "확인", style: .cancel))
            
            self.present(alert, animated: true)
        }
    }
    
    private func retryLoad() {
        guard retryCount < maxRetryCount else {
            showErrorAlert(title: "연결 실패", message: "최대 재시도 횟수를 초과했습니다. 네트워크 연결을 확인해주세요.")
            return
        }
        
        retryCount += 1
        print("🔄 [WebView] 재시도 \(retryCount)/\(maxRetryCount)")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.loadWebsite()
        }
    }
    
    // MARK: - 🧹 메모리 관리
    deinit {
        webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress))
        webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.isLoading))
        networkMonitor?.cancel()
        
        // 메시지 핸들러 정리
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "smapIos")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "iosDebug")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "navigationDebug")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "performanceDebug")
        
        print("🧹 [WebView] 리소스 정리 완료")
    }
}

// MARK: - 📬 WKScriptMessageHandler
extension EnhancedWebViewController: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let messageStartTime = Date()
        
        print("📬 [Message] 수신: \(message.name)")
        
        switch message.name {
        case "smapIos":
            handleSmapIOSMessage(message)
        case "iosDebug":
            handleDebugMessage(message)
        case "navigationDebug":
            handleNavigationMessage(message)
        case "performanceDebug":
            handlePerformanceMessage(message)
        case "consoleLog":
            handleConsoleLog(message)
        default:
            print("⚠️ [Message] 알 수 없는 메시지: \(message.name)")
        }
        
        let processingTime = Date().timeIntervalSince(messageStartTime) * 1000
        os_log("📬 [Message] 처리 완료: %{public}@ (%.2fms)", 
               log: Self.performanceLog, type: .info, message.name, processingTime)
    }
    
    private func handleSmapIOSMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        
        print("📨 [MessageHandler] 메시지 수신: smapIos")
        print("📦 [MessageHandler] 메시지 내용: \(body)")
        
        let type = body["type"] as? String ?? ""
        let param = body["param"]
        
        switch type {
        case "hapticFeedback", "haptic":
            handleHapticFeedback(param: param)
        case "jsLog":
            handleJavaScriptLog(param: param)
        case "googleSignIn":
            handleGoogleSignIn()
        case "kakaoLogin":
            print("🚨🚨🚨 [KAKAO LOGIN] 카카오 로그인 요청 수신!")
            handleKakaoLogin()
        case "requestLocationPermission":
            print("📍 [LOCATION] 위치 권한 요청 수신!")
            handleLocationPermissionRequest(param: param)
        case "startLocationTracking":
            print("📍 [LOCATION] 지속적 위치 추적 시작 요청!")
            handleStartLocationTracking(param: param)
        case "stopLocationTracking":
            print("📍 [LOCATION] 지속적 위치 추적 중지 요청!")
            handleStopLocationTracking(param: param)
        case "openSettings":
            print("⚙️ [SETTINGS] 설정 열기 요청!")
            handleOpenSettings()
        default:
            print("⚠️ [SMAP-iOS] 알 수 없는 타입: \(type)")
        }
    }
    
    private func handleDebugMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        
        switch type {
        case "fetchError":
            let url = body["url"] as? String ?? "unknown"
            let error = body["error"] as? String ?? "unknown"
            print("🚨 [Debug] Fetch 에러: \(url) - \(error)")
            
        case "jsError":
            let message = body["message"] as? String ?? "unknown"
            let filename = body["filename"] as? String ?? "unknown"
            print("🚨 [Debug] JS 에러: \(message) in \(filename)")
            
        case "promiseRejection":
            let reason = body["reason"] as? String ?? "unknown"
            print("🚨 [Debug] Promise 거부: \(reason)")
            
        default:
            print("🔍 [Debug] 디버그 메시지: \(type)")
        }
    }
    
    private func handleNavigationMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        
        switch type {
        case "routeChange":
            let to = body["to"] as? String ?? "unknown"
            print("🧭 [Navigation] 경로 변경: \(to)")
            
        case "pageReady":
            let event = body["event"] as? String ?? "unknown"
            let url = body["url"] as? String ?? "unknown"
            print("✅ [Navigation] 페이지 준비: \(event) - \(url)")
            
            // 페이지 로드 완료 시 성능 측정
            if let startTime = pageLoadStartTime {
                let loadTime = Date().timeIntervalSince(startTime) * 1000
                print("⚡ [Performance] 페이지 로드 시간: \(String(format: "%.0f", loadTime))ms")
                os_log("⚡ [Performance] 페이지 로드: %.0fms", log: Self.performanceLog, type: .info, loadTime)
                
                // 성공 시 재시도 카운트 리셋
                retryCount = 0
            }
            
        default:
            print("🧭 [Navigation] 내비게이션 메시지: \(type)")
        }
    }
    
    private func handlePerformanceMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        
        switch type {
        case "fetchComplete":
            let url = body["url"] as? String ?? "unknown"
            let duration = body["duration"] as? Double ?? 0
            let status = body["status"] as? Int ?? 0
            print("⚡ [Performance] Fetch 완료: \(url) (\(Int(duration))ms, \(status))")
            
        case "loadingState":
            let isLoading = body["isLoading"] as? Bool ?? false
            let pendingRequests = body["pendingRequests"] as? Int ?? 0
            print("⚡ [Performance] 로딩 상태: \(isLoading ? "진행중" : "완료") (\(pendingRequests)개 요청)")
            
        default:
            print("⚡ [Performance] 성능 메시지: \(type)")
        }
    }
    
    // 🔍 콘솔 로그 처리 함수
    private func handleConsoleLog(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        
        let type = body["type"] as? String ?? "log"
        let logMessage = body["message"] as? String ?? ""
        let timestamp = body["timestamp"] as? String ?? ""
        let url = body["url"] as? String ?? ""
        
        // 네이티브 콘솔에도 출력 (중복 방지를 위해 선택적)
        let formattedMessage = "🌐 [WEB-\(type.uppercased())] \(logMessage)"
        
        switch type {
        case "error":
            print("❌ \(formattedMessage)")
        case "warn":
            print("⚠️ \(formattedMessage)")
        case "info":
            print("ℹ️ \(formattedMessage)")
        case "debug":
            print("🔍 \(formattedMessage)")
        default:
            print("📝 \(formattedMessage)")
        }
        
        // 디버그 모드에서는 자세한 정보 출력
        #if DEBUG
        if !timestamp.isEmpty || !url.isEmpty {
            print("    📍 Time: \(timestamp), URL: \(url)")
        }
        #endif
    }
    
    // 강화된 햅틱 피드백 처리
    private func handleHapticFeedback(param: Any?) {
        print("🎮 [Haptic] 햅틱 피드백 요청 - param type: \(type(of: param))")
        print("🎮 [Haptic] 햅틱 피드백 요청 - param value: \(String(describing: param))")
        
        var hapticType = "medium" // 기본값
        
        // 다양한 형식 지원
        if let paramString = param as? String {
            // 직접 문자열인 경우 (예: "light", "success")
            if paramString.contains("{") {
                // JSON 문자열인 경우
                if let data = paramString.data(using: .utf8),
                   let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                    hapticType = hapticData["feedbackType"] as? String ?? "medium"
                    print("🎮 [Haptic] JSON 형식에서 추출: \(hapticType)")
                } else {
                    print("🎮 [Haptic] JSON 파싱 실패, 기본값 사용: \(hapticType)")
                }
            } else {
                // 단순 문자열
                hapticType = paramString
                print("🎮 [Haptic] 직접 문자열 사용: \(hapticType)")
            }
        } else if let paramDict = param as? [String: Any] {
            // 딕셔너리 형태인 경우
            hapticType = paramDict["feedbackType"] as? String ?? 
                        paramDict["type"] as? String ?? 
                        paramDict["param"] as? String ?? "medium"
            print("🎮 [Haptic] 딕셔너리에서 추출: \(hapticType)")
        } else {
            print("⚠️ [Haptic] 알 수 없는 파라미터 형식, 기본값 사용: \(hapticType)")
        }
        
        // 햅틱 실행
        executeHaptic(type: hapticType)
        
        // 웹으로 확인 메시지 전송
        sendConfirmationToWeb(hapticType: hapticType)
    }
    
    private func executeHaptic(type: String) {
        DispatchQueue.main.async {
            let hapticType = type.lowercased()
            print("🎯 [Haptic] 햅틱 실행 시작: \(hapticType)")
            
            switch hapticType {
            case "light", "selection":
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.prepare() // 미리 준비하여 지연 시간 최소화
                generator.impactOccurred()
                print("✨ [Haptic] LIGHT 햅틱 실행 완료")
                
            case "medium":
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
                print("✨ [Haptic] MEDIUM 햅틱 실행 완료")
                
            case "heavy":
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.prepare()
                generator.impactOccurred()
                print("✨ [Haptic] HEAVY 햅틱 실행 완료")
                
            case "success":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.success)
                print("✨ [Haptic] SUCCESS 알림 햅틱 실행 완료")
                
            case "warning":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.warning)
                print("✨ [Haptic] WARNING 알림 햅틱 실행 완료")
                
            case "error":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.error)
                print("✨ [Haptic] ERROR 알림 햅틱 실행 완료")
                
            default:
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
                print("✨ [Haptic] DEFAULT (medium) 햅틱 실행 완료 - 입력값: \(type)")
            }
            
            // 햅틱 실행 로그를 시스템 로그에도 기록
            os_log("✨ [Haptic] 햅틱 실행: %{public}@", log: Self.debugLog, type: .info, hapticType)
        }
    }
    
    // 웹으로 햅틱 실행 확인 메시지 전송
    private func sendConfirmationToWeb(hapticType: String) {
        DispatchQueue.main.async {
            let confirmationScript = """
                if (window.console && window.console.log) {
                    console.log('🎉 [iOS-NATIVE] 햅틱 실행 확인: \(hapticType)');
                }
                if (window.SMAP_HAPTIC_CONFIRMATION) {
                    window.SMAP_HAPTIC_CONFIRMATION('\(hapticType)');
                }
            """
            
            self.webView?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("⚠️ [Haptic] 웹 확인 메시지 전송 실패: \(error)")
                } else {
                    print("✅ [Haptic] 웹 확인 메시지 전송 완료: \(hapticType)")
                }
            }
        }
    }
    
    private func handleJavaScriptLog(param: Any?) {
        // JavaScript 로그 처리 (기존과 동일)
        print("📝 [JS Log] JavaScript 로그 수신")
    }
    
    private func handleGoogleSignIn() {
        print("🔐 [Auth] Google Sign-In 요청")
        // Google Sign-In 처리 로직
    }
    
    private func handleKakaoLogin() {
        print("🔥🔥🔥 [KAKAO LOGIN] 카카오 로그인 함수 시작!")
        
        // Heavy 햅틱 테스트 실행
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.prepare()
        generator.impactOccurred()
        print("🎮 [KAKAO LOGIN] Heavy 햅틱 실행 완료")
        
        DispatchQueue.main.async {
            print("🚀 [KAKAO LOGIN] 카카오 로그인 처리 시작")
            
            // 웹으로 카카오 로그인 결과 전송
            let resultScript = """
                if (window.kakaoLoginCallback) {
                    console.log('🔥 [iOS-NATIVE] 카카오 로그인 콜백 실행 중...');
                    window.kakaoLoginCallback({
                        success: true,
                        message: 'iOS에서 카카오 로그인 처리 완료',
                        source: 'ios-native'
                    });
                } else {
                    console.log('⚠️ [iOS-NATIVE] kakaoLoginCallback 함수를 찾을 수 없습니다');
                }
            """
            
            self.webView?.evaluateJavaScript(resultScript) { result, error in
                if let error = error {
                    print("❌ [KAKAO LOGIN] 웹 콜백 실행 실패: \(error)")
                } else {
                    print("✅ [KAKAO LOGIN] 웹 콜백 실행 완료")
                }
            }
        }
    }
    
    // MARK: - 📍 위치 권한 처리
    private func handleLocationPermissionRequest(param: Any?) {
        print("📍 [LOCATION] 위치 권한 요청 처리 시작")
        
        // 자동 위치 권한 요청 차단 (사용자가 명시적으로 요청한 경우만 허용)
        if let paramDict = param as? [String: Any],
           let source = paramDict["source"] as? String {
            print("📍 [LOCATION] 요청 소스: \(source)")
            
            // 자동 요청인 경우 차단
            if source == "auto" || source == "page_load" || source == "register_location" {
                print("🚫 [LOCATION] 자동 위치 권한 요청 차단됨")
                sendLocationPermissionResult(success: false, error: "사용자 동의 없이 자동으로 위치 권한을 요청할 수 없습니다.")
                return
            }
        }
        
        // 위치 서비스 활성화 상태 먼저 확인
        guard CLLocationManager.locationServicesEnabled() else {
            print("❌ [LOCATION] 위치 서비스가 비활성화됨")
            sendLocationPermissionResult(success: false, error: "위치 서비스가 비활성화되어 있습니다. 설정에서 위치 서비스를 활성화해주세요.")
            return
        }
        
        // 위치 권한 상태 확인
        let locationManager = CLLocationManager()
        let authorizationStatus = locationManager.authorizationStatus
        
        print("📍 [LOCATION] 현재 권한 상태: \(authorizationStatus.rawValue)")
        
        switch authorizationStatus {
        case .notDetermined:
            // 권한 요청
            print("📍 [LOCATION] 권한 미결정 - 권한 요청")
            requestLocationPermission()
        case .denied, .restricted:
            // 권한 거부됨 - 설정 안내만 하고 팝업은 한 번만
            print("❌ [LOCATION] 권한 거부됨 - 설정으로 이동 필요")
            showLocationPermissionAlert()
        case .authorizedWhenInUse, .authorizedAlways:
            // 권한 있음 - 바로 위치 정보 가져오기 (팝업 없음)
            print("✅ [LOCATION] 권한 있음 - 위치 정보 가져오기")
            getCurrentLocation()
        @unknown default:
            // 알 수 없는 상태 - 로그만 남기고 에러 처리
            print("❓ [LOCATION] 알 수 없는 권한 상태")
            sendLocationPermissionResult(success: false, error: "알 수 없는 위치 권한 상태입니다.")
        }
    }
    
    private func handleStartLocationTracking(param: Any?) {
        print("📍 [LOCATION] 지속적 위치 추적 시작 요청")
        
        // 위치 서비스 활성화 상태 확인
        guard CLLocationManager.locationServicesEnabled() else {
            print("❌ [LOCATION] 위치 서비스가 비활성화됨")
            return
        }
        
        // 위치 권한 상태 확인
        let locationManager = CLLocationManager()
        let authorizationStatus = locationManager.authorizationStatus
        
        switch authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ [LOCATION] 권한 있음 - 지속적 위치 추적 시작")
            startContinuousLocationTracking()
        case .denied, .restricted:
            print("❌ [LOCATION] 권한 거부됨 - 지속적 위치 추적 불가")
        case .notDetermined:
            print("⏳ [LOCATION] 권한 미결정 - 권한 요청 후 추적 시작")
            requestLocationPermission()
        @unknown default:
            print("❓ [LOCATION] 알 수 없는 권한 상태")
        }
    }
    
    private func handleStopLocationTracking(param: Any?) {
        print("📍 [LOCATION] 지속적 위치 추적 중지 요청")
        stopContinuousLocationTracking()
    }
    }
    
    private func requestLocationPermission() {
        print("📍 [LOCATION] 위치 권한 요청 시작")
        
        let locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestWhenInUseAuthorization()
        
        // 위치 매니저를 유지하기 위해 프로퍼티로 저장
        self.locationManager = locationManager
    }
    
    private func getCurrentLocation() {
        print("📍 [LOCATION] 현재 위치 가져오기 시작")
        
        let locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestLocation()
        
        // 위치 매니저를 유지하기 위해 프로퍼티로 저장
        self.locationManager = locationManager
    }
    
    private func startContinuousLocationTracking() {
        print("📍 [LOCATION] 지속적 위치 추적 시작")
        
        let locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10 // 10미터마다 업데이트
        locationManager.startUpdatingLocation()
        
        // 위치 매니저를 유지하기 위해 프로퍼티로 저장
        self.locationManager = locationManager
        
        print("✅ [LOCATION] 지속적 위치 추적 활성화됨")
    }
    
    private func stopContinuousLocationTracking() {
        print("📍 [LOCATION] 지속적 위치 추적 중지")
        
        locationManager?.stopUpdatingLocation()
        locationManager = nil
        
        print("✅ [LOCATION] 지속적 위치 추적 중지됨")
    }
    
    private func showLocationPermissionAlert() {
        print("📍 [LOCATION] 위치 권한 알림 표시")
        
        // 이미 팝업이 표시 중인지 확인 (중복 방지)
        if self.presentedViewController is UIAlertController {
            print("⚠️ [LOCATION] 이미 팝업이 표시 중 - 중복 방지")
            return
        }
        
        DispatchQueue.main.async {
            let alert = UIAlertController(
                title: "위치 권한 요청",
                message: "서비스 이용을 위해 위치 권한이 필요합니다. 설정에서 위치 권한을 허용해주세요.",
                preferredStyle: .alert
            )
            
            alert.addAction(UIAlertAction(
                title: "설정으로 이동",
                style: .default
            ) { _ in
                self.openAppSettings()
            })
            
            alert.addAction(UIAlertAction(
                title: "취소",
                style: .cancel
            ) { _ in
                self.sendLocationPermissionResult(success: false, error: "사용자가 권한 요청을 취소했습니다.")
            })
            
            self.present(alert, animated: true)
        }
    }
    
    private func handleOpenSettings() {
        print("⚙️ [SETTINGS] 앱 설정 열기")
        openAppSettings()
    }
    
    private func openAppSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            if UIApplication.shared.canOpenURL(settingsUrl) {
                UIApplication.shared.open(settingsUrl)
                print("✅ [SETTINGS] 앱 설정 열기 성공")
            } else {
                print("❌ [SETTINGS] 앱 설정 열기 실패")
            }
        }
    }
    
    private func sendLocationPermissionResult(success: Bool, latitude: Double? = nil, longitude: Double? = nil, error: String? = nil) {
        print("📍 [LOCATION] 웹으로 결과 전송: success=\(success)")
        
        let resultScript: String
        if success, let lat = latitude, let lng = longitude {
            resultScript = """
                if (window.onLocationPermissionGranted) {
                    console.log('📍 [iOS-NATIVE] 위치 권한 허용 콜백 실행');
                    window.onLocationPermissionGranted({
                        latitude: \(lat),
                        longitude: \(lng),
                        accuracy: 10.0,
                        timestamp: Date.now(),
                        source: 'ios-native'
                    });
                } else {
                    console.log('⚠️ [iOS-NATIVE] onLocationPermissionGranted 함수를 찾을 수 없습니다');
                }
            """
        } else {
            resultScript = """
                if (window.onLocationPermissionDenied) {
                    console.log('📍 [iOS-NATIVE] 위치 권한 거부 콜백 실행');
                    window.onLocationPermissionDenied({
                        error: '\(error ?? "알 수 없는 오류")',
                        source: 'ios-native'
                    });
                } else {
                    console.log('⚠️ [iOS-NATIVE] onLocationPermissionDenied 함수를 찾을 수 없습니다');
                }
            """
        }
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(resultScript) { result, error in
                if let error = error {
                    print("❌ [LOCATION] 웹 콜백 실행 실패: \(error)")
                } else {
                    print("✅ [LOCATION] 웹 콜백 실행 완료")
                }
            }
        }
    }
    
    private func sendLocationUpdateToWeb(latitude: Double, longitude: Double, accuracy: Double, speed: Double, altitude: Double, timestamp: Date) {
        print("📍 [LOCATION] 지속적 위치 업데이트 웹으로 전송")
        
        let timestampMs = Int(timestamp.timeIntervalSince1970 * 1000)
        let resultScript = """
            if (window.onLocationUpdate) {
                console.log('📍 [iOS-NATIVE] 지속적 위치 업데이트 콜백 실행');
                window.onLocationUpdate({
                    latitude: \(latitude),
                    longitude: \(longitude),
                    accuracy: \(accuracy),
                    speed: \(speed),
                    altitude: \(altitude),
                    timestamp: \(timestampMs),
                    source: 'ios-native-continuous'
                });
            } else {
                console.log('⚠️ [iOS-NATIVE] onLocationUpdate 함수를 찾을 수 없습니다');
            }
        """
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(resultScript) { result, error in
                if let error = error {
                    print("❌ [LOCATION] 지속적 위치 업데이트 웹 콜백 실행 실패: \(error)")
                } else {
                    print("✅ [LOCATION] 지속적 위치 업데이트 웹 콜백 실행 완료")
                }
            }
        }
    }
}

// MARK: - 📍 CLLocationManagerDelegate
extension EnhancedWebViewController: CLLocationManagerDelegate {
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        print("📍 [LOCATION] 권한 상태 변경: \(status.rawValue)")
        
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ [LOCATION] 위치 권한 허용됨")
            // 권한이 허용되면 지속적인 위치 추적 시작
            startContinuousLocationTracking()
        case .denied, .restricted:
            print("❌ [LOCATION] 위치 권한 거부됨")
            sendLocationPermissionResult(success: false, error: "위치 권한이 거부되었습니다")
        case .notDetermined:
            print("⏳ [LOCATION] 위치 권한 결정되지 않음")
        @unknown default:
            print("❓ [LOCATION] 알 수 없는 권한 상태")
            sendLocationPermissionResult(success: false, error: "알 수 없는 권한 상태")
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        print("📍 [LOCATION] GPS 데이터 수신 시작 - 위치 개수: \(locations.count)")
        
        guard let location = locations.last else {
            print("❌ [LOCATION] 위치 정보 없음")
            sendLocationPermissionResult(success: false, error: "위치 정보를 가져올 수 없습니다")
            return
        }
        
        // GPS 데이터 상세 정보 로깅
        print("✅ [LOCATION] GPS 데이터 수신 성공:")
        print("   📍 위도: \(location.coordinate.latitude)")
        print("   📍 경도: \(location.coordinate.longitude)")
        print("   📍 정확도: \(location.horizontalAccuracy)m")
        print("   📍 고도: \(location.altitude)m")
        print("   📍 속도: \(location.speed)m/s")
        print("   📍 시간: \(location.timestamp)")
        print("   📍 신호 품질: \(location.horizontalAccuracy < 10 ? "우수" : location.horizontalAccuracy < 50 ? "양호" : "보통")")
        
        // 지속적인 위치 추적을 위해 위치 매니저를 정리하지 않음
        // locationManager?.stopUpdatingLocation()
        // locationManager = nil
        
        // 웹으로 결과 전송 (지속적 업데이트)
        print("🌐 [LOCATION] 웹뷰로 GPS 데이터 전송 시작")
        sendLocationUpdateToWeb(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            speed: location.speed,
            altitude: location.altitude,
            timestamp: location.timestamp
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [LOCATION] 위치 정보 가져오기 실패: \(error.localizedDescription)")
        
        // 위치 매니저 정리
        locationManager?.stopUpdatingLocation()
        locationManager = nil
        
        // 권한 관련 에러인지 확인
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                // 권한이 거부된 경우에만 설정 안내
                print("❌ [LOCATION] 권한 거부로 인한 실패")
                sendLocationPermissionResult(success: false, error: "위치 권한이 거부되어 위치 정보를 가져올 수 없습니다.")
            case .locationUnknown:
                // 위치를 찾을 수 없는 경우 (GPS 신호 약함 등)
                print("⚠️ [LOCATION] 위치를 찾을 수 없음 (GPS 신호 약함)")
                sendLocationPermissionResult(success: false, error: "현재 위치를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.")
            case .network:
                // 네트워크 에러
                print("⚠️ [LOCATION] 네트워크 에러")
                sendLocationPermissionResult(success: false, error: "네트워크 연결을 확인하고 다시 시도해주세요.")
            default:
                // 기타 에러
                print("⚠️ [LOCATION] 기타 위치 에러: \(clError.localizedDescription)")
                sendLocationPermissionResult(success: false, error: "위치 정보를 가져오는 중 오류가 발생했습니다.")
            }
        } else {
            // CLError가 아닌 다른 에러
            print("⚠️ [LOCATION] 알 수 없는 에러: \(error.localizedDescription)")
            sendLocationPermissionResult(success: false, error: "위치 정보를 가져오는 중 오류가 발생했습니다.")
        }
    }
}

// MARK: - 🧭 WKNavigationDelegate
extension EnhancedWebViewController: WKNavigationDelegate {
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("🧭 [Navigation] 로딩 시작")
        pageLoadStartTime = Date()
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ [Navigation] 로딩 완료: \(webView.url?.absoluteString ?? "unknown")")
        
        if let startTime = pageLoadStartTime {
            let loadTime = Date().timeIntervalSince(startTime) * 1000
            print("⚡ [Performance] 총 로딩 시간: \(String(format: "%.0f", loadTime))ms")
        }
        
        retryCount = 0 // 성공 시 재시도 카운트 리셋
        
        // 페이지 로드 완료 후 App-Bound Domain 상태 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.debugAppBoundDomainStatus()
        }
        
        // Fallback 햅틱 이벤트 리스너 등록
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.setupFallbackHapticSystem()
        }
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("❌ [Navigation] 로딩 실패: \(error.localizedDescription)")
        os_log("❌ [Navigation] 로딩 실패: %{public}@", log: Self.navigationLog, type: .error, error.localizedDescription)
        
        // 네트워크 에러인 경우 자동 재시도
        if isOnline {
            retryLoad()
        } else {
            showErrorAlert(title: "네트워크 오류", message: "인터넷 연결을 확인하고 다시 시도해주세요.")
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("❌ [Navigation] 내비게이션 실패: \(error.localizedDescription)")
        retryLoad()
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        
        print("🧭 [Navigation] 내비게이션 요청: \(url.absoluteString)")
        
        // SMAP 도메인이거나 localhost인 경우에만 허용
        if url.host?.contains("smap.site") == true || 
           url.host?.contains("localhost") == true ||
           url.scheme == "data" {
            decisionHandler(.allow)
        } else {
            print("⚠️ [Navigation] 외부 링크 차단: \(url.absoluteString)")
            decisionHandler(.cancel)
            
            // 외부 링크는 Safari에서 열기
            DispatchQueue.main.async {
                UIApplication.shared.open(url)
            }
        }
    }
}

// MARK: - 🎨 WKUIDelegate
extension EnhancedWebViewController: WKUIDelegate {
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // 새 창 요청을 현재 WebView에서 로드
        if let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "알림", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "확인", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler(true)
        })
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in
            completionHandler(false)
        })
        present(alert, animated: true)
    }
}

/*
📋 사용법:

1. AppDelegate.swift에서:
```swift
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        window = UIWindow(frame: UIScreen.main.bounds)
        let webViewController = EnhancedWebViewController()
        window?.rootViewController = webViewController
        window?.makeKeyAndVisible()
        
        return true
    }
}
```

2. SceneDelegate.swift에서 (iOS 13+):
```swift
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        window = UIWindow(windowScene: windowScene)
        let webViewController = EnhancedWebViewController()
        window?.rootViewController = webViewController
        window?.makeKeyAndVisible()
    }
}
```

🔍 Xcode 콘솔에서 로그 필터링:
- 🌐_Network: 네트워크 관련 로그
- ⚡_Performance: 성능 측정 로그  
- 🧭_Navigation: 내비게이션 로그
- 🔍_Debug: 디버깅 로그

주요 개선사항:
✅ 네트워크 상태 실시간 모니터링
✅ 자동 재시도 메커니즘
✅ JavaScript 성능 최적화
✅ 메모리 관리 개선
✅ 상세한 로깅 및 디버깅
✅ 에러 처리 및 사용자 알림
✅ 페이지 로드 성능 측정
*/ 