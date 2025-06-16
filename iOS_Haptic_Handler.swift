// iOS WebView 햅틱 피드백 핸들러
// 이 코드를 iOS 프로젝트의 WebView 관련 파일에 추가하세요

import WebKit
import UIKit
import os.log

extension YourWebViewClass: WKScriptMessageHandler {
    
    // MARK: - 로그 카테고리 정의
    private static let hapticLog = OSLog(subsystem: "com.smap.app", category: "Haptic")
    private static let webviewLog = OSLog(subsystem: "com.smap.app", category: "WebView")
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        // 📱 WebView 메시지 수신 로그
        os_log("📱 [WebView] 메시지 수신: %{public}@", log: Self.webviewLog, type: .info, message.name)
        
        if message.name == "smapIos" {
            guard let body = message.body as? [String: Any] else {
                os_log("❌ [WebView] 메시지 본문 파싱 실패: %{public}@", log: Self.webviewLog, type: .error, String(describing: message.body))
                print("❌ [WebView] 메시지 본문 파싱 실패: \(message.body)")
                return
            }
            
            let type = body["type"] as? String ?? "unknown"
            let param = body["param"]
            
            // 📊 메시지 구조 로그
            print("📊 [WebView] 메시지 구조:")
            print("   ├─ 타입: \(type)")
            print("   ├─ 파라미터: \(String(describing: param))")
            print("   └─ 시간: \(Date().formatted(date: .omitted, time: .standard))")
            
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
            
            // JS 로그 메시지 처리
            if type == "jsLog" {
                handleJSLog(param: param)
                return
            }
            
            // 기존 다른 메시지들...
            if type == "googleSignIn" {
                os_log("🔐 [Auth] Google 로그인 요청", log: Self.webviewLog, type: .info)
                print("🔐 [Auth] Google 로그인 요청")
                handleGoogleSignIn()
                return
            }
            
            // 알 수 없는 메시지 타입
            os_log("⚠️ [WebView] 알 수 없는 메시지 타입: %{public}@", log: Self.webviewLog, type: .default, type)
            print("⚠️ [WebView] 알 수 없는 메시지 타입: \(type)")
        }
    }
    
    // MARK: - JS 로그 처리
    private func handleJSLog(param: Any?) {
        guard let paramString = param as? String,
              let data = paramString.data(using: .utf8),
              let logData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            print("❌ [JS Log] 파싱 실패: \(String(describing: param))")
            return
        }
        
        let level = logData["level"] as? String ?? "info"
        let message = logData["message"] as? String ?? ""
        let timestamp = logData["timestamp"] as? String ?? ""
        let environment = logData["environment"] as? String ?? ""
        
        // 레벨별 이모지 및 색상 구분
        let levelEmoji: String
        let logType: OSLogType
        
        switch level.lowercased() {
        case "error":
            levelEmoji = "🔴"
            logType = .error
        case "warn", "warning":
            levelEmoji = "🟡"
            logType = .default
        case "info":
            levelEmoji = "🔵"
            logType = .info
        case "debug":
            levelEmoji = "🟣"
            logType = .debug
        default:
            levelEmoji = "⚪"
            logType = .default
        }
        
        // Xcode 콘솔에서 보기 좋은 구조화된 로그
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("\(levelEmoji) [JS Log] \(level.uppercased())")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📝 메시지: \(message)")
        if !timestamp.isEmpty {
            print("⏰ 시간: \(timestamp)")
        }
        if !environment.isEmpty {
            print("🌍 환경: \(environment)")
        }
        
        // 햅틱 관련 메시지인 경우 추가 파싱
        if message.contains("햅틱") || message.contains("haptic") || message.contains("피드백") {
            print("🎮 햅틱 관련 로그 감지됨")
            parseHapticMessage(message)
        }
        
        // 전체 JSON 데이터 (축약)
        if let prettyData = try? JSONSerialization.data(withJSONObject: logData, options: .prettyPrinted),
           let prettyString = String(data: prettyData, encoding: .utf8) {
            print("📄 전체 데이터:")
            print(prettyString.prefix(500)) // 500자까지만 표시
            if prettyString.count > 500 {
                print("... (데이터 축약됨)")
            }
        }
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        // os_log로도 기록
        os_log("%{public}@ [JS] %{public}@: %{public}@", log: Self.webviewLog, type: logType, levelEmoji, level.uppercased(), message)
    }
    
    // MARK: - 햅틱 메시지 파싱
    private func parseHapticMessage(_ message: String) {
        // 햅틱 타입 추출
        let hapticTypes = ["light", "medium", "heavy", "success", "warning", "error", "selection"]
        for type in hapticTypes {
            if message.lowercased().contains(type) {
                print("🎯 감지된 햅틱 타입: \(type)")
                break
            }
        }
        
        // 컨텍스트 정보 추출
        if message.contains("BottomNavBar") {
            print("📍 위치: 하단 네비게이션 바")
        }
        if message.contains("menuSelect") {
            print("🎮 액션: 메뉴 선택")
        }
        if message.contains("page:") {
            let components = message.components(separatedBy: "page:")
            if components.count > 1 {
                let page = components[1].components(separatedBy: ",").first?.trimmingCharacters(in: .whitespaces) ?? ""
                print("📄 페이지: \(page)")
            }
        }
    }
    
    // MARK: - 햅틱 피드백 처리
    private func handleHapticFeedback(param: Any?) {
        // 처리 시작 로그
        os_log("🎮 [Haptic] 햅틱 피드백 처리 시작", log: Self.hapticLog, type: .info)
        print("🎮 [Haptic] 햅틱 피드백 처리 시작")
        
        if let paramString = param as? String,
           let data = paramString.data(using: .utf8),
           let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            
            // JSON 형태의 햅틱 데이터 처리
            let feedbackType = hapticData["feedbackType"] as? String ?? "unknown"
            let description = hapticData["description"] as? String ?? "설명 없음"
            let component = hapticData["component"] as? String ?? "알 수 없음"
            let context = hapticData["context"] as? [String: Any] ?? [:]
            
            // 상세 로그 출력
            print("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
            print("┃ 🎮 햅틱 피드백 상세 정보                                                      ┃")
            print("┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫")
            print("┃ 🎯 타입: \(feedbackType.padding(toLength: 20, withPad: " ", startingAt: 0))                                      ┃")
            print("┃ 📝 설명: \(description.padding(toLength: 50, withPad: " ", startingAt: 0).prefix(50))┃")
            print("┃ 🏗️ 컴포넌트: \(component.padding(toLength: 40, withPad: " ", startingAt: 0).prefix(40))         ┃")
            print("┃ ⏰ 시간: \(Date().formatted(date: .omitted, time: .standard).padding(toLength: 20, withPad: " ", startingAt: 0))                                      ┃")
            
            // 컨텍스트 정보 출력
            if !context.isEmpty {
                print("┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫")
                print("┃ 📋 컨텍스트 정보:                                                            ┃")
                for (key, value) in context {
                    let valueStr = String(describing: value).prefix(40)
                    print("┃   • \(key): \(valueStr)".padding(toLength: 79, withPad: " ", startingAt: 0)+"┃")
                }
            }
            print("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
            
            // os_log로도 기록
            os_log("🎯 [Haptic] 타입: %{public}@, 설명: %{public}@, 컴포넌트: %{public}@", log: Self.hapticLog, type: .info, feedbackType, description, component)
            
            triggerHaptic(type: feedbackType)
            
        } else if let hapticType = param as? String {
            // 단순 문자열 형태의 햅틱 타입 처리
            print("🎮 [Haptic] 단순 햅틱 요청: \(hapticType)")
            os_log("🎮 [Haptic] 단순 햅틱 요청: %{public}@", log: Self.hapticLog, type: .info, hapticType)
            triggerHaptic(type: hapticType)
        } else {
            print("❌ [Haptic] 햅틱 파라미터 파싱 실패: \(String(describing: param))")
            os_log("❌ [Haptic] 햅틱 파라미터 파싱 실패", log: Self.hapticLog, type: .error)
        }
    }
    
    // MARK: - 햅틱 실행
    private func triggerHaptic(type: String) {
        let startTime = Date()
        
        DispatchQueue.main.async {
            let hapticEmoji: String
            let hapticDescription: String
            
            switch type.lowercased() {
            case "light", "selection":
                self.triggerLightHaptic()
                hapticEmoji = "💡"
                hapticDescription = "Light (네비게이션, 선택)"
                
            case "medium":
                self.triggerMediumHaptic()
                hapticEmoji = "🔷"
                hapticDescription = "Medium (버튼, 토글)"
                
            case "heavy", "error":
                self.triggerHeavyHaptic()
                hapticEmoji = "🔶"
                hapticDescription = "Heavy (중요 액션)"
                
            case "success":
                self.triggerSuccessHaptic()
                hapticEmoji = "✅"
                hapticDescription = "Success (완료, 성공)"
                
            case "warning":
                self.triggerWarningHaptic()
                hapticEmoji = "⚠️"
                hapticDescription = "Warning (주의)"
                
            default:
                print("⚠️ [Haptic] 알 수 없는 햅틱 타입: \(type) → Medium으로 대체")
                os_log("⚠️ [Haptic] 알 수 없는 햅틱 타입: %{public}@ → Medium으로 대체", log: Self.hapticLog, type: .default, type)
                self.triggerMediumHaptic()
                hapticEmoji = "🔷"
                hapticDescription = "Medium (기본값)"
            }
            
            let executionTime = Date().timeIntervalSince(startTime) * 1000 // ms
            
            print("✨ [Haptic] \(hapticEmoji) \(hapticDescription) 실행 완료 (소요시간: \(String(format: "%.1f", executionTime))ms)")
            os_log("✨ [Haptic] %{public}@ %{public}@ 실행 완료 (소요시간: %.1fms)", log: Self.hapticLog, type: .info, hapticEmoji, hapticDescription, executionTime)
        }
    }
    
    // MARK: - 개별 햅틱 함수들
    private func triggerLightHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
    }
    
    private func triggerMediumHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
    }
    
    private func triggerHeavyHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.prepare()
        impactFeedback.impactOccurred()
    }
    
    private func triggerSuccessHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.success)
    }
    
    private func triggerWarningHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.warning)
    }
    
    private func triggerErrorHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.prepare()
        notificationFeedback.notificationOccurred(.error)
    }
    
    private func triggerSelectionHaptic() {
        let selectionFeedback = UISelectionFeedbackGenerator()
        selectionFeedback.prepare()
        selectionFeedback.selectionChanged()
    }
}

// MARK: - WebView 설정 확장
extension YourWebViewClass {
    
    func setupWebViewMessageHandlers() {
        // 메시지 핸들러 등록
        webView.configuration.userContentController.add(self, name: "smapIos")
        
        // 설정 완료 로그
        os_log("📱 [WebView] 메시지 핸들러 등록 완료", log: OSLog(subsystem: "com.smap.app", category: "WebView"), type: .info)
        print("📱 [WebView] 메시지 핸들러 등록 완료")
        
        // 햅틱 피드백 허용 설정
        if #available(iOS 13.0, *) {
            print("🎮 [Haptic] iOS 13+ 햅틱 기능 사용 가능")
        } else {
            print("⚠️ [Haptic] iOS 버전이 낮아 일부 햅틱 기능 제한됨")
        }
    }
    
    func cleanupWebViewMessageHandlers() {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "smapIos")
        print("🧹 [WebView] 메시지 핸들러 정리 완료")
    }
}

/*
사용법:

1. viewDidLoad에서:
```swift
override func viewDidLoad() {
    super.viewDidLoad()
    setupWebViewMessageHandlers()
}
```

2. deinit에서:
```swift
deinit {
    cleanupWebViewMessageHandlers()
}
```

3. Xcode 콘솔에서 로그 필터링:
   - 🎮 [Haptic]: 햅틱 관련 로그만
   - 📱 [WebView]: WebView 관련 로그만
   - 🔴/🟡/🔵: JS 로그 레벨별 필터링
   - ━━━: JS 로그 구분선으로 쉬운 식별
*/ 