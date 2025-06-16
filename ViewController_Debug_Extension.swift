import UIKit
import WebKit

// MARK: - 기존 ViewController에 추가할 디버깅 메서드들

extension ViewController {
    
    // viewDidLoad()에 추가할 코드
    func setupMapDebugging() {
        // JavaScript 메시지 핸들러 추가
        webView.configuration.userContentController.add(self, name: "mapDebugHandler")
        
        // 디버깅 버튼 추가
        addDebugButton()
        
        // 주기적 상태 체크 시작
        startMapStatusMonitoring()
    }
    
    // 디버깅 버튼 추가
    func addDebugButton() {
        let debugButton = UIButton(type: .system)
        debugButton.setTitle("🗺️", for: .normal)
        debugButton.titleLabel?.font = UIFont.systemFont(ofSize: 24)
        debugButton.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.8)
        debugButton.layer.cornerRadius = 25
        debugButton.translatesAutoresizingMaskIntoConstraints = false
        debugButton.addTarget(self, action: #selector(showMapDebugInfo), for: .touchUpInside)
        
        view.addSubview(debugButton)
        
        NSLayoutConstraint.activate([
            debugButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            debugButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            debugButton.widthAnchor.constraint(equalToConstant: 50),
            debugButton.heightAnchor.constraint(equalToConstant: 50)
        ])
    }
    
    // 지도 상태 모니터링 시작
    func startMapStatusMonitoring() {
        // 15초마다 상태 체크
        Timer.scheduledTimer(withTimeInterval: 15.0, repeats: true) { _ in
            self.checkMapStatusFromiOS()
        }
        
        // 초기 체크 (3초 후)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            self.checkMapStatusFromiOS()
        }
    }
    
    @objc func showMapDebugInfo() {
        checkMapStatusFromiOS()
        
        // 간단한 상태 표시
        let alert = UIAlertController(title: "🗺️ 지도 디버깅", message: "지도 상태를 확인 중입니다...", preferredStyle: .alert)
        
        alert.addAction(UIAlertAction(title: "강제 새로고침", style: .default) { _ in
            self.webView.reload()
        })
        
        alert.addAction(UIAlertAction(title: "홈으로 이동", style: .default) { _ in
            if let url = URL(string: "http://localhost:3000/home") {
                let request = URLRequest(url: url)
                self.webView.load(request)
            }
        })
        
        alert.addAction(UIAlertAction(title: "닫기", style: .cancel))
        
        present(alert, animated: true)
    }
    
    func checkMapStatusFromiOS() {
        let javascript = """
        (function() {
            try {
                // 지도 상태 정보 수집
                const debugInfo = {
                    timestamp: new Date().toISOString(),
                    currentUrl: window.location.href,
                    
                    // 네이버 지도 상태
                    naverMapsAvailable: !!(window.naver && window.naver.maps),
                    naverScriptExists: !!document.querySelector('script[src*="oapi.map.naver.com"]'),
                    naverMapContainer: !!document.getElementById('naverMapContainer'),
                    
                    // 구글 지도 상태
                    googleMapsAvailable: !!(window.google && window.google.maps),
                    googleScriptExists: !!document.querySelector('script[src*="maps.googleapis.com"]'),
                    googleMapContainer: !!document.getElementById('googleMapContainer'),
                    
                    // DOM 상태
                    mapContainers: document.querySelectorAll('[id*="map"], .map-container').length,
                    documentReady: document.readyState,
                    
                    // 네트워크 상태
                    onlineStatus: navigator.onLine,
                    
                    // 페이지 정보
                    isHomePage: window.location.pathname === '/home'
                };
                
                // iOS로 정보 전송
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mapDebugHandler) {
                    window.webkit.messageHandlers.mapDebugHandler.postMessage({
                        type: 'mapDebugInfo',
                        data: debugInfo
                    });
                }
                
                console.log('[iOS DEBUG] 지도 상태 정보:', debugInfo);
                
                return debugInfo;
            } catch (error) {
                console.error('[iOS DEBUG] 상태 체크 오류:', error);
                
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mapDebugHandler) {
                    window.webkit.messageHandlers.mapDebugHandler.postMessage({
                        type: 'mapError',
                        data: {
                            message: 'iOS 상태 체크 오류: ' + error.message,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                
                return { error: error.message };
            }
        })();
        """
        
        webView.evaluateJavaScript(javascript) { result, error in
            if let error = error {
                print("[iOS] JavaScript 실행 오류: \(error.localizedDescription)")
            } else if let result = result {
                print("[iOS] 지도 상태 체크 완료: \(result)")
            }
        }
    }
}

// MARK: - WKScriptMessageHandler 확장 (기존 extension에 추가)
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        // 기존 메시지 핸들링 코드가 있다면 그 위에 추가
        
        if message.name == "mapDebugHandler" {
            handleMapDebugMessage(message)
        }
        
        // 기존 다른 메시지 핸들링 코드들...
    }
    
    func handleMapDebugMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            print("[MAP DEBUG] 잘못된 메시지 형식")
            return
        }
        
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        
        switch type {
        case "mapDebugInfo":
            if let data = body["data"] as? [String: Any] {
                handleMapDebugInfo(data, timestamp: timestamp)
            }
            
        case "mapError":
            if let data = body["data"] as? [String: Any],
               let errorMessage = data["message"] as? String {
                print("[\(timestamp)] [MAP ERROR] 🚨 \(errorMessage)")
            }
            
        case "mapWarning":
            if let data = body["data"] as? [String: Any],
               let warningMessage = data["message"] as? String {
                print("[\(timestamp)] [MAP WARNING] ⚠️ \(warningMessage)")
            }
            
        default:
            print("[\(timestamp)] [MAP DEBUG] \(type): \(body)")
        }
    }
    
    func handleMapDebugInfo(_ data: [String: Any], timestamp: String) {
        let naverAvailable = data["naverMapsAvailable"] as? Bool ?? false
        let googleAvailable = data["googleMapsAvailable"] as? Bool ?? false
        let naverContainer = data["naverMapContainer"] as? Bool ?? false
        let googleContainer = data["googleMapContainer"] as? Bool ?? false
        let mapContainers = data["mapContainers"] as? Int ?? 0
        let isHomePage = data["isHomePage"] as? Bool ?? false
        let onlineStatus = data["onlineStatus"] as? Bool ?? true
        let currentUrl = data["currentUrl"] as? String ?? "unknown"
        
        let debugLog = """
        
        ========== 지도 디버깅 정보 ==========
        ⏰ 시간: \(timestamp)
        🌐 URL: \(currentUrl)
        📍 홈페이지: \(isHomePage ? "✅" : "❌")
        🌐 온라인: \(onlineStatus ? "✅" : "❌")
        📦 지도 컨테이너: \(mapContainers)개
        
        🗺️ 네이버 지도:
        - API 사용 가능: \(naverAvailable ? "✅" : "❌")
        - 컨테이너 존재: \(naverContainer ? "✅" : "❌")
        
        🌍 구글 지도:
        - API 사용 가능: \(googleAvailable ? "✅" : "❌")
        - 컨테이너 존재: \(googleContainer ? "✅" : "❌")
        =====================================
        
        """
        
        print(debugLog)
        
        // 지도가 모두 사용 불가능한 경우 알림
        if !naverAvailable && !googleAvailable && isHomePage {
            DispatchQueue.main.async {
                let alert = UIAlertController(
                    title: "⚠️ 지도 로딩 문제",
                    message: "네이버와 구글 지도 모두 사용할 수 없습니다.\n\n컨테이너: \(mapContainers)개\n온라인: \(onlineStatus ? "연결됨" : "연결 안됨")",
                    preferredStyle: .alert
                )
                
                alert.addAction(UIAlertAction(title: "새로고침", style: .default) { _ in
                    self.webView.reload()
                })
                
                alert.addAction(UIAlertAction(title: "확인", style: .cancel))
                
                self.present(alert, animated: true)
            }
        }
    }
}

// MARK: - 사용법 주석
/*
기존 ViewController의 viewDidLoad()에 다음 코드를 추가하세요:

override func viewDidLoad() {
    super.viewDidLoad()
    
    // 기존 WebView 설정 코드...
    
    // 지도 디버깅 설정 추가
    setupMapDebugging()
}

그리고 ViewController 클래스가 WKScriptMessageHandler를 구현하도록 하세요:

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    // 기존 코드...
}
*/ 