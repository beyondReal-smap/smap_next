# SMAP Android

가족 위치 공유 앱 SMAP의 Android 클라이언트입니다.

## 환경

| 항목 | 버전 |
|------|------|
| Min SDK | 28 (Android 9) |
| Target SDK | 35 |
| Compile SDK | 35 |
| Kotlin | 1.9.x |
| Java | 17 |
| Gradle | Kotlin DSL |

## 기술 스택

- **UI**: Jetpack Compose + Material3
- **아키텍처**: MVVM + Hilt (DI)
- **지도**: Naver Maps SDK 3.23 + Naver Map Compose
- **네트워크**: Retrofit 2.11 + OkHttp 4.12 + Kotlinx Serialization
- **인증**: Google Sign-In, Kakao SDK 2.20
- **푸시**: Firebase Cloud Messaging (FCM)
- **이미지**: Coil 2.6
- **비동기**: Kotlin Coroutines 1.9 + Flow

## 프로젝트 구조

```
app/src/main/java/com/dmonster/smap/
├── SmapApplication.kt              # Application (Hilt 진입점)
├── MainActivity.kt                 # 단일 Activity (Compose 호스트)
├── AppConstants.kt                 # 상수 정의
├── LocationService.kt              # 포그라운드 위치 추적 서비스
├── MyFirebaseMessagingService.kt   # FCM 토큰/메시지 수신
├── data/
│   ├── api/
│   │   ├── SmapApi.kt              # Retrofit API 인터페이스 (전체 엔드포인트)
│   │   ├── ApiResult.kt            # Result 래퍼 (Success/Error/NetworkError)
│   │   └── AuthInterceptor.kt      # OkHttp 인증 인터셉터
│   ├── model/
│   │   ├── HomeModels.kt           # 그룹, 멤버, 일정 모델
│   │   ├── ChatModels.kt           # 채팅방, 메시지 모델
│   │   ├── ApiRequestModels.kt     # @Serializable 요청 데이터 클래스
│   │   ├── ActivityLogModels.kt    # 위치 로그, 체류시간 모델
│   │   ├── LoginModels.kt          # 인증 관련 모델
│   │   └── ...
│   ├── service/
│   │   ├── AuthService.kt          # 인증, 토큰, 사용자 정보
│   │   ├── ChatService.kt          # 채팅 REST API
│   │   ├── ChatSocketManager.kt    # WebSocket (OkHttp + Socket.IO 프로토콜)
│   │   ├── GroupService.kt         # 그룹 CRUD
│   │   ├── HomeService.kt          # 홈 데이터 로드
│   │   ├── ScheduleService.kt      # 일정 CRUD
│   │   ├── MyPlaceService.kt       # 장소 CRUD
│   │   ├── ActivityLogService.kt   # 활동 로그 조회
│   │   └── ...
│   └── GlobalEventBus.kt           # 앱 전역 이벤트
├── di/
│   ├── AppModule.kt                # Application 레벨 DI
│   ├── NetworkModule.kt            # Retrofit, OkHttp, Json DI
│   └── ServiceModule.kt            # 서비스 레이어 DI
└── ui/
    ├── navigation/
    │   └── MainTabScreen.kt        # 하단 탭 네비게이션 (5탭)
    ├── home/                       # 홈 (지도, 사이드바, 일정 카드)
    ├── group/                      # 그룹 (목록, 상세, 생성/가입)
    ├── schedule/                   # 일정 (캘린더, 폼, CRUD)
    ├── myplace/                    # 내장소 (지도, 검색, 저장)
    ├── activitylog/                # 활동로그 (경로, 체류시간, 슬라이더)
    ├── chat/                       # 채팅 (방 목록, 메시지, DM)
    ├── login/                      # 로그인 (Google, Kakao)
    ├── register/                   # 회원가입
    ├── settings/                   # 설정, 프로필
    ├── splash/                     # 스플래시
    ├── components/                 # 공통 UI 컴포넌트
    ├── common/                     # 공통 유틸리티
    └── theme/                      # Material3 테마, 색상, 폰트 (SUITE)
```

## 화면 구성 (5탭)

| 탭 | 화면 | 설명 |
|----|------|------|
| 홈 | HomeScreen | 네이버 지도, 멤버 위치, 일정 카드, 알림 |
| 그룹 | GroupScreen | 그룹 목록, 생성, 초대코드 가입 |
| 일정 | ScheduleScreen | 월별 캘린더, 일정 CRUD |
| 내장소 | MyPlaceScreen | 장소 저장, 카카오 검색, 알림 설정 |
| 활동로그 | ActivityLogScreen | 이동 경로, 체류시간, 경로 슬라이더 |

## 빌드

```bash
cd Android
./gradlew assembleDebug
```

또는 Android Studio에서 프로젝트를 열고 Run 합니다.

### 서명 키

릴리즈 빌드 시 `app/smap.jks` 키스토어를 사용합니다.

### API 키 설정

`gradle.properties` 또는 `local.properties`에 설정:

```properties
KAKAO_API_KEY=your_kakao_key
```

## 주요 의존성

| 라이브러리 | 용도 |
|-----------|------|
| Retrofit 2.11 | HTTP 클라이언트 |
| OkHttp 4.12 | HTTP 엔진 + WebSocket |
| Kotlinx Serialization 1.6 | JSON 직렬화 |
| Hilt 2.51 | 의존성 주입 |
| Jetpack Compose 2024.12 | 선언형 UI |
| Naver Maps 3.23 | 지도 |
| Coil 2.6 | 이미지 로딩 |
| Firebase BOM 33.7 | 푸시 알림 |

## API

백엔드: `https://api3.aiagnt.kr/api/v1/`
