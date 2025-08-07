// iOS WebView 디버깅 강화 핸들러
// Xcode 콘솔에 로그가 안 뜰 때 사용할 강화된 핸들러

import WebKit
import UIKit
import os.log
import UserNotifications

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
        // 🚨 JS 로그 처리도 쓰로틀링 적용
        guard messageThrottle.canProcessMessage(type: "jsLog") else {
            return // 과도한 로그 출력 차단
        }
        
        guard let paramString = param as? String else {
            if isDevelopment {
                debugLog("JavaScript 로그 파라미터 형식 오류", category: "iOS")
            }
            return
        }
        
        guard let paramData = paramString.data(using: .utf8) else {
            if isDevelopment {
                debugLog("JavaScript 로그 UTF-8 변환 실패", category: "iOS")
            }
            return
        }
        
        do {
            if let logEntry = try JSONSerialization.jsonObject(with: paramData) as? [String: Any] {
                // 새로운 구조화된 로깅 처리
                handleStructuredJavaScriptLog(logEntry)
            } else {
                if isDevelopment {
                    debugLog("JavaScript 로그 JSON 구조 오류", category: "iOS")
                }
            }
        } catch {
            if isDevelopment {
                errorLog("JavaScript 로그 JSON 파싱 실패: \(error)", category: "iOS")
            }
        }
    }
    
    // 구조화된 JavaScript 로그 처리
    private func handleStructuredJavaScriptLog(_ logEntry: [String: Any]) {
        let level = logEntry["level"] as? String ?? "info"
        let category = logEntry["category"] as? String ?? "SYSTEM"
        let message = logEntry["message"] as? String ?? "Unknown message"
        let timestamp = logEntry["timestamp"] as? String ?? getCurrentTimestamp()
        let sessionId = logEntry["sessionId"] as? String ?? "unknown"
        let url = logEntry["url"] as? String ?? "unknown"
        
        // 카테고리별 이모지
        let categoryEmoji: String
        switch category {
        case "GOOGLE_LOGIN":
            categoryEmoji = "🔍"
        case "KAKAO_LOGIN":
            categoryEmoji = "💬"
        case "AUTH":
            categoryEmoji = "🔐"
        case "API":
            categoryEmoji = "🌐"
        case "NETWORK":
            categoryEmoji = "📡"
        case "USER_ACTION":
            categoryEmoji = "👆"
        case "SYSTEM":
            categoryEmoji = "⚙️"
        default:
            categoryEmoji = "📄"
        }
        
        // 레벨별 처리
        let logMessage = "[\(timestamp)] \(categoryEmoji) [\(category)] \(message)"
        
        switch level.lowercased() {
        case "critical":
            print("🚨 \(logMessage)")
        case "error":
            print("❌ \(logMessage)")
        case "warning":
            print("⚠️ \(logMessage)")
        case "info":
            print("📝 \(logMessage)")
        case "debug":
            if isDevelopment {
                print("🔍 \(logMessage)")
            }
        default:
            print("📄 \(logMessage)")
        }
        
        // 상세 데이터 출력 (개발 환경에서만)
        if isDevelopment {
            if let data = logEntry["data"] as? [String: Any], !data.isEmpty {
                print("   📋 Data:")
                for (key, value) in data {
                    // 민감한 데이터는 마스킹하여 출력
                    let maskedValue = maskSensitiveValue(key: key, value: value)
                    print("      \(key): \(maskedValue)")
                }
            }
            
            // URL과 세션 정보 출력
            if url != "unknown" || sessionId != "unknown" {
                let shortUrl = String(url.prefix(50))
                let shortSession = String(sessionId.prefix(20))
                print("   🔗 Context: URL=\(shortUrl)... | Session=\(shortSession)...")
            }
        }
        
        // 🎯 로그인 관련 로그는 특별 강조 (항상 출력)
        if category == "GOOGLE_LOGIN" || category == "KAKAO_LOGIN" {
            print("🎯 [LOGIN TRACKING] \(category): \(message)")
            
            if let data = logEntry["data"] as? [String: Any] {
                if let step = data["step"] as? String {
                    print("   📍 Step: \(step)")
                }
                if let provider = data["provider"] as? String {
                    print("   🏢 Provider: \(provider)")
                }
                if let hasUser = data["hasUser"] as? Bool {
                    print("   👤 Has User: \(hasUser)")
                }
                if let hasToken = data["hasToken"] as? Bool {
                    print("   🎫 Has Token: \(hasToken)")
                }
                if let userEmail = data["userEmail"] as? String {
                    print("   📧 User Email: \(userEmail)")
                }
                if let userId = data["userId"] as? String {
                    print("   🆔 User ID: \(userId)")
                }
                if let isNewUser = data["isNewUser"] as? Bool {
                    print("   🆕 Is New User: \(isNewUser)")
                }
            }
        }
        
        // 🌐 API 호출 관련 로그도 강조
        if category == "API" && message.contains("API 호출") {
            if let data = logEntry["data"] as? [String: Any] {
                if let method = data["method"] as? String,
                   let url = data["url"] as? String,
                   let status = data["responseStatus"] as? Int {
                    print("🌐 [API CALL] \(method) \(url) → \(status)")
                    
                    if let duration = data["duration"] as? Int {
                        print("   ⏱️ Duration: \(duration)ms")
                    }
                }
            }
        }
    }
    
    // 민감한 데이터 마스킹
    private func maskSensitiveValue(key: String, value: Any) -> String {
        let lowerKey = key.lowercased()
        let sensitiveKeys = ["token", "password", "credential", "secret", "key", "authorization"]
        
        if sensitiveKeys.contains(where: { lowerKey.contains($0) }) {
            return "***MASKED***"
        }
        
        // 이메일은 부분 마스킹
        if lowerKey.contains("email"), let emailString = value as? String {
            if emailString.contains("@") {
                let parts = emailString.split(separator: "@")
                if parts.count == 2 && parts[0].count > 3 {
                    return String(parts[0].prefix(3)) + "***@" + String(parts[1])
                }
            }
            return "***MASKED***"
        }
        
        return String(describing: value)
    }
    
    private func handleNotificationPermissionRequest() {
        infoLog("알림 권한 요청 처리", category: "iOS")
        
        let center = UNUserNotificationCenter.current()
        
        // 현재 권한 상태 먼저 확인
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.infoLog("현재 푸시 권한 상태: \(settings.authorizationStatus.rawValue)", category: "iOS")
                
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    self.infoLog("푸시 알림 권한이 이미 허용되어 있음", category: "iOS")
                    
                case .denied:
                    self.errorLog("푸시 알림 권한이 거부되어 있음", category: "iOS")
                    
                case .notDetermined:
                    self.infoLog("푸시 알림 권한 미설정 - 권한 요청 필요", category: "iOS")
                    
                case .ephemeral:
                    self.infoLog("임시 푸시 알림 권한", category: "iOS")
                    
                @unknown default:
                    self.debugLog("알 수 없는 푸시 알림 권한 상태", category: "iOS")
                }
            }
        }
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