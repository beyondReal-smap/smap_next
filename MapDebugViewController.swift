import UIKit
import WebKit

class MapDebugViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {

    var webView: WKWebView!
    
    // 디버깅 정보를 저장할 배열
    var debugLogs: [String] = []
    var mapErrors: [String] = []
    var networkRequests: [String] = []

    override func viewDidLoad() {
        super.viewDidLoad()

        // 1. WKWebViewConfiguration 설정 (지도 최적화)
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.preferences.javaScriptEnabled = true
        webConfiguration.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        // 지도 API를 위한 추가 설정
        webConfiguration.allowsInlineMediaPlayback = true
        webConfiguration.mediaTypesRequiringUserActionForPlayback = []
        
        // JavaScript 메시지 핸들러 등록 (지도 디버깅용)
        let contentController = WKUserContentController()
        
        // 일반 디버깅 핸들러
        contentController.add(self, name: "jsToNative")
        
        // 지도 전용 디버깅 핸들러
        contentController.add(self, name: "mapDebugHandler")
        
        // 라우트 변경 핸들러
        contentController.add(self, name: "routeChanged")
        
        webConfiguration.userContentController = contentController

        // 2. WKWebView 초기화
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        // 3. AutoLayout 설정
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])

        // 4. 웹 페이지 로드
        if let url = URL(string: "http://localhost:3000") { // 또는 실제 서버 URL
            let request = URLRequest(url: url)
            webView.load(request)
        }
        
        // 5. 디버깅 UI 추가
        setupDebugUI()
        
        // 6. 주기적 상태 체크 시작
        startPeriodicStatusCheck()
    }
    
    // 디버깅 UI 설정
    func setupDebugUI() {
        // 디버깅 버튼 추가
        let debugButton = UIButton(type: .system)
        debugButton.setTitle("지도 상태 체크", for: .normal)
        debugButton.backgroundColor = UIColor.systemBlue
        debugButton.setTitleColor(.white, for: .normal)
        debugButton.layer.cornerRadius = 8
        debugButton.translatesAutoresizingMaskIntoConstraints = false
        debugButton.addTarget(self, action: #selector(checkMapStatus), for: .touchUpInside)
        
        view.addSubview(debugButton)
        
        NSLayoutConstraint.activate([
            debugButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            debugButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            debugButton.widthAnchor.constraint(equalToConstant: 120),
            debugButton.heightAnchor.constraint(equalToConstant: 40)
        ])
        
        // 로그 보기 버튼
        let logButton = UIButton(type: .system)
        logButton.setTitle("로그 보기", for: .normal)
        logButton.backgroundColor = UIColor.systemGreen
        logButton.setTitleColor(.white, for: .normal)
        logButton.layer.cornerRadius = 8
        logButton.translatesAutoresizingMaskIntoConstraints = false
        logButton.addTarget(self, action: #selector(showLogs), for: .touchUpInside)
        
        view.addSubview(logButton)
        
        NSLayoutConstraint.activate([
            logButton.topAnchor.constraint(equalTo: debugButton.bottomAnchor, constant: 5),
            logButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            logButton.widthAnchor.constraint(equalToConstant: 120),
            logButton.heightAnchor.constraint(equalToConstant: 40)
        ])
    }
    
    // 주기적 상태 체크
    func startPeriodicStatusCheck() {
        Timer.scheduledTimer(withTimeInterval: 15.0, repeats: true) { _ in
            self.checkMapStatus()
        }
    }
    
    @objc func checkMapStatus() {
        let javascript = """
        if (typeof debugMapStatus === 'function') {
            debugMapStatus();
        } else {
            console.log('[iOS] debugMapStatus function not available');
        }
        """
        
        webView.evaluateJavaScript(javascript) { result, error in
            if let error = error {
                print("[iOS DEBUG] JavaScript 실행 오류: \(error.localizedDescription)")
                self.debugLogs.append("[ERROR] JavaScript 실행 실패: \(error.localizedDescription)")
            }
        }
    }
    
    @objc func showLogs() {
        let alert = UIAlertController(title: "디버깅 로그", message: nil, preferredStyle: .actionSheet)
        
        // 최근 10개 로그만 표시
        let recentLogs = Array(debugLogs.suffix(10))
        let logMessage = recentLogs.isEmpty ? "로그가 없습니다." : recentLogs.joined(separator: "\n\n")
        
        alert.message = logMessage
        
        alert.addAction(UIAlertAction(title: "로그 지우기", style: .destructive) { _ in
            self.debugLogs.removeAll()
            self.mapErrors.removeAll()
            self.networkRequests.removeAll()
        })
        
        alert.addAction(UIAlertAction(title: "닫기", style: .cancel))
        
        present(alert, animated: true)
    }

    // WKNavigationDelegate 메서드들 (디버깅 강화)
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        let log = "[NAVIGATION] 페이지 로딩 시작: \(webView.url?.absoluteString ?? "unknown")"
        print(log)
        debugLogs.append(log)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let log = "[NAVIGATION] 페이지 로딩 완료: \(webView.url?.absoluteString ?? "unknown")"
        print(log)
        debugLogs.append(log)
        
        // 페이지 로딩 완료 후 지도 상태 체크
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.checkMapStatus()
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let log = "[ERROR] 초기 네비게이션 실패: \(error.localizedDescription)"
        print(log)
        debugLogs.append(log)
        mapErrors.append(log)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let log = "[ERROR] 네비게이션 실패: \(error.localizedDescription)"
        print(log)
        debugLogs.append(log)
        mapErrors.append(log)
    }
    
    // JavaScript 콘솔 로그 캡처
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let log = "[JS ALERT] \(message)"
        print(log)
        debugLogs.append(log)
        
        let alert = UIAlertController(title: "JavaScript Alert", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }
}

// MARK: - WKScriptMessageHandler
extension MapDebugViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        
        switch message.name {
        case "jsToNative":
            handleGeneralMessage(message, timestamp: timestamp)
        case "mapDebugHandler":
            handleMapDebugMessage(message, timestamp: timestamp)
        case "routeChanged":
            handleRouteChanged(message, timestamp: timestamp)
        default:
            print("[UNKNOWN] 알 수 없는 메시지: \(message.name)")
        }
    }
    
    func handleGeneralMessage(_ message: WKScriptMessage, timestamp: String) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }
        
        let log = "[\(timestamp)] [GENERAL] \(type): \(body)"
        print(log)
        debugLogs.append(log)
        
        // 에러 메시지는 별도 저장
        if type.contains("error") || type.contains("Error") {
            mapErrors.append(log)
        }
    }
    
    func handleMapDebugMessage(_ message: WKScriptMessage, timestamp: String) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }
        
        switch type {
        case "mapDebugInfo":
            handleMapDebugInfo(body, timestamp: timestamp)
        case "mapError":
            handleMapError(body, timestamp: timestamp)
        case "mapWarning":
            handleMapWarning(body, timestamp: timestamp)
        case "mapNetworkRequest":
            handleMapNetworkRequest(body, timestamp: timestamp)
        case "mapNetworkError":
            handleMapNetworkError(body, timestamp: timestamp)
        case "mapContainerAdded":
            handleMapContainerAdded(body, timestamp: timestamp)
        case "pageChanged":
            handlePageChanged(body, timestamp: timestamp)
        default:
            let log = "[\(timestamp)] [MAP DEBUG] \(type): \(body)"
            print(log)
            debugLogs.append(log)
        }
    }
    
    func handleMapDebugInfo(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any] else { return }
        
        let naverAvailable = data["naverMapsAvailable"] as? Bool ?? false
        let googleAvailable = data["googleMapsAvailable"] as? Bool ?? false
        let naverContainer = data["naverMapContainer"] as? Bool ?? false
        let googleContainer = data["googleMapContainer"] as? Bool ?? false
        let mapContainers = data["mapContainers"] as? Int ?? 0
        let isHomePage = data["isHomePage"] as? Bool ?? false
        let onlineStatus = data["onlineStatus"] as? Bool ?? true
        
        let log = """
        [\(timestamp)] [MAP STATUS]
        📍 페이지: \(isHomePage ? "홈" : "기타")
        🌐 온라인: \(onlineStatus ? "✅" : "❌")
        📦 지도 컨테이너: \(mapContainers)개
        
        🗺️ 네이버 지도:
        - API 사용 가능: \(naverAvailable ? "✅" : "❌")
        - 컨테이너 존재: \(naverContainer ? "✅" : "❌")
        
        🌍 구글 지도:
        - API 사용 가능: \(googleAvailable ? "✅" : "❌")
        - 컨테이너 존재: \(googleContainer ? "✅" : "❌")
        """
        
        print(log)
        debugLogs.append(log)
        
        // 지도가 모두 사용 불가능한 경우 경고
        if !naverAvailable && !googleAvailable {
            let errorLog = "⚠️ [CRITICAL] 네이버와 구글 지도 모두 사용 불가능!"
            print(errorLog)
            mapErrors.append(errorLog)
        }
    }
    
    func handleMapError(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let errorMessage = data["message"] as? String else { return }
        
        let log = "[\(timestamp)] [MAP ERROR] 🚨 \(errorMessage)"
        print(log)
        debugLogs.append(log)
        mapErrors.append(log)
    }
    
    func handleMapWarning(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let warningMessage = data["message"] as? String else { return }
        
        let log = "[\(timestamp)] [MAP WARNING] ⚠️ \(warningMessage)"
        print(log)
        debugLogs.append(log)
    }
    
    func handleMapNetworkRequest(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let url = data["url"] as? String,
              let status = data["status"] as? Int,
              let duration = data["duration"] as? Int else { return }
        
        let success = data["success"] as? Bool ?? false
        let statusIcon = success ? "✅" : "❌"
        
        let log = "[\(timestamp)] [NETWORK] \(statusIcon) \(status) - \(url) (\(duration)ms)"
        print(log)
        debugLogs.append(log)
        networkRequests.append(log)
    }
    
    func handleMapNetworkError(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let url = data["url"] as? String,
              let error = data["error"] as? String else { return }
        
        let log = "[\(timestamp)] [NETWORK ERROR] 🚨 \(url) - \(error)"
        print(log)
        debugLogs.append(log)
        mapErrors.append(log)
    }
    
    func handleMapContainerAdded(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let count = data["count"] as? Int else { return }
        
        let log = "[\(timestamp)] [DOM] 📦 새로운 지도 컨테이너 \(count)개 추가됨"
        print(log)
        debugLogs.append(log)
    }
    
    func handlePageChanged(_ body: [String: Any], timestamp: String) {
        guard let data = body["data"] as? [String: Any],
              let newUrl = data["newUrl"] as? String else { return }
        
        let log = "[\(timestamp)] [ROUTE] 🔄 페이지 변경: \(newUrl)"
        print(log)
        debugLogs.append(log)
    }
    
    func handleRouteChanged(_ message: WKScriptMessage, timestamp: String) {
        guard let body = message.body as? [String: Any],
              let url = body["url"] as? String else { return }
        
        let log = "[\(timestamp)] [ROUTE CHANGE] 🔄 \(url)"
        print(log)
        debugLogs.append(log)
    }
} 