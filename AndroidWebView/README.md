# SMAP Android WebView

iOS SMAP 앱을 참고하여 만든 안드로이드 웹뷰 앱입니다.

## 주요 기능

- **웹뷰 기반**: `https://nextstep.smap.site`를 웹뷰로 로드
- **JavaScript 지원**: 웹뷰에서 JavaScript 실행 가능
- **햅틱 피드백**: iOS와 유사한 햅틱 반응 지원
- **Firebase 푸시 알림**: Firebase Cloud Messaging 지원
- **다크모드 지원**: 시스템 다크모드 설정 반영
- **오류 처리**: 네트워크 오류 시 재시도 기능
- **뒤로가기 지원**: 웹뷰 히스토리 기반 뒤로가기

## 기술 스택

- **언어**: Kotlin
- **최소 SDK**: API 24 (Android 7.0)
- **타겟 SDK**: API 34 (Android 14)
- **주요 라이브러리**:
  - AndroidX WebKit
  - Firebase Messaging
  - Google Play Services
  - Material Design 3

## 설정

### 1. Firebase 설정

Firebase 프로젝트를 생성하고 `google-services.json` 파일을 `app/` 디렉토리에 추가하세요.

### 2. 빌드 및 실행

```bash
# 프로젝트 빌드
./gradlew build

# 디버그 APK 생성
./gradlew assembleDebug

# 릴리즈 APK 생성
./gradlew assembleRelease
```

## 햅틱 피드백 사용법

웹페이지에서 JavaScript를 통해 햅틱 피드백을 사용할 수 있습니다:

```javascript
// 가벼운 햅틱
window.hapticFeedback.light();

// 중간 햅틱
window.hapticFeedback.medium();

// 강한 햅틱
window.hapticFeedback.heavy();

// 성공 햅틱 (두 번 진동)
window.hapticFeedback.success();

// 경고 햅틱 (긴 진동)
window.hapticFeedback.warning();

// 오류 햅틱 (매우 긴 진동)
window.hapticFeedback.error();

// iOS 호환성을 위한 별칭
window.haptic.light();
window.haptic.success();
```

### 햅틱 타입별 진동 패턴

- **Light**: 10ms 짧은 진동
- **Medium**: 20ms 중간 진동
- **Heavy**: 30ms 긴 진동
- **Success**: 50ms-100ms-50ms 패턴
- **Warning**: 100ms-50ms-100ms 패턴
- **Error**: 200ms-100ms-200ms 패턴

## 주요 파일 구조

```
AndroidWebView/
├── app/
│   ├── src/main/
│   │   ├── java/com/dmonster/smap/
│   │   │   ├── MainActivity.kt          # 메인 액티비티 (햅틱 포함)
│   │   │   └── MyFirebaseMessagingService.kt  # 푸시 알림 서비스
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml    # 메인 레이아웃
│   │   │   └── values/
│   │   │       ├── strings.xml          # 문자열 리소스
│   │   │       ├── colors.xml           # 색상 리소스
│   │   │       └── themes.xml           # 테마 설정
│   │   └── AndroidManifest.xml          # 앱 매니페스트
│   └── build.gradle.kts                 # 앱 모듈 빌드 설정
├── build.gradle.kts                     # 프로젝트 빌드 설정
├── settings.gradle.kts                  # 프로젝트 설정
└── gradle.properties                    # Gradle 속성
```

## 권한

앱에서 사용하는 주요 권한:

- `INTERNET`: 웹뷰에서 인터넷 접근
- `ACCESS_NETWORK_STATE`: 네트워크 상태 확인
- `CAMERA`: 카메라 접근 (웹뷰에서 필요시)
- `ACCESS_FINE_LOCATION`: 정확한 위치 정보
- `ACCESS_COARSE_LOCATION`: 대략적인 위치 정보
- `POST_NOTIFICATIONS`: 푸시 알림 (API 33+)
- `VIBRATE`: 햅틱 피드백

## 웹뷰 설정

- JavaScript 활성화
- DOM Storage 활성화
- 파일 접근 허용
- 줌 기능 지원
- 혼합 콘텐츠 허용
- 사용자 에이전트 커스터마이징
- 햅틱 피드백 JavaScript 인터페이스

## 푸시 알림

Firebase Cloud Messaging을 통해 푸시 알림을 받을 수 있습니다. 알림을 탭하면 앱이 실행됩니다.

## 참고사항

- iOS 앱의 번들 ID와 동일하게 `com.dmonster.smap` 사용
- 웹뷰 URL은 `https://nextstep.smap.site`로 설정
- AdMob 앱 ID는 기존 Android 앱과 동일하게 설정
- 햅틱 피드백은 Android API 24 이상에서 지원
- iOS와 호환되는 햅틱 인터페이스 제공 