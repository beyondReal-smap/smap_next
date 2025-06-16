// iOS WebView 햅틱 피드백 핸들러
// 이 코드를 iOS 프로젝트의 WebView 관련 파일에 추가하세요

import WebKit
import UIKit

extension YourWebViewClass: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        if message.name == "smapIos" {
            guard let body = message.body as? [String: Any] else {
                print("❌ 메시지 본문 파싱 실패: \(message.body)")
                return
            }
            
            let type = body["type"] as? String ?? ""
            let param = body["param"]
            
            // 햅틱 피드백 처리 (NEW)
            if type == "hapticFeedback" {
                handleHapticFeedback(param: param)
                return
            }
            
            // 단순 햅틱 처리 (기존 방식도 지원)
            if type == "haptic" {
                if let hapticType = param as? String {
                    triggerHaptic(type: hapticType)
                }
                return
            }
            
            // 기존 다른 메시지들...
            if type == "googleSignIn" {
                handleGoogleSignIn()
                return
            }
            
            // 기타 메시지 처리...
        }
    }
    
    // 새로운 햅틱 피드백 처리 함수 (JSON 파라미터 지원)
    private func handleHapticFeedback(param: Any?) {
        if let paramString = param as? String,
           let data = paramString.data(using: .utf8),
           let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            
            // JSON 형태의 햅틱 데이터 처리
            let feedbackType = hapticData["feedbackType"] as? String ?? ""
            let description = hapticData["description"] as? String ?? ""
            
            print("🔵 [iOS] 햅틱 피드백 요청: \(feedbackType) - \(description)")
            triggerHaptic(type: feedbackType)
            
        } else if let hapticType = param as? String {
            // 단순 문자열 형태의 햅틱 타입 처리
            print("🔵 [iOS] 햅틱 피드백 요청: \(hapticType)")
            triggerHaptic(type: hapticType)
        }
    }
    
    // 실제 햅틱 피드백 실행 함수
    private func triggerHaptic(type: String) {
        DispatchQueue.main.async {
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
                self.triggerMediumHaptic() // 기본값으로 medium 사용
            }
        }
    }
    
    // 가벼운 햅틱 (네비게이션, 메뉴 선택)
    private func triggerLightHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
        print("✅ [iOS] Light 햅틱 실행")
    }
    
    // 중간 햅틱 (버튼 클릭, 토글)
    private func triggerMediumHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
        print("✅ [iOS] Medium 햅틱 실행")
    }
    
    // 강한 햅틱 (중요한 액션)
    private func triggerHeavyHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
        print("✅ [iOS] Heavy 햅틱 실행")
    }
    
    // 성공 햅틱 (데이터 로딩 완료, 작업 완료)
    private func triggerSuccessHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.success)
        print("✅ [iOS] Success 햅틱 실행")
    }
    
    // 경고 햅틱
    private func triggerWarningHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.warning)
        print("✅ [iOS] Warning 햅틱 실행")
    }
    
    // 에러 햅틱
    private func triggerErrorHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.error)
        print("✅ [iOS] Error 햅틱 실행")
    }
    
    // 선택 변경 햅틱 (탭 전환, 선택 변경)
    private func triggerSelectionHaptic() {
        let selectionFeedback = UISelectionFeedbackGenerator()
        selectionFeedback.prepare()
        selectionFeedback.selectionChanged()
        print("✅ [iOS] Selection 햅틱 실행")
    }
}

/*
WebView 설정에서 메시지 핸들러 등록:

```swift
override func viewDidLoad() {
    super.viewDidLoad()
    
    // 메시지 핸들러 등록
    webView.configuration.userContentController.add(self, name: "smapIos")
    
    // 햅틱 피드백 허용 설정
    if #available(iOS 13.0, *) {
        // iOS 13+ 에서 햅틱 설정
    }
}
```

deinit에서 메시지 핸들러 제거:

```swift
deinit {
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "smapIos")
}
```
*/ 