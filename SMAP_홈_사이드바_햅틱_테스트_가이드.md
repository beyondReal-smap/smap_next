# 🏠 SMAP 홈 사이드바 햅틱 피드백 테스트 가이드

## 📋 개요
홈 페이지(home/page.tsx)에서 사이드바 열기/닫기 시 햅틱 피드백이 제대로 동작하는지 테스트하는 가이드입니다.

## 🎯 구현된 기능

### 🔷 사이드바 열기 햅틱
- **타입**: Medium Impact
- **트리거**: 사이드바 열기 버튼 클릭
- **함수**: `hapticFeedback.homeSidebarOpen()`
- **설명**: 사이드바가 열릴 때 중간 강도의 햅틱 피드백

### 💡 사이드바 닫기 햅틱
- **타입**: Light Impact  
- **트리거**: 
  - 사이드바 열기 버튼 다시 클릭 (토글)
  - 사이드바 외부 영역 클릭
- **함수**: `hapticFeedback.homeSidebarClose()`
- **설명**: 사이드바가 닫힐 때 가벼운 햅틱 피드백

## 🧪 테스트 방법

### 1️⃣ 실제 iOS 앱에서 테스트

#### Step 1: iOS 앱 실행
```bash
# iOS 프로젝트 빌드 및 실행
cd iOS
open smap.xcworkspace
# Xcode에서 실제 iPhone 디바이스로 빌드 및 실행
```

#### Step 2: 홈 페이지 접속
- 앱이 시작되면 자동으로 홈 페이지로 이동
- 우상단에 사이드바 버튼(≡) 확인

#### Step 3: 사이드바 햅틱 테스트
1. **사이드바 열기 테스트**
   - 우상단 사이드바 버튼 클릭
   - Medium 햅틱 피드백 확인 (중간 강도 진동)
   
2. **사이드바 닫기 테스트 (버튼)**
   - 사이드바 버튼 다시 클릭 (토글)
   - Light 햅틱 피드백 확인 (가벼운 진동)
   
3. **사이드바 닫기 테스트 (외부 클릭)**
   - 사이드바를 열고
   - 사이드바 외부 영역 클릭
   - Light 햅틱 피드백 확인

### 2️⃣ Xcode 콘솔 로그 확인

#### 로그 필터링
Xcode 콘솔에서 다음 필터로 검색:
```
🏠 [HAPTIC-HOME]
🎮 [SMAP-HAPTIC]
⚡ [HAPTIC-EXECUTE
🔥 [HAPTIC-
```

#### 예상 로그 (사이드바 열기)
```
🏠🔷 [HAPTIC-HOME] 사이드바 열기 - Medium 햅틱 피드백
🎮 [SMAP-HAPTIC] [HH:mm:ss.SSS] 햅틱 피드백 요청 수신
🎯 타입: medium
📝 설명: 홈 사이드바 열기
🏗️ 컴포넌트: home-sidebar
⚡ [HAPTIC-EXECUTE-MEDIUM] Generator 생성 중...
⚡ [HAPTIC-EXECUTE-MEDIUM] 햅틱 실행 완료 (실행시간: XXms)
```

#### 예상 로그 (사이드바 닫기)
```
🏠💡 [HAPTIC-HOME] 사이드바 닫기 - Light 햅틱 피드백  
🎮 [SMAP-HAPTIC] [HH:mm:ss.SSS] 햅틱 피드백 요청 수신
🎯 타입: light
📝 설명: 홈 사이드바 닫기
🏗️ 컴포넌트: home-sidebar
⚡ [HAPTIC-EXECUTE-LIGHT] Generator 생성 중...
⚡ [HAPTIC-EXECUTE-LIGHT] 햅틱 실행 완료 (실행시간: XXms)
```

### 3️⃣ 웹 콘솔에서 직접 테스트

#### 브라우저 개발자 도구에서
```javascript
// 사이드바 열기 햅틱 테스트
SMAP_HOME_SIDEBAR_OPEN()

// 사이드바 닫기 햅틱 테스트  
SMAP_HOME_SIDEBAR_CLOSE()

// 일반 햅틱 함수들
hapticMedium()  // 중간 강도
hapticLight()   // 가벼운 강도

// 전체 햅틱 테스트
SMAP_TEST_ALL_HAPTICS_DEV()
```

## 🔧 문제 해결

### ❌ 햅틱이 작동하지 않는 경우

#### 1. 디바이스 확인
- ✅ **실제 iPhone 디바이스 사용** (시뮬레이터에서는 햅틱 미지원)
- ✅ iOS 10.0 이상 확인
- ✅ 디바이스 설정 > 사운드 및 햅틱 > 시스템 햅틱 ON

#### 2. iOS 앱 실행 확인
- ✅ Safari 브라우저가 아닌 실제 iOS 앱에서 실행
- ✅ WebViewController의 메시지 핸들러 등록 확인

#### 3. Xcode 콘솔 확인
```
📱 [SMAP-iOS] WebView 메시지 수신
📨 [MESSAGE-HANDLER] haptic 메시지 처리
```
위 로그가 보이지 않으면 메시지 핸들러 연결 문제

### ⚠️ 부분적으로만 작동하는 경우

#### JavaScript → iOS 통신 문제
1. 웹 콘솔에서 핸들러 상태 확인:
```javascript
SMAP_CHECK_HANDLERS()
```

2. 직접 메시지 전송 테스트:
```javascript
window.webkit.messageHandlers.smapIos.postMessage({
  type: 'haptic', 
  param: 'medium'
})
```

#### 햅틱 타입별 테스트
```javascript
// 각 타입별 개별 테스트
window.smapHaptic('light')
window.smapHaptic('medium') 
window.smapHaptic('heavy')
window.smapHaptic('success')
```

## 📊 성능 체크

### 응답 속도 확인
- 햅틱 피드백은 터치 후 **100ms 이내**에 실행되어야 함
- Xcode 콘솔에서 실행 시간 확인:
```
⚡ 실행 시간: XX.XXms
🕐 총 처리 시간: XX.XXms
```

### 메모리 사용량
- UIImpactFeedbackGenerator가 매번 새로 생성되므로 메모리 누수 없음
- prepare() → impactOccurred() → 자동 해제

## 🎯 추가 테스트 시나리오

### 연속 햅틱 테스트
```javascript
// 빠른 연속 햅틱 (0.1초 간격)
for(let i = 0; i < 5; i++) {
  setTimeout(() => hapticLight(), i * 100);
}
```

### 다양한 패턴 테스트
```javascript
// 사이드바 열기 → 닫기 패턴
setTimeout(() => SMAP_HOME_SIDEBAR_OPEN(), 0);
setTimeout(() => SMAP_HOME_SIDEBAR_CLOSE(), 500);
```

## 📱 지원 기기 및 OS

### ✅ 지원 기기
- iPhone 6s 이상 (모든 iPhone)
- iOS 10.0 이상

### ❌ 미지원
- iPad (제한적 햅틱 지원)
- iPod Touch (햅틱 미지원)
- iOS 시뮬레이터 (햅틱 미지원)

## 🚀 최적화 팁

1. **실제 디바이스 테스트**: 시뮬레이터에서는 햅틱이 작동하지 않습니다
2. **로그 확인**: Xcode 콘솔로 실행 과정을 모니터링하세요
3. **타이밍 중요**: 사용자 인터랙션과 햅틱 사이의 지연을 최소화하세요
4. **적절한 강도**: 사이드바 열기(Medium), 닫기(Light)로 차별화하세요

---

**💡 참고**: 이 테스트는 home/page.tsx의 사이드바 햅틱에 특화되어 있습니다. 다른 페이지의 햅틱 테스트는 별도 가이드를 참조하세요. 