# SMAP iOS 웹뷰 앱

frontend 폴더의 Next.js 웹 애플리케이션을 iOS 웹뷰로 감싸는 하이브리드 앱입니다.

## 프로젝트 구조

```
iOS/
├── Podfile                    # CocoaPods 의존성 관리
├── smap/
│   ├── AppDelegate.swift      # 앱 델리게이트 (푸시 알림, Firebase 설정)
│   ├── WebViewController.swift # 메인 웹뷰 컨트롤러
│   ├── Utils.swift           # 유틸리티 클래스
│   ├── StoreKitManager.swift # 인앱 결제 관리
│   ├── Info.plist           # 앱 설정 파일
│   ├── GoogleService-Info.plist # Firebase 설정
│   ├── smap.entitlements    # 앱 권한 설정
│   └── WebAppInterface.js   # 웹-네이티브 통신 인터페이스
└── README.md                # 이 파일
```

## 설정 방법

### 1. 의존성 설치

```bash
cd iOS
pod install
```

### 2. Xcode에서 프로젝트 열기

```bash
open smap.xcworkspace
```

### 3. 웹 애플리케이션 URL 설정

`WebViewController.swift` 파일에서 `webAppURL` 변수를 수정하세요:

```swift
// 개발 환경
private let webAppURL = "http://localhost:3000"

// 또는 배포된 URL
private let webAppURL = "https://your-domain.com"
```

### 4. Bundle Identifier 설정

Xcode에서 프로젝트 설정 > General > Identity > Bundle Identifier를 설정하세요.

### 5. Firebase 설정 (선택사항)

푸시 알림을 사용하려면:
1. Firebase 콘솔에서 새 iOS 앱 추가
2. 새로운 `GoogleService-Info.plist` 파일 다운로드
3. 기존 파일 교체

## 주요 기능

### 웹뷰 기능
- **자동 로딩**: frontend 개발 서버 또는 배포된 웹사이트 로딩
- **JavaScript 브릿지**: 웹과 네이티브 앱 간 양방향 통신
- **네비게이션**: 뒤로 가기/앞으로 가기 제스처 지원
- **외부 링크 처리**: mailto, tel, sms 링크 자동 처리

### 네이티브 기능
- **푸시 알림**: Firebase Cloud Messaging 지원
- **딥링크**: 커스텀 URL 스킴 지원 (`smapapp://`)
- **인앱 결제**: SwiftyStoreKit을 통한 결제 처리
- **앱 상태 관리**: 백그라운드/포그라운드 상태 웹에 전달
- **햅틱 피드백**: 네이티브 햅틱 피드백 지원
- **콘텐츠 공유**: iOS 네이티브 공유 시트

## 웹-네이티브 통신

### JavaScript에서 네이티브 기능 호출

```javascript
// 알림 권한 요청
window.SmapApp.requestNotificationPermission();

// 콘텐츠 공유
window.SmapApp.shareContent('공유할 텍스트');

// 외부 URL 열기
window.SmapApp.openExternalURL('https://example.com');

// 햅틱 피드백
window.SmapApp.hapticFeedback();
```

### 네이티브에서 웹으로 이벤트 전달

```javascript
// 푸시 알림 수신
window.addEventListener('pushNotification', (event) => {
    console.log('푸시 알림:', event.detail);
});

// 딥링크 수신
window.addEventListener('deepLink', (event) => {
    console.log('딥링크:', event.detail);
});

// 앱 상태 변경
window.addEventListener('appStateChange', (event) => {
    console.log('앱 상태:', event.detail.state);
});
```

## 빌드 및 배포

### 개발용 빌드
1. Xcode에서 시뮬레이터 선택
2. ⌘+R로 빌드 및 실행

### 배포용 빌드
1. Product > Archive 선택
2. Organizer에서 앱스토어 또는 AdHoc 배포 선택

## 주의사항

### 개발 환경
- frontend 개발 서버(`npm run dev`)가 실행 중이어야 합니다
- iOS 시뮬레이터에서 localhost 접근이 가능합니다

### 배포 환경
- 웹 애플리케이션이 HTTPS로 배포되어야 합니다 (HTTP는 iOS에서 제한됨)
- `Info.plist`의 `NSAppTransportSecurity` 설정 확인

### 권한 관리
- 카메라, 위치, 마이크 등의 권한이 필요한 경우 `Info.plist`에 usage description 추가
- 웹에서 권한 요청 시 네이티브 권한 창이 표시됩니다

## 트러블슈팅

### 웹페이지가 로딩되지 않는 경우
1. 웹 서버가 실행 중인지 확인
2. URL이 올바른지 확인
3. 네트워크 연결 상태 확인

### 푸시 알림이 작동하지 않는 경우
1. `GoogleService-Info.plist` 파일이 올바른지 확인
2. Firebase 프로젝트 설정 확인
3. 앱 번들 ID와 Firebase 설정이 일치하는지 확인

### JavaScript 브릿지가 작동하지 않는 경우
1. `WebAppInterface.js` 파일이 웹에 포함되어 있는지 확인
2. 웹뷰가 완전히 로딩된 후 호출하는지 확인

## 업데이트 가이드

### 웹 애플리케이션 업데이트
- 웹 애플리케이션만 배포하면 앱 업데이트 없이 반영됩니다
- 앱스토어 재심사가 필요하지 않습니다

### 네이티브 기능 업데이트
- iOS 코드 변경 시 앱스토어 재심사가 필요합니다
- 새로운 권한 추가 시 `Info.plist` 업데이트 필요 