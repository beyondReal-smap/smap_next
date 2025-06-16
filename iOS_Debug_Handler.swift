// iOS WebView 디버깅 강화 핸들러
// Xcode 콘솔에 로그가 안 뜰 때 사용할 강화된 핸들러

import WebKit
import UIKit
import os.log

extension YourWebViewClass: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        // 🔍 모든 메시지를 로깅 (디버깅용)
        print("🔵 [iOS DEBUG] 메시지 수신 시작")
        print("🔵 [iOS DEBUG] 메시지 이름: \(message.name)")
        print("🔵 [iOS DEBUG] 메시지 본문: \(message.body)")
        
        // smapIos 핸들러 처리
        if message.name == "smapIos" {
            handleSmapIosMessage(message)
            return
        }
        
        // 기존 iosHandler 핸들러 처리 (호환성)
        if message.name == "iosHandler" {
            print("🔵 [iOS DEBUG] iosHandler 메시지 수신")
            handleIosHandlerMessage(message)
            return
        }
        
        // 기타 핸들러들
        if message.name == "jsToNative" {
            print("🔵 [iOS DEBUG] jsToNative 메시지 수신")
            handleJsToNativeMessage(message)
            return
        }
        
        if message.name == "mapDebugHandler" {
            print("🔵 [iOS DEBUG] mapDebugHandler 메시지 수신")
            handleMapDebugMessage(message)
            return
        }
        
        // 처리되지 않은 메시지
        print("⚠️ [iOS DEBUG] 처리되지 않은 메시지: \(message.name)")
    }
    
    // MARK: - smapIos 메시지 처리 (주요 핸들러)
    
    private func handleSmapIosMessage(_ message: WKScriptMessage) {
        print("🔵 [iOS] smapIos 메시지 처리 시작")
        
        guard let body = message.body as? [String: Any] else {
            print("❌ [iOS] 메시지 본문 파싱 실패: \(message.body)")
            return
        }
        
        let type = body["type"] as? String ?? ""
        let param = body["param"]
        
        print("🔵 [iOS] 메시지 타입: \(type)")
        print("🔵 [iOS] 메시지 파라미터: \(param ?? "nil")")
        
        // 햅틱 피드백 처리 (JSON 방식)
        if type == "hapticFeedback" {
            print("🔵 [iOS] 햅틱 피드백 요청 받음")
            handleHapticFeedback(param: param)
            return
        }
        
        // 햅틱 피드백 처리 (단순 방식)
        if type == "haptic" {
            print("🔵 [iOS] 단순 햅틱 요청 받음")
            if let hapticType = param as? String {
                triggerHaptic(type: hapticType)
            }
            return
        }
        
        // Google Sign-In 처리
        if type == "googleSignIn" {
            print("🔵 [iOS] Google Sign-In 요청 받음")
            handleGoogleSignIn()
            return
        }
        
        // JavaScript 로그 처리
        if type == "jsLog" {
            print("🔵 [iOS] JavaScript 로그 수신")
            handleJavaScriptLog(param: param)
            return
        }
        
        // 알림 권한 요청
        if type == "requestNotificationPermission" {
            print("🔵 [iOS] 알림 권한 요청")
            handleNotificationPermissionRequest()
            return
        }
        
        // 기타 메시지 처리
        print("⚠️ [iOS] 처리되지 않은 smapIos 메시지 타입: \(type)")
    }
    
    // MARK: - 햅틱 피드백 처리 (강화 버전)
    
    private func handleHapticFeedback(param: Any?) {
        print("🔵 [iOS] 햅틱 피드백 처리 시작")
        
        if let paramString = param as? String,
           let data = paramString.data(using: .utf8),
           let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            
            let feedbackType = hapticData["feedbackType"] as? String ?? ""
            let description = hapticData["description"] as? String ?? ""
            
            print("🔵 [iOS] JSON 햅틱 데이터:")
            print("🔵 [iOS] - 타입: \(feedbackType)")
            print("🔵 [iOS] - 설명: \(description)")
            
            triggerHaptic(type: feedbackType)
            
        } else if let hapticType = param as? String {
            print("🔵 [iOS] 단순 햅틱 타입: \(hapticType)")
            triggerHaptic(type: hapticType)
        } else {
            print("❌ [iOS] 햅틱 파라미터 파싱 실패: \(param ?? "nil")")
        }
    }
    
    private func triggerHaptic(type: String) {
        print("🔵 [iOS] 햅틱 실행 요청: \(type)")
        
        DispatchQueue.main.async {
            // 디바이스 확인
            guard UIDevice.current.userInterfaceIdiom == .phone else {
                print("⚠️ [iOS] iPad에서는 햅틱 제한됨")
                return
            }
            
            // iOS 버전 확인
            guard #available(iOS 10.0, *) else {
                print("⚠️ [iOS] 햅틱 미지원 iOS 버전")
                return
            }
            
            switch type.lowercased() {
            case "light", "selection":
                self.triggerLightHaptic()
                
            case "medium":
                self.triggerMediumHaptic()
                
            case "heavy", "error":
                self.triggerHeavyHaptic()
                
            case "success":
                self.triggerSuccessHaptic()
                
            case "warning":
                self.triggerWarningHaptic()
                
            default:
                print("⚠️ [iOS] 알 수 없는 햅틱 타입: \(type)")
                self.triggerMediumHaptic()
            }
        }
    }
    
    // MARK: - 햅틱 실행 함수들 (로깅 강화)
    
    private func triggerLightHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Light 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Light 햅틱 미지원")
        }
    }
    
    private func triggerMediumHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Medium 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Medium 햅틱 미지원")
        }
    }
    
    private func triggerHeavyHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Heavy 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Heavy 햅틱 미지원")
        }
    }
    
    private func triggerSuccessHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
            print("✅ [iOS] Success 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Success 햅틱 미지원")
        }
    }
    
    private func triggerWarningHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.warning)
            print("✅ [iOS] Warning 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Warning 햅틱 미지원")
        }
    }
    
    private func triggerErrorHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.error)
            print("✅ [iOS] Error 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Error 햅틱 미지원")
        }
    }
    
    private func triggerSelectionHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            generator.selectionChanged()
            print("✅ [iOS] Selection 햅틱 실행 완료")
        } else {
            print("❌ [iOS] Selection 햅틱 미지원")
        }
    }
    
    // MARK: - 기타 메시지 처리
    
    private func handleIosHandlerMessage(_ message: WKScriptMessage) {
        // 기존 iosHandler 방식 처리
        print("🔵 [iOS] iosHandler 처리 (호환성 모드)")
    }
    
    private func handleJsToNativeMessage(_ message: WKScriptMessage) {
        // jsToNative 메시지 처리
        print("🔵 [iOS] jsToNative 처리")
    }
    
    private func handleMapDebugMessage(_ message: WKScriptMessage) {
        // 지도 디버그 메시지 처리
        print("🔵 [iOS] mapDebugHandler 처리")
    }
    
    private func handleGoogleSignIn() {
        print("🔵 [iOS] Google Sign-In 처리 시작")
        // Google Sign-In 로직 구현
    }
    
    private func handleJavaScriptLog(param: Any?) {
        print("🔵 [iOS] JavaScript 로그 처리")
        // JS 로그 처리 로직
    }
    
    private func handleNotificationPermissionRequest() {
        print("🔵 [iOS] 알림 권한 요청 처리")
        // 알림 권한 요청 로직
    }
}

/*
WebView 설정 (viewDidLoad에 추가):

```swift
override func viewDidLoad() {
    super.viewDidLoad()
    
    // 🔍 모든 메시지 핸들러 등록
    let userContentController = webView.configuration.userContentController
    
    // 주요 핸들러
    userContentController.add(self, name: "smapIos")
    
    // 호환성 핸들러들
    userContentController.add(self, name: "iosHandler")
    userContentController.add(self, name: "jsToNative")
    userContentController.add(self, name: "mapDebugHandler")
    
    print("✅ [iOS] 모든 메시지 핸들러 등록 완료")
    
    // 햅틱 피드백 허용
    if #available(iOS 13.0, *) {
        // iOS 13+ 설정
    }
    
    // 디버깅을 위한 추가 설정
    webView.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
    webView.configuration.preferences.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
    
    // 개발자 도구 활성화 (디버그 빌드에서만)
    #if DEBUG
    if #available(iOS 16.4, *) {
        webView.isInspectable = true
    }
    #endif
}

deinit {
    // 모든 핸들러 제거
    let userContentController = webView.configuration.userContentController
    userContentController.removeScriptMessageHandler(forName: "smapIos")
    userContentController.removeScriptMessageHandler(forName: "iosHandler")
    userContentController.removeScriptMessageHandler(forName: "jsToNative")
    userContentController.removeScriptMessageHandler(forName: "mapDebugHandler")
    
    print("🔄 [iOS] 모든 메시지 핸들러 정리 완료")
}
```

이제 Xcode 콘솔에서 모든 메시지와 햅틱 실행을 확인할 수 있습니다!
*/ 