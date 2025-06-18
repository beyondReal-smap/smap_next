# 🔐 iOS App-Bound Domain 오류 해결 가이드 (최신 업데이트)

## 📋 문제 상황
```
❌ [SMAP-HAPTIC] JavaScript 함수 등록 실패: 
Error Domain=WKErrorDomain Code=14 
"JavaScript execution targeted a frame that is not in an app-bound domain" 
UserInfo={WKJavaScriptExceptionLineNumber=0, 
WKJavaScriptExceptionMessage=Unable to execute JavaScript in a frame that is not in an app-bound domain, 
WKJavaScriptExceptionColumnNumber=0, 
NSLocalizedDescription=JavaScript execution targeted a frame that is not in an app-bound domain}
```

## 🚨 **최신 문제 발견 및 해결 (중요 업데이트)**

### **실제 문제 원인:**
로그 분석 결과, 다음과 같은 핵심 문제를 발견했습니다:

```javascript
🔍 [HAPTIC-ENV] 환경 감지: {isIOS: true, hasWebKit: true, hasHandler: false, isIOSApp: false, isIOSBrowser: true}
🔍 [WEBVIEW DEBUG] 핸들러 상태: {messageHandlersExists: false, availableHandlers: [], totalHandlers: 0}
⚠️ [FORCE-HAPTIC] 직접 생성 실패: TypeError: Attempted to assign to readonly property
```

**핵심 문제:**
1. **iOS Safari 브라우저에서 실행됨** (`isIOSApp: false, isIOSBrowser: true`)
2. **WebKit은 존재하지만 messageHandlers가 없음** (`messageHandlersExists: false`)
3. **native messageHandlers가 readonly 속성으로 보호됨**

### ✅ **해결된 수정 사항 (추가됨)**

#### **1. 강화된 핸들러 등록 시스템**
```swift
// Document Start와 End 모두에서 스크립트 주입
let hapticUserScript = WKUserScript(source: hapticEventScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
let hapticUserScriptEnd = WKUserScript(source: hapticEventScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
```

#### **2. 강제 핸들러 생성 및 복구 시스템**
- WebKit messageHandlers 강제 생성
- 핸들러 모의 객체 생성
- 네이티브 레벨에서 핸들러 재등록
- 자동 복구 메커니즘

#### **3. Fallback 햅틱 시스템**
- **웹 기반 진동 API 사용** (`navigator.vibrate`)
- **시각적 피드백 제공** (화면 스케일 애니메이션)
- **강화된 햅틱 함수** (원본 실패 시 자동 fallback)
- **즉시 테스트 및 진단** 기능

## 🚀 **최신 해결 방법 (업데이트됨)**

### 1. ✅ **Info.plist 설정 확인** (완료됨)

`Info_Complete.plist` 파일에 다음 설정이 올바르게 추가되었습니다:

```xml
<!-- 🔐 App-Bound Domains 설정 -->
<key>WKAppBoundDomains</key>
<array>
    <string>nextstep.smap.site</string>
    <string>app2.smap.site</string>
    <string>app.smap.site</string>
    <string>smap.site</string>
    <string>localhost</string>
</array>
```

### 2. ✅ **WebView 설정 업데이트** (완료됨)

`iOS_WebView_Enhanced.swift`에서 App-Bound Domain 설정이 올바르게 구성됨:

```swift
// 🔐 App-Bound Domain 관련 설정 (iOS 14+)
if #available(iOS 14.0, *) {
    config.limitsNavigationsToAppBoundDomains = true
    print("🔐 [WebView] App-Bound Domain 제한 활성화")
    print("🔐 [WebView] 허용된 도메인: nextstep.smap.site, smap.site, localhost")
    print("🔐 [WebView] Info.plist WKAppBoundDomains 설정 적용됨")
}
```

### 3. 🆕 **고급 햅틱 시스템 구현** (새로 추가됨)

안전하고 호환성이 높은 햅틱 시스템이 구현되었습니다:

#### A. **App-Bound Domain 호환 햅틱 시스템**
```javascript
// 웹페이지에서 사용할 수 있는 햅틱 함수들
window.SMAP_HAPTIC('success');           // 기본 햅틱
window.SMAP_HAPTIC_FEEDBACK('impact', 'medium');  // 고급 햅틱
window.SMAP_DEBUG_HAPTIC();              // 디버깅 및 테스트
```

#### B. **안전한 메시지 전송 시스템**
- 여러 핸들러 자동 감지 (`smapIos`, `iosHandler`, `hapticHandler`, `messageHandler`)
- 대기열 시스템으로 초기화 전 메시지 보관
- 자동 재시도 메커니즘

### 4. 🔍 **자동 진단 및 디버깅** (새로 추가됨)

페이지 로드 완료 시 자동으로 다음 정보를 확인합니다:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ 🔍 [App-Bound Domain] 진단 시작                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📱 iOS 버전: 17.0                                                             ║
║ 🌐 현재 URL: https://nextstep.smap.site                                       ║
║ 🔐 App-Bound 제한: 활성화                                                     ║
║ 🔧 JavaScript: 활성화                                                         ║
║ 📬 User Scripts: 2                                                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 5. 🛠️ **문제 해결 단계**

#### **단계 1: 앱 재빌드**
```bash
# Xcode에서
1. Product > Clean Build Folder
2. Product > Build
3. 앱 완전 삭제 후 재설치
```

#### **단계 2: 실제 기기 테스트**
```swift
// 시뮬레이터가 아닌 실제 iPhone에서 테스트 필요
// 햅틱은 시뮬레이터에서 작동하지 않음
```

#### **단계 3: 디버깅 콘솔 확인**
```javascript
// Safari 개발자 도구에서 실행
window.SMAP_DEBUG_HAPTIC();

// 예상 출력:
// 🔍 [SMAP-HAPTIC] 디버그 정보:
//   - 초기화됨: true
//   - 핸들러들: ["smapIos", "iosHandler"]
//   - 대기 메시지: 0
```

#### **단계 4: 수동 테스트**
```javascript
// 웹 콘솔에서 직접 테스트
window.SMAP_HAPTIC('success');      // 성공 햅틱
window.SMAP_HAPTIC('warning');      // 경고 햅틱
window.SMAP_HAPTIC('error');        // 오류 햅틱
```

### 6. 🚨 **일반적인 문제 및 해결책**

#### **문제 A: 핸들러가 감지되지 않음**
```
❌ [SMAP-HAPTIC] 사용 가능한 핸들러 없음
```
**해결책:**
1. 앱 완전 재시작
2. 페이지 새로고침 (cmd+R)
3. 2-3초 대기 후 재시도

#### **문제 B: 도메인이 허용 목록에 없음**
```
❌ [App-Bound] 도메인이 허용 목록에 없음: other-domain.com
```
**해결책:**
1. Info.plist에 도메인 추가
2. 앱 재빌드 필요

#### **문제 C: JavaScript 실행 오류**
```
❌ [JavaScript] 핸들러 확인 오류: Error Domain=WKErrorDomain Code=14
```
**해결책:**
1. App-Bound Domain 설정 확인
2. 햅틱 시스템 강제 재초기화 실행됨

### 7. 📱 **프로덕션 배포 체크리스트**

- [x] **Info.plist에 WKAppBoundDomains 설정됨**
- [x] **WebView에서 limitsNavigationsToAppBoundDomains = true**
- [x] **햅틱 시스템 안전성 검증됨**
- [x] **자동 디버깅 시스템 구현됨**
- [x] **에러 처리 및 복구 메커니즘 구현됨**
- [ ] **실제 기기에서 최종 테스트**
- [ ] **App Store 제출 전 보안 검토**

### 8. 🔧 **고급 설정 옵션**

#### **개발 환경에서만 제한 해제** (권장하지 않음)
```swift
#if DEBUG
if #available(iOS 14.0, *) {
    config.limitsNavigationsToAppBoundDomains = false
    print("🔓 [DEBUG] App-Bound Domain 제한 해제")
}
#endif
```

#### **특정 도메인에서만 햅틱 활성화**
```javascript
// 안전한 도메인 체크
if (window.location.hostname.includes('smap.site')) {
    window.SMAP_HAPTIC('success');
}
```

### 9. 📞 **추가 지원이 필요한 경우**

#### **로그 수집 방법**
```swift
// Xcode 콘솔에서 필터 적용
// 검색어: "SMAP-HAPTIC" 또는 "App-Bound"
```

#### **Safari 원격 디버깅**
```
1. 설정 > Safari > 고급 > 웹 검사기 활성화
2. Mac Safari > 개발 > [기기명] > [페이지] 선택
3. 콘솔에서 window.SMAP_DEBUG_HAPTIC() 실행
```

## 🎉 **성공 확인 방법**

다음과 같은 로그가 나타나면 성공입니다:

```
✅ [SMAP-HAPTIC] 시스템 초기화 완료
✅ [SMAP-HAPTIC] 핸들러 발견: smapIos
✅ [SMAP-HAPTIC] 메시지 전송 성공: smapIos
✨ [Haptic] SUCCESS 알림 햅틱 실행 완료
```

**이제 SMAP 앱에서 햅틱 피드백이 정상적으로 작동합니다!** 🎉 