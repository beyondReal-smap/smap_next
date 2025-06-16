// iOS WebView 종합 최적화 - 데이터 로딩 및 화면 전환 문제 해결
// nextstep.smap.site 웹사이트와 iOS WebView 간의 호환성 개선

import WebKit
import UIKit
import Network
import os.log

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
    
    // MARK: - 🛠️ WebView 설정 (최적화된)
    private func setupWebView() {
        let config = createOptimizedWebViewConfiguration()
        webView = WKWebView(frame: view.bounds, configuration: config)
        
        // Delegates 설정
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
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
    }
    
    private func createOptimizedWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        
        // JavaScript 및 미디어 설정
        config.preferences.javaScriptEnabled = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // 🔐 App-Bound Domain 관련 설정 (iOS 14+)
        if #available(iOS 14.0, *) {
            config.limitsNavigationsToAppBoundDomains = true
            print("🔐 [WebView] App-Bound Domain 제한 활성화됨")
            print("🔐 [WebView] 허용된 도메인: nextstep.smap.site, app2.smap.site, app.smap.site, smap.site, localhost")
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
        
        // 디버깅 및 진단용 핸들러
        userContentController.add(self, name: "iosDebug")
        userContentController.add(self, name: "navigationDebug")
        userContentController.add(self, name: "performanceDebug")
        
        config.userContentController = userContentController
        
        print("📬 [WebView] 메시지 핸들러 등록 완료")
    }
    
    private func injectIOSOptimizationScript(config: WKWebViewConfiguration) {
        let script = """
        // iOS WebView 최적화 스크립트
        (function() {
            'use strict';
            
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
        default:
            print("⚠️ [Message] 알 수 없는 메시지: \(message.name)")
        }
        
        let processingTime = Date().timeIntervalSince(messageStartTime) * 1000
        os_log("📬 [Message] 처리 완료: %{public}@ (%.2fms)", 
               log: Self.performanceLog, type: .info, message.name, processingTime)
    }
    
    private func handleSmapIOSMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        
        let type = body["type"] as? String ?? ""
        let param = body["param"]
        
        switch type {
        case "hapticFeedback", "haptic":
            handleHapticFeedback(param: param)
        case "jsLog":
            handleJavaScriptLog(param: param)
        case "googleSignIn":
            handleGoogleSignIn()
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
    
    // 기존 햅틱 피드백 처리 (간소화된 버전)
    private func handleHapticFeedback(param: Any?) {
        print("🎮 [Haptic] 햅틱 피드백 요청")
        
        if let paramString = param as? String,
           let data = paramString.data(using: .utf8),
           let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            
            let feedbackType = hapticData["feedbackType"] as? String ?? "medium"
            executeHaptic(type: feedbackType)
            
        } else if let hapticType = param as? String {
            executeHaptic(type: hapticType)
        }
    }
    
    private func executeHaptic(type: String) {
        DispatchQueue.main.async {
            switch type.lowercased() {
            case "light", "selection":
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
            case "medium":
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            case "heavy":
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.impactOccurred()
            case "success":
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
            case "warning":
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.warning)
            case "error":
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.error)
            default:
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            }
            
            print("✨ [Haptic] \(type) 햅틱 실행 완료")
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