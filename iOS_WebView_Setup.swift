// iOS WebView 전체 설정 (MainView.swift에 추가할 내용)
// 햅틱 피드백 지원을 포함한 완전한 WebView 설정

import SwiftUI
import WebKit
import UIKit

struct MainView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        
        // 메시지 핸들러 등록
        configuration.userContentController.add(
            context.coordinator, 
            name: "smapIos"
        )
        
        // WebView 설정
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        
        // 초기 페이지 로드
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        // 업데이트 로직 (필요시)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        
        // MARK: - WKScriptMessageHandler
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            
            if message.name == "smapIos" {
                guard let body = message.body as? [String: Any] else {
                    print("❌ 메시지 본문 파싱 실패: \(message.body)")
                    return
                }
                
                let type = body["type"] as? String ?? ""
                let param = body["param"]
                
                print("🔵 [iOS] 메시지 수신: \(type)")
                
                // 햅틱 피드백 처리
                if type == "hapticFeedback" {
                    handleHapticFeedback(param: param)
                    return
                }
                
                // 단순 햅틱 처리 (기존 방식 지원)
                if type == "haptic" {
                    if let hapticType = param as? String {
                        triggerHaptic(type: hapticType)
                    }
                    return
                }
                
                // Google Sign-In 처리
                if type == "googleSignIn" {
                    handleGoogleSignIn(webView: message.webView)
                    return
                }
                
                // JavaScript 로그 처리
                if type == "jsLog" {
                    handleJavaScriptLog(param: param)
                    return
                }
                
                // 기타 메시지 처리...
                print("⚠️ [iOS] 처리되지 않은 메시지 타입: \(type)")
            }
        }
        
        // MARK: - 햅틱 피드백 처리
        
        private func handleHapticFeedback(param: Any?) {
            if let paramString = param as? String,
               let data = paramString.data(using: .utf8),
               let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                
                // JSON 형태의 햅틱 데이터 처리
                let feedbackType = hapticData["feedbackType"] as? String ?? ""
                let description = hapticData["description"] as? String ?? ""
                
                print("🔵 [iOS] 햅틱 피드백 요청: \(feedbackType)")
                if !description.isEmpty {
                    print("🔵 [iOS] 설명: \(description)")
                }
                
                triggerHaptic(type: feedbackType)
                
            } else if let hapticType = param as? String {
                // 단순 문자열 형태의 햅틱 타입 처리
                print("🔵 [iOS] 햅틱 피드백 요청: \(hapticType)")
                triggerHaptic(type: hapticType)
            }
        }
        
        private func triggerHaptic(type: String) {
            DispatchQueue.main.async {
                // 햅틱 지원 여부 확인
                guard UIDevice.current.userInterfaceIdiom == .phone else {
                    print("⚠️ [iOS] iPad에서는 햅틱 피드백이 제한적입니다")
                    return
                }
                
                switch type.lowercased() {
                case "light":
                    self.triggerLightHaptic()
                    
                case "medium":
                    self.triggerMediumHaptic()
                    
                case "heavy":
                    self.triggerHeavyHaptic()
                    
                case "success":
                    self.triggerSuccessHaptic()
                    
                case "warning":
                    self.triggerWarningHaptic()
                    
                case "error":
                    self.triggerErrorHaptic()
                    
                case "selection":
                    self.triggerSelectionHaptic()
                    
                default:
                    print("⚠️ [iOS] 알 수 없는 햅틱 타입: \(type), 기본값 사용")
                    self.triggerMediumHaptic()
                }
            }
        }
        
        // MARK: - 햅틱 피드백 구현
        
        private func triggerLightHaptic() {
            let impactFeedback = UIImpactFeedbackGenerator(style: .light)
            impactFeedback.prepare()
            impactFeedback.impactOccurred()
            print("✅ [iOS] Light 햅틱 실행")
        }
        
        private func triggerMediumHaptic() {
            let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
            impactFeedback.prepare()
            impactFeedback.impactOccurred()
            print("✅ [iOS] Medium 햅틱 실행")
        }
        
        private func triggerHeavyHaptic() {
            let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
            impactFeedback.prepare()
            impactFeedback.impactOccurred()
            print("✅ [iOS] Heavy 햅틱 실행")
        }
        
        private func triggerSuccessHaptic() {
            let notificationFeedback = UINotificationFeedbackGenerator()
            notificationFeedback.prepare()
            notificationFeedback.notificationOccurred(.success)
            print("✅ [iOS] Success 햅틱 실행")
        }
        
        private func triggerWarningHaptic() {
            let notificationFeedback = UINotificationFeedbackGenerator()
            notificationFeedback.prepare()
            notificationFeedback.notificationOccurred(.warning)
            print("✅ [iOS] Warning 햅틱 실행")
        }
        
        private func triggerErrorHaptic() {
            let notificationFeedback = UINotificationFeedbackGenerator()
            notificationFeedback.prepare()
            notificationFeedback.notificationOccurred(.error)
            print("✅ [iOS] Error 햅틱 실행")
        }
        
        private func triggerSelectionHaptic() {
            let selectionFeedback = UISelectionFeedbackGenerator()
            selectionFeedback.prepare()
            selectionFeedback.selectionChanged()
            print("✅ [iOS] Selection 햅틱 실행")
        }
        
        // MARK: - Google Sign-In 처리
        
        private func handleGoogleSignIn(webView: WKWebView?) {
            // Google Sign-In 로직...
            print("🔵 [iOS] Google Sign-In 요청 처리")
            // 기존 Google Sign-In 코드 유지
        }
        
        // MARK: - JavaScript 로그 처리
        
        private func handleJavaScriptLog(param: Any?) {
            guard let paramString = param as? String,
                  let data = paramString.data(using: .utf8),
                  let logData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                print("❌ JS 로그 데이터 파싱 실패")
                return
            }
            
            let level = logData["level"] as? String ?? "info"
            let message = logData["message"] as? String ?? ""
            let timestamp = logData["timestamp"] as? String ?? ""
            
            // 로그 레벨에 따른 출력
            switch level {
            case "error":
                print("🔴 [JS ERROR] \(timestamp): \(message)")
            case "warning":
                print("🟡 [JS WARNING] \(timestamp): \(message)")
            default:
                print("🔵 [JS INFO] \(timestamp): \(message)")
            }
        }
        
        // MARK: - WKNavigationDelegate
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("✅ [iOS] WebView 로드 완료")
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("❌ [iOS] WebView 로드 실패: \(error.localizedDescription)")
        }
        
        // MARK: - Cleanup
        
        deinit {
            print("🔄 [iOS] WebView Coordinator 정리 중...")
        }
    }
}

// MARK: - ContentView에서 사용법

struct ContentView: View {
    var body: some View {
        MainView(url: URL(string: "https://your-app-url.com")!)
            .edgesIgnoringSafeArea(.all)
    }
}

/*
Info.plist에 추가할 설정:

1. 네트워크 보안 설정 (필요시):
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>

2. 마이크 권한 (필요시):
<key>NSMicrophoneUsageDescription</key>
<string>음성 메모 기능을 위해 마이크 권한이 필요합니다.</string>

3. 카메라 권한 (필요시):
<key>NSCameraUsageDescription</key>
<string>프로필 사진 촬영을 위해 카메라 권한이 필요합니다.</string>

주요 특징:
- 모든 햅틱 타입 지원 (light, medium, heavy, success, warning, error, selection)
- iPhone에서만 햅틱 실행 (iPad에서는 제한적)
- 안전한 메시지 파싱 및 에러 처리
- 상세한 로깅으로 디버깅 지원
- prepare() 호출로 햅틱 반응성 최적화
*/ 