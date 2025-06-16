// iOS WebView 햅틱 피드백 핸들러 - Xcode IDE 최적화 버전
// 이 코드를 iOS 프로젝트의 WebView 관련 파일에 추가하세요

import WebKit
import UIKit
import os.log

extension YourWebViewClass: WKScriptMessageHandler {
    
    // MARK: - 🏷️ OSLog 카테고리 정의 (Xcode 필터링용)
    private static let hapticLog = OSLog(subsystem: "com.smap.app", category: "🎮_Haptic")
    private static let webviewLog = OSLog(subsystem: "com.smap.app", category: "📱_WebView")
    private static let jsLog = OSLog(subsystem: "com.smap.app", category: "🟨_JavaScript")
    private static let performanceLog = OSLog(subsystem: "com.smap.app", category: "⚡_Performance")
    private static let errorLog = OSLog(subsystem: "com.smap.app", category: "🔴_Error")
    
    // MARK: - 📊 성능 측정을 위한 전역 변수
    private var messageStartTime: Date?
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        messageStartTime = Date()
        
        // 🎯 Xcode 콘솔 구분선 - 각 메시지의 시작점 표시
        let timestamp = DateFormatter().apply {
            $0.dateFormat = "HH:mm:ss.SSS"
        }.string(from: Date())
        
        print("\n🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽")
        print("📱 [SMAP-iOS] WebView 메시지 수신 | ⏰ \(timestamp)")
        print("🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼🔼")
        
        // OSLog로 메시지 수신 기록
        os_log("📱 [WebView] 메시지 수신 시작: %{public}@", log: Self.webviewLog, type: .info, message.name)
        
        guard message.name == "smapIos" else {
            logError("알 수 없는 메시지 핸들러: \(message.name)")
            return
        }
        
        guard let body = message.body as? [String: Any] else {
            logError("메시지 본문 파싱 실패: \(String(describing: message.body))")
            return
        }
        
        let type = body["type"] as? String ?? "unknown"
        let param = body["param"]
        
        // 📊 메시지 구조 로그 (Xcode에서 읽기 쉬운 형태)
        logMessageStructure(type: type, param: param)
        
        // 타입별 처리
        switch type {
        case "hapticFeedback":
            handleAdvancedHapticFeedback(param: param)
        case "haptic":
            handleSimpleHaptic(param: param)
        case "jsLog":
            handleJavaScriptLog(param: param)
        case "googleSignIn":
            handleGoogleSignIn()
        default:
            logWarning("알 수 없는 메시지 타입: \(type)")
        }
        
        // 메시지 처리 완료 및 성능 로깅
        logMessageCompletion()
    }
    
    // MARK: - 📊 구조화된 로그 함수들
    
    private func logMessageStructure(type: String, param: Any?) {
        print("┌─────────────────────────────────────────────────────────────────────────────┐")
        print("│ 📋 [메시지 구조]                                                              │")
        print("├─────────────────────────────────────────────────────────────────────────────┤")
        print("│ 🎯 타입: \(type.padding(toLength: 20, withPad: " ", startingAt: 0))                                              │")
        print("│ 📦 파라미터: \(String(describing: param).prefix(50).padding(toLength: 50, withPad: " ", startingAt: 0))     │")
        print("│ ⏰ 수신시간: \(Date().formatted(date: .omitted, time: .standard))                                              │")
        print("└─────────────────────────────────────────────────────────────────────────────┘")
        
        os_log("📋 [Structure] 타입: %{public}@, 파라미터: %{public}@", log: Self.webviewLog, type: .default, type, String(describing: param))
    }
    
    private func logError(_ message: String) {
        print("🚨 [ERROR] \(message)")
        os_log("🚨 [Error] %{public}@", log: Self.errorLog, type: .error, message)
    }
    
    private func logWarning(_ message: String) {
        print("⚠️ [WARNING] \(message)")
        os_log("⚠️ [Warning] %{public}@", log: Self.webviewLog, type: .default, message)
    }
    
    private func logMessageCompletion() {
        if let startTime = messageStartTime {
            let processingTime = Date().timeIntervalSince(startTime) * 1000
            print("✅ [COMPLETED] 메시지 처리 완료 (⚡ \(String(format: "%.2f", processingTime))ms)")
            os_log("✅ [Performance] 메시지 처리 완료: %.2fms", log: Self.performanceLog, type: .info, processingTime)
        }
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    }
    
    // MARK: - 🔧 JavaScript 로그 처리 (개선된 파싱)
    private func handleJavaScriptLog(param: Any?) {
        guard let paramString = param as? String,
              let data = paramString.data(using: .utf8),
              let logData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            logError("JS 로그 파싱 실패: \(String(describing: param))")
            return
        }
        
        let level = logData["level"] as? String ?? "info"
        let message = logData["message"] as? String ?? ""
        let timestamp = logData["timestamp"] as? String ?? ""
        let environment = logData["environment"] as? String ?? ""
        
        // 레벨별 시각적 구분
        let (levelEmoji, logType, priority) = getLogLevelInfo(level)
        
        // Xcode 콘솔에서 눈에 띄는 JavaScript 로그
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ \(levelEmoji) [JS-\(level.uppercased())] JavaScript 로그                                                ║")
        print("╠═══════════════════════════════════════════════════════════════════════════════╣")
        print("║ 💬 메시지: \(truncateForDisplay(message, maxLength: 60))                         ║")
        
        if !timestamp.isEmpty {
            print("║ 🕐 JS 시간: \(timestamp.padding(toLength: 60, withPad: " ", startingAt: 0))                   ║")
        }
        if !environment.isEmpty {
            print("║ 🌍 환경: \(environment.padding(toLength: 60, withPad: " ", startingAt: 0))                      ║")
        }
        
        // 햅틱 관련 메시지 특별 처리
        if isHapticRelatedMessage(message) {
            print("╠═══════════════════════════════════════════════════════════════════════════════╣")
            print("║ 🎮 [HAPTIC] 햅틱 관련 메시지 감지                                              ║")
            analyzeHapticMessage(message)
        }
        
        // 전체 JSON 미리보기 (축약)
        if let prettyData = try? JSONSerialization.data(withJSONObject: logData, options: .prettyPrinted),
           let prettyString = String(data: prettyData, encoding: .utf8) {
            print("╠═══════════════════════════════════════════════════════════════════════════════╣")
            print("║ 📄 JSON 데이터 (축약):                                                         ║")
            let lines = prettyString.components(separatedBy: .newlines).prefix(5)
            for line in lines {
                let displayLine = truncateForDisplay(line, maxLength: 70)
                print("║ \(displayLine.padding(toLength: 70, withPad: " ", startingAt: 0))         ║")
            }
            if prettyString.components(separatedBy: .newlines).count > 5 {
                print("║ ... (더 많은 데이터 생략됨)                                                    ║")
            }
        }
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // OSLog로 구조화된 로깅
        os_log("%{public}@ [JS-%{public}@] %{public}@", log: Self.jsLog, type: logType, levelEmoji, level.uppercased(), message)
    }
    
    private func getLogLevelInfo(_ level: String) -> (emoji: String, logType: OSLogType, priority: String) {
        switch level.lowercased() {
        case "error":
            return ("🔴", .error, "HIGH")
        case "warn", "warning":
            return ("🟡", .default, "MEDIUM")
        case "info":
            return ("🔵", .info, "NORMAL")
        case "debug":
            return ("🟣", .debug, "LOW")
        default:
            return ("⚪", .default, "NORMAL")
        }
    }
    
    private func isHapticRelatedMessage(_ message: String) -> Bool {
        let hapticKeywords = ["햅틱", "haptic", "피드백", "feedback", "vibration", "진동"]
        return hapticKeywords.contains { message.lowercased().contains($0.lowercased()) }
    }
    
    private func analyzeHapticMessage(_ message: String) {
        // 햅틱 타입 감지
        let hapticTypes = ["light", "medium", "heavy", "success", "warning", "error", "selection"]
        for type in hapticTypes {
            if message.lowercased().contains(type) {
                print("║ 🎯 감지된 햅틱 타입: \(type.uppercased())                                               ║")
                break
            }
        }
        
        // 컴포넌트 감지
        if message.contains("BottomNavBar") {
            print("║ 📍 컴포넌트: 하단 네비게이션 바                                                ║")
        }
        if message.contains("menuSelect") {
            print("║ 🎮 액션: 메뉴 선택                                                            ║")
        }
        
        // 페이지 정보 추출
        if message.contains("page:") {
            let components = message.components(separatedBy: "page:")
            if components.count > 1 {
                let page = components[1].components(separatedBy: ",").first?.trimmingCharacters(in: .whitespaces) ?? ""
                print("║ 📄 페이지: \(page.padding(toLength: 50, withPad: " ", startingAt: 0))                           ║")
            }
        }
    }
    
    private func truncateForDisplay(_ text: String, maxLength: Int) -> String {
        if text.count <= maxLength {
            return text
        }
        return String(text.prefix(maxLength - 3)) + "..."
    }
    
    // MARK: - 🎮 향상된 햅틱 피드백 처리
    private func handleAdvancedHapticFeedback(param: Any?) {
        let hapticStartTime = Date()
        
        // 햅틱 처리 시작 로그
        print("🎮 [HAPTIC] ═══════════════════════════════════════════════════════════════════════")
        print("🎮 [HAPTIC] 햅틱 피드백 처리 시작")
        os_log("🎮 [Haptic] 햅틱 피드백 처리 시작", log: Self.hapticLog, type: .info)
        
        guard let paramString = param as? String,
              let data = paramString.data(using: .utf8),
              let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            logError("햅틱 데이터 파싱 실패: \(String(describing: param))")
            return
        }
        
        let feedbackType = hapticData["feedbackType"] as? String ?? "unknown"
        let description = hapticData["description"] as? String ?? "설명 없음"
        let component = hapticData["component"] as? String ?? "알 수 없음"
        let context = hapticData["context"] as? [String: Any] ?? [:]
        
        // 상세한 햅틱 정보 테이블
        displayHapticInfoTable(
            feedbackType: feedbackType,
            description: description,
            component: component,
            context: context,
            startTime: hapticStartTime
        )
        
        // OSLog로 구조화된 햅틱 로깅
        os_log("🎯 [Haptic] 타입:%{public}@ | 컴포넌트:%{public}@ | 설명:%{public}@", 
               log: Self.hapticLog, type: .info, feedbackType, component, description)
        
        // 햅틱 실행
        executeHapticFeedback(type: feedbackType, startTime: hapticStartTime)
    }
    
    private func displayHapticInfoTable(feedbackType: String, description: String, component: String, context: [String: Any], startTime: Date) {
        print("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
        print("┃ 🎮 HAPTIC FEEDBACK DETAILS                                                   ┃")
        print("┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫")
        print("┃ 🎯 타입      │ \(feedbackType.padding(toLength: 20, withPad: " ", startingAt: 0))                                    ┃")
        print("┃ 📝 설명      │ \(truncateForDisplay(description, maxLength: 50).padding(toLength: 50, withPad: " ", startingAt: 0))┃")
        print("┃ 🏗️ 컴포넌트  │ \(component.padding(toLength: 50, withPad: " ", startingAt: 0))                    ┃")
        print("┃ ⏰ 시간      │ \(Date().formatted(date: .omitted, time: .standard))                                    ┃")
        
        if !context.isEmpty {
            print("┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫")
            print("┃ 📋 CONTEXT INFO:                                                             ┃")
            for (key, value) in context.prefix(5) {  // 최대 5개만 표시
                let valueStr = String(describing: value)
                let displayValue = truncateForDisplay(valueStr, maxLength: 40)
                print("┃   • \(key.padding(toLength: 15, withPad: " ", startingAt: 0)) │ \(displayValue.padding(toLength: 40, withPad: " ", startingAt: 0))        ┃")
            }
            if context.count > 5 {
                print("┃   ... (추가 \(context.count - 5)개 항목 생략됨)                                               ┃")
            }
        }
        print("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
    }
    
    // MARK: - 🔧 단순 햅틱 처리
    private func handleSimpleHaptic(param: Any?) {
        if let hapticType = param as? String {
            print("🎮 [HAPTIC-SIMPLE] 단순 햅틱 요청: \(hapticType)")
            os_log("🎮 [Haptic] 단순 햅틱 요청: %{public}@", log: Self.hapticLog, type: .info, hapticType)
            executeHapticFeedback(type: hapticType, startTime: Date())
        } else {
            logError("햅틱 파라미터 파싱 실패: \(String(describing: param))")
        }
    }
    
    // MARK: - ⚡ 햅틱 실행 (성능 모니터링 포함)
    private func executeHapticFeedback(type: String, startTime: Date) {
        DispatchQueue.main.async {
            let executionStartTime = Date()
            let (hapticEmoji, hapticDescription) = self.getHapticTypeInfo(type)
            
            // 햅틱 실행
            self.performHapticByType(type)
            
            let totalTime = Date().timeIntervalSince(startTime) * 1000
            let executionTime = Date().timeIntervalSince(executionStartTime) * 1000
            
            // 성능 로그 (표 형태)
            print("┌─────────────────────────────────────────────────────────────────────────────┐")
            print("│ ✨ HAPTIC EXECUTION RESULT                                                  │")
            print("├─────────────────────────────────────────────────────────────────────────────┤")
            print("│ \(hapticEmoji) 타입: \(hapticDescription.padding(toLength: 30, withPad: " ", startingAt: 0))                                     │")
            print("│ ⚡ 총 처리시간: \(String(format: "%.2f", totalTime).padding(toLength: 8, withPad: " ", startingAt: 0))ms                                            │")
            print("│ 🚀 실행시간: \(String(format: "%.2f", executionTime).padding(toLength: 8, withPad: " ", startingAt: 0))ms                                              │")
            print("│ ✅ 상태: 성공                                                                 │")
            print("└─────────────────────────────────────────────────────────────────────────────┘")
            
            // OSLog 성능 로깅
            os_log("✨ [Haptic] %{public}@ %{public}@ 실행완료 | 총:%.2fms 실행:%.2fms", 
                   log: Self.hapticLog, type: .info, hapticEmoji, hapticDescription, totalTime, executionTime)
        }
    }
    
    private func getHapticTypeInfo(_ type: String) -> (emoji: String, description: String) {
        switch type.lowercased() {
        case "light", "selection":
            return ("💡", "Light (네비게이션, 선택)")
        case "medium":
            return ("🔷", "Medium (버튼, 토글)")
        case "heavy", "error":
            return ("🔶", "Heavy (중요 액션)")
        case "success":
            return ("✅", "Success (완료, 성공)")
        case "warning":
            return ("⚠️", "Warning (주의)")
        default:
            print("⚠️ [HAPTIC] 알 수 없는 햅틱 타입: \(type) → Medium으로 대체")
            return ("🔷", "Medium (기본값)")
        }
    }
    
    private func performHapticByType(_ type: String) {
        switch type.lowercased() {
        case "light", "selection":
            triggerLightHaptic()
        case "medium":
            triggerMediumHaptic()
        case "heavy", "error":
            triggerHeavyHaptic()
        case "success":
            triggerSuccessHaptic()
        case "warning":
            triggerWarningHaptic()
        default:
            triggerMediumHaptic()
        }
    }
    
    // MARK: - 🔧 Google 로그인 처리
    private func handleGoogleSignIn() {
        print("🔐 [AUTH] Google 로그인 요청 처리")
        os_log("🔐 [Auth] Google 로그인 요청", log: Self.webviewLog, type: .info)
        // 실제 Google 로그인 로직 구현
    }
    
    // MARK: - 🎮 개별 햅틱 함수들 (기존 유지)
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

// MARK: - 📱 WebView 설정 확장
extension YourWebViewClass {
    
    func setupWebViewMessageHandlers() {
        webView.configuration.userContentController.add(self, name: "smapIos")
        
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 📱 [SMAP-iOS] WebView 메시지 핸들러 설정 완료                                   ║")
        print("╠═══════════════════════════════════════════════════════════════════════════════╣")
        print("║ 🎮 햅틱 피드백: 활성화                                                          ║")
        print("║ 📱 WebView 통신: 준비 완료                                                      ║")
        print("║ 🔍 로그 필터링: Xcode 콘솔에서 다음 태그로 검색 가능                            ║")
        print("║   • 🎮_Haptic: 햅틱 관련 로그                                                   ║")
        print("║   • 📱_WebView: WebView 통신 로그                                               ║")
        print("║   • 🟨_JavaScript: JS 로그                                                      ║")
        print("║   • ⚡_Performance: 성능 메트릭                                                 ║")
        print("║   • 🔴_Error: 에러 로그                                                         ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        os_log("📱 [WebView] 메시지 핸들러 등록 완료", log: OSLog(subsystem: "com.smap.app", category: "📱_WebView"), type: .info)
        
        if #available(iOS 13.0, *) {
            print("🎮 [HAPTIC] iOS 13+ 햅틱 기능 사용 가능")
            os_log("🎮 [Haptic] iOS 13+ 햅틱 기능 사용 가능", log: OSLog(subsystem: "com.smap.app", category: "🎮_Haptic"), type: .info)
        } else {
            print("⚠️ [HAPTIC] iOS 버전이 낮아 일부 햅틱 기능 제한됨")
            os_log("⚠️ [Haptic] iOS 버전이 낮아 일부 햅틱 기능 제한됨", log: OSLog(subsystem: "com.smap.app", category: "🎮_Haptic"), type: .default)
        }
    }
    
    func cleanupWebViewMessageHandlers() {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "smapIos")
        print("🧹 [WebView] 메시지 핸들러 정리 완료")
        os_log("🧹 [WebView] 메시지 핸들러 정리 완료", log: OSLog(subsystem: "com.smap.app", category: "📱_WebView"), type: .info)
    }
}

/*
🏷️ Xcode IDE 콘솔에서 로그 필터링 방법:

1. Xcode → Window → Devices and Simulators
2. 디바이스 선택 → Open Console
3. 필터 검색창에 다음 태그 입력:

   📱 WebView 관련: "📱_WebView" 또는 "📱 [SMAP-iOS]"
   🎮 햅틱 관련: "🎮_Haptic" 또는 "🎮 [HAPTIC]"
   🟨 JS 로그: "🟨_JavaScript" 또는 "🔵" (info 레벨)
   🔴 에러만: "🔴_Error" 또는 "🚨 [ERROR]"
   ⚡ 성능: "⚡_Performance"

4. OSLog 카테고리별 필터링:
   - subsystem:com.smap.app category:🎮_Haptic
   - subsystem:com.smap.app category:📱_WebView

5. 시각적 구분선으로 메시지 단위 확인:
   - 🔽🔽🔽: 메시지 시작
   - ━━━━━: 메시지 완료
   - ╔══╗: 상세 정보 테이블

🎯 사용법:
1. viewDidLoad에서: setupWebViewMessageHandlers()
2. deinit에서: cleanupWebViewMessageHandlers()
*/ 
   - ━━━: JS 로그 구분선으로 쉬운 식별
*/ 