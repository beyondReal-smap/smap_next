# iOS 햅틱 피드백 디버깅 체크리스트 🔍

## 🚨 햅틱이 작동하지 않을 때 즉시 확인할 것들

### 1. **Xcode 콘솔 확인**
```
// 이 로그들이 보여야 합니다:
🔵 [iOS DEBUG] 메시지 수신 시작
🔵 [iOS DEBUG] 메시지 이름: smapIos
🔵 [iOS DEBUG] 메시지 본문: {...}
🔵 [iOS] 메시지 타입: hapticFeedback
✅ [iOS] Success 햅틱 실행 완료
```

### 2. **메시지 핸들러 등록 확인**
```swift
// viewDidLoad에 이 코드가 있어야 합니다:
webView.configuration.userContentController.add(self, name: "smapIos")

// 로그 확인:
print("✅ [iOS] 모든 메시지 핸들러 등록 완료")
```

### 3. **물리 디바이스 사용**
- ❌ **시뮬레이터**: 햅틱 작동 안함
- ✅ **실제 iPhone**: 햅틱 작동함
- ⚠️ **iPad**: 제한적 햅틱

### 4. **iOS 버전 확인**
```swift
// iOS 10.0+ 필요
guard #available(iOS 10.0, *) else {
    print("⚠️ [iOS] 햅틱 미지원 iOS 버전")
    return
}
```

### 5. **함수 구현 확인**
```swift
// 이 함수들이 구현되어 있어야 합니다:
func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage)
private func handleSmapIosMessage(_ message: WKScriptMessage)
private func triggerHaptic(type: String)
private func triggerSuccessHaptic()
```

## 🔧 즉시 해결책

### 메시지가 안 오는 경우
```swift
// 1. 핸들러 다시 등록
userContentController.removeScriptMessageHandler(forName: "smapIos")
userContentController.add(self, name: "smapIos")

// 2. 모든 메시지 로깅 추가
func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    print("🔍 모든 메시지: \(message.name) - \(message.body)")
    // 기존 로직...
}
```

### 햅틱이 안 느껴지는 경우
```swift
// 1. 강제로 햅틱 테스트
private func testAllHaptics() {
    DispatchQueue.main.async {
        // 1초 간격으로 모든 햅틱 테스트
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            let light = UIImpactFeedbackGenerator(style: .light)
            light.impactOccurred()
            print("✅ Light 햅틱 테스트")
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            let medium = UIImpactFeedbackGenerator(style: .medium)
            medium.impactOccurred()
            print("✅ Medium 햅틱 테스트")
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            let heavy = UIImpactFeedbackGenerator(style: .heavy)
            heavy.impactOccurred()
            print("✅ Heavy 햅틱 테스트")
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            let success = UINotificationFeedbackGenerator()
            success.notificationOccurred(.success)
            print("✅ Success 햅틱 테스트")
        }
    }
}

// viewDidLoad에서 호출:
override func viewDidLoad() {
    super.viewDidLoad()
    // ... 기존 설정 ...
    
    // 햅틱 테스트 (디버그용)
    #if DEBUG
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
        testAllHaptics()
    }
    #endif
}
```

### JavaScript에서 메시지 안 보내는 경우
```javascript
// 개발자 도구 콘솔에서 직접 테스트:
if (window.webkit?.messageHandlers?.smapIos) {
    window.webkit.messageHandlers.smapIos.postMessage({
        type: 'haptic',
        param: 'success'
    });
    console.log('햅틱 메시지 전송 완료');
} else {
    console.log('smapIos 핸들러 없음');
}
```

## 🛠️ 단계별 디버깅

### Step 1: 기본 통신 확인
```swift
func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    print("🔵 메시지 수신: \(message.name)")
    
    if message.name == "smapIos" {
        print("✅ smapIos 메시지 확인")
        
        // 즉시 햅틱 테스트
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            print("✅ 강제 햅틱 실행")
        }
    }
}
```

### Step 2: 메시지 파싱 확인
```swift
guard let body = message.body as? [String: Any] else {
    print("❌ 파싱 실패: \(message.body)")
    print("❌ 타입: \(type(of: message.body))")
    return
}

let type = body["type"] as? String ?? ""
print("✅ 메시지 타입: \(type)")
```

### Step 3: 햅틱 실행 확인
```swift
private func triggerHaptic(type: String) {
    print("🎯 햅틱 요청: \(type)")
    
    DispatchQueue.main.async {
        print("📱 디바이스: \(UIDevice.current.userInterfaceIdiom)")
        
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
            print("✅ 햅틱 실행 완료!")
        } else {
            print("❌ iOS 버전 미지원")
        }
    }
}
```

## 🎯 성공 패턴

### 완벽하게 작동하는 경우 로그:
```
🔵 [iOS DEBUG] 메시지 수신 시작
🔵 [iOS DEBUG] 메시지 이름: smapIos
🔵 [iOS DEBUG] 메시지 본문: {type = hapticFeedback; param = "{\"feedbackType\":\"success\",\"description\":\"데이터 로딩 완료\"}";}
🔵 [iOS] smapIos 메시지 처리 시작
🔵 [iOS] 메시지 타입: hapticFeedback
🔵 [iOS] 햅틱 피드백 요청 받음
🔵 [iOS] JSON 햅틱 데이터:
🔵 [iOS] - 타입: success
🔵 [iOS] - 설명: 데이터 로딩 완료
🔵 [iOS] 햅틱 실행 요청: success
✅ [iOS] Success 햅틱 실행 완료
```

## 🚀 빠른 테스트 코드

### 5초 만에 테스트하기:
```swift
// AppDelegate.swift 또는 SceneDelegate.swift에 추가:
#if DEBUG
override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
    if motion == .motionShake {
        // 디바이스 흔들면 모든 햅틱 테스트
        testAllHapticsQuick()
    }
}

private func testAllHapticsQuick() {
    let types = ["light", "medium", "heavy", "success", "warning", "error"]
    
    for (index, type) in types.enumerated() {
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(index)) {
            self.triggerHaptic(type: type)
        }
    }
}
#endif
```

## ⚡ 원라인 해결책들

```swift
// 1. 즉시 햅틱 테스트
UIImpactFeedbackGenerator(style: .heavy).impactOccurred()

// 2. 메시지 핸들러 재등록
webView.configuration.userContentController.add(self, name: "smapIos")

// 3. 강제 로깅
print("모든 메시지: \(message.name) - \(message.body)")

// 4. JavaScript 직접 테스트
// 개발자 도구에서: window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'success'})
```

완료! 이제 햅틱이 작동하지 않을 때 5분 안에 문제를 찾을 수 있습니다! 🎯 