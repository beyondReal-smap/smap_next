// iOS WebView 디버깅 강화 핸들러
// Xcode 콘솔에 로그가 안 뜰 때 사용할 강화된 핸들러

import WebKit
import UIKit
import os.log

// 🚨 IPC 과부하 방지를 위한 메시지 쓰로틀링 클래스
class MessageThrottle {
    private var lastMessageTimes: [String: TimeInterval] = [:]
    private let minInterval: TimeInterval = 0.1 // 100ms 최소 간격
    
    func canProcessMessage(type: String) -> Bool {
        let now = Date().timeIntervalSince1970
        
        if let lastTime = lastMessageTimes[type] {
            if now - lastTime < minInterval {
                return false // 너무 빠른 메시지는 무시
            }
        }
        
        lastMessageTimes[type] = now
        return true
    }
}

extension YourWebViewClass: WKScriptMessageHandler {
    
    // 🚨 메시지 쓰로틀링 인스턴스
    private let messageThrottle = MessageThrottle()
    
    // 🚨 개발/프로덕션 환경 감지
    private var isDevelopment: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    // 🚨 로그 출력 제한 함수
    private func debugLog(_ message: String, category: String = "iOS_Debug") {
        if isDevelopment {
            print("🔵 [\(category)] \(message)")
            os_log("%@", log: OSLog(subsystem: "com.smap.app", category: category), type: .debug, message)
        }
    }
    
    private func infoLog(_ message: String, category: String = "iOS_Debug") {
        print("ℹ️ [\(category)] \(message)")
        os_log("%@", log: OSLog(subsystem: "com.smap.app", category: category), type: .info, message)
    }
    
    private func errorLog(_ message: String, category: String = "iOS_Debug") {
        print("❌ [\(category)] \(message)")
        os_log("%@", log: OSLog(subsystem: "com.smap.app", category: category), type: .error, message)
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        // 🚨 메시지 타입별 쓰로틀링 적용
        let messageType = message.name
        guard messageThrottle.canProcessMessage(type: messageType) else {
            if isDevelopment {
                debugLog("메시지 쓰로틀링: \(messageType) 무시됨", category: "MessageThrottle")
            }
            return
        }
        
        debugLog("메시지 수신 시작", category: "iOS_DEBUG")
        debugLog("메시지 이름: \(message.name)", category: "iOS_DEBUG")
        
        // 메시지 본문 로깅 (개발 환경에서만)
        if isDevelopment {
            debugLog("메시지 본문: \(message.body)", category: "iOS_DEBUG")
        } else {
            infoLog("메시지 수신: \(message.name)", category: "iOS_DEBUG")
        }
        
        // smapIos 핸들러 처리
        if message.name == "smapIos" {
            handleSmapIosMessage(message)
            return
        }
        
        // 기존 iosHandler 핸들러 처리 (호환성)
        if message.name == "iosHandler" {
            debugLog("iosHandler 메시지 수신", category: "iOS")
            handleIosHandlerMessage(message)
            return
        }
        
        // 기타 핸들러들
        if message.name == "jsToNative" {
            debugLog("jsToNative 메시지 수신", category: "iOS")
            handleJsToNativeMessage(message)
            return
        }
        
        if message.name == "mapDebugHandler" {
            debugLog("mapDebugHandler 메시지 수신", category: "iOS")
            handleMapDebugMessage(message)
            return
        }
        
        // 처리되지 않은 메시지
        debugLog("알 수 없는 메시지 타입: \(message.name)", category: "iOS_DEBUG")
    }
    
    // MARK: - smapIos 메시지 처리 (주요 핸들러)
    
    private func handleSmapIosMessage(_ message: WKScriptMessage) {
        debugLog("smapIos 메시지 처리 시작", category: "iOS")
        
        guard let body = message.body as? [String: Any] else {
            errorLog("smapIos 메시지 파싱 실패", category: "iOS")
            return
        }
        
        let type = body["type"] as? String ?? ""
        debugLog("메시지 타입: \(type)", category: "iOS")
        
        switch type {
        case "hapticFeedback":
            handleHapticFeedback(param: body["param"])
            
        case "googleSignIn":
            handleGoogleSignIn()
            
        case "jsLog":
            handleJavaScriptLog(param: body["param"])
            
        case "requestNotificationPermission":
            handleNotificationPermissionRequest()
            
        default:
            debugLog("알 수 없는 smapIos 메시지 타입: \(type)", category: "iOS")
        }
    }
    
    // MARK: - 햅틱 피드백 처리 (강화 버전)
    
    private func handleHapticFeedback(param: Any?) {
        debugLog("햅틱 피드백 요청 받음", category: "iOS")
        
        // 🚨 햅틱 처리도 쓰로틀링 적용
        guard messageThrottle.canProcessMessage(type: "hapticFeedback") else {
            debugLog("햅틱 메시지 쓰로틀링됨", category: "iOS")
            return
        }
        
        var hapticType = "medium" // 기본값
        
        if let paramString = param as? String,
           let paramData = paramString.data(using: .utf8) {
            do {
                if let json = try JSONSerialization.jsonObject(with: paramData) as? [String: Any] {
                    hapticType = json["feedbackType"] as? String ?? "medium"
                    
                    if isDevelopment {
                        debugLog("JSON 햅틱 데이터:", category: "iOS")
                        debugLog("- 타입: \(hapticType)", category: "iOS")
                        if let description = json["description"] as? String {
                            debugLog("- 설명: \(description)", category: "iOS")
                        }
                    }
                }
            } catch {
                errorLog("햅틱 JSON 파싱 실패: \(error)", category: "iOS")
            }
        }
        
        triggerHaptic(type: hapticType)
    }
    
    private func triggerHaptic(type: String) {
        infoLog("햅틱 실행 요청: \(type)", category: "iOS")
        
        DispatchQueue.main.async {
            // 디바이스 확인
            guard UIDevice.current.userInterfaceIdiom == .phone else {
                if self.isDevelopment {
                    self.debugLog("iPad에서는 햅틱 제한됨", category: "iOS")
                }
                return
            }
            
            // iOS 버전 확인
            guard #available(iOS 10.0, *) else {
                self.errorLog("햅틱 미지원 iOS 버전", category: "iOS")
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
                self.debugLog("알 수 없는 햅틱 타입: \(type)", category: "iOS")
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
            infoLog("Light 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Light 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerMediumHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            infoLog("Medium 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Medium 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerHeavyHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
            infoLog("Heavy 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Heavy 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerSuccessHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
            infoLog("Success 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Success 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerWarningHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.warning)
            infoLog("Warning 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Warning 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerErrorHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.error)
            infoLog("Error 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Error 햅틱 미지원", category: "iOS")
        }
    }
    
    private func triggerSelectionHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            generator.selectionChanged()
            infoLog("Selection 햅틱 실행 완료", category: "iOS")
        } else {
            errorLog("Selection 햅틱 미지원", category: "iOS")
        }
    }
    
    // MARK: - 기타 메시지 처리
    
    private func handleIosHandlerMessage(_ message: WKScriptMessage) {
        // 기존 iosHandler 방식 처리
        debugLog("iosHandler 처리 (호환성 모드)", category: "iOS")
    }
    
    private func handleJsToNativeMessage(_ message: WKScriptMessage) {
        // jsToNative 메시지 처리
        debugLog("jsToNative 처리", category: "iOS")
    }
    
    private func handleMapDebugMessage(_ message: WKScriptMessage) {
        // 지도 디버그 메시지 처리
        debugLog("mapDebugHandler 처리", category: "iOS")
    }
    
    private func handleGoogleSignIn() {
        infoLog("Google Sign-In 처리 시작", category: "iOS")
        // Google Sign-In 로직 구현
    }
    
    private func handleJavaScriptLog(param: Any?) {
        // 🚨 JavaScript 로그는 개발 환경에서만 출력
        if isDevelopment {
            debugLog("JavaScript 로그 처리", category: "iOS")
        }
        // JS 로그 처리 로직
    }
    
    private func handleNotificationPermissionRequest() {
        infoLog("알림 권한 요청 처리", category: "iOS")
        // 알림 권한 요청 로직
    }
}

/*
🚨 IPC 과부하 해결을 위한 WebView 설정 (viewDidLoad에 추가):

```swift
override func viewDidLoad() {
    super.viewDidLoad()
    
    // 🔍 모든 메시지 핸들러 등록
    let userContentController = webView.configuration.userContentController
    
    // 주요 핸들러
    let debugHandler = iOS_Debug_Handler()
    userContentController.add(debugHandler, name: "smapIos")
    
    // 호환성 핸들러들
    userContentController.add(debugHandler, name: "iosHandler")
    userContentController.add(debugHandler, name: "jsToNative")
    userContentController.add(debugHandler, name: "mapDebugHandler")
    
    print("✅ [iOS] 메시지 핸들러 등록 완료 (IPC 과부하 방지 적용)")
    
    // 🚨 WebKit 성능 최적화 설정
    webView.configuration.preferences.javaScriptEnabled = true
    webView.configuration.allowsInlineMediaPlayback = true
    
    // 🚨 개발자 도구 비활성화 (프로덕션에서)
    #if !DEBUG
    if #available(iOS 16.4, *) {
        webView.isInspectable = false
    }
    #endif
    
    // 🚨 메모리 압박 시 캐시 정리
    NotificationCenter.default.addObserver(
        forName: UIApplication.didReceiveMemoryWarningNotification,
        object: nil,
        queue: .main
    ) { _ in
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache],
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) { }
    }
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

이제 IPC 메시지 과부하가 대폭 줄어들 것입니다! 🎉
*/ 