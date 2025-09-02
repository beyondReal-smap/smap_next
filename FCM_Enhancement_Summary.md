# FCM 토큰 관리 및 푸시 알림 시스템 개선 요약

## 📋 문제 분석

### 기존 문제점
1. **토큰 검증 부족**: 잘못된 형식의 FCM 토큰이 DB에 저장됨
2. **에러 처리 미흡**: Firebase에서 `UnregisteredError` 발생 시 적절한 토큰 정리 부족
3. **백그라운드 처리 한계**: 앱이 백그라운드나 강제 종료 상태에서 푸시 수신 불안정
4. **토큰 동기화 문제**: iOS 앱과 서버 간 토큰 동기화 불일치

### 현재 저장된 토큰 문제
- 토큰: `OORF6pouUn1kLo6qyDfWd:APA91bEP-XU-LZdGlRh00UQam0IDvHJhUFSDERCSo4xF3SKfc389SteRiSNk4ZwaIlCCztAbyhTw0Pp4844WYW1PZnrli6Sj6dDTBKBnJOHJJ6rimY8iIlw`
- 문제: Firebase 서버에서 `UnregisteredError` 발생 → 무효화된 토큰

## 🔧 주요 개선사항

### 1. iOS AppDelegate.swift 개선

#### 새로운 기능 추가
- **개선된 토큰 관리 프로퍼티**
  ```swift
  private var fcmTokenRetryCount: Int = 0
  private var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid
  private var isFCMTokenRefreshInProgress: Bool = false
  private var shouldForceTokenRefreshOnResume: Bool = false
  ```

- **백그라운드 토큰 갱신 시스템**
  ```swift
  private func setupBackgroundTokenRefresh()
  @objc private func appDidEnterBackground()
  @objc private func appWillEnterForeground()
  ```

- **토큰 무결성 검증**
  ```swift
  private func performTokenIntegrityCheck()
  private func validateTokenFormat(_ token: String) -> Bool
  ```

- **강화된 에러 처리**
  ```swift
  private func handleTokenError(_ error: Error)
  private func requestNewToken()
  private func reinitializeFCMService()
  ```

#### 개선된 MessagingDelegate
- nil 토큰 수신 시 더 강력한 재시도 로직
- 토큰 형식 검증을 통한 잘못된 토큰 필터링
- 자동 토큰 갱신 및 서버 동기화

### 2. Backend Firebase Service 개선

#### 강화된 토큰 검증
```python
def _validate_fcm_token(self, token: str) -> bool:
    # 길이 검증: 140-200자
    # 형식 검증: 프로젝트ID:APA91b... 구조
    # 문자 패턴 검증: 허용된 문자만 사용
    # 각 부분별 세부 검증
```

#### 개선된 토큰 무효화 처리
```python
def _handle_token_invalidation(self, token: str, reason: str, title: str = None, content: str = None):
    # DB에서 토큰 제거
    # 무효화 기록을 파일에 저장 (invalid_tokens.log)
    # 중요 메시지의 경우 폴백 알림 트리거
    # 토큰 갱신 안내 메시지 생성
```

#### 추가된 에러 유형별 메시지
```python
def _build_token_refresh_message(self, reason: str) -> str:
    # unregistered: Firebase 서버에서 무효화
    # invalid_registration: 등록 정보 유효하지 않음
    # invalid_token_format: 토큰 형식 오류
    # third_party_auth_error: 인증 문제
```

### 3. FCM SendOne API 개선

#### 서버 레벨 토큰 검증
```python
# FCM 토큰 형식 검증 (서버 레벨에서 한 번 더 검증)
if not firebase_service._validate_fcm_token(member.mt_token_id):
    # 잘못된 토큰 즉시 무효화
    firebase_service._handle_token_invalidation(
        member.mt_token_id,
        "invalid_token_format_sendone",
        args.get('plt_title'),
        args.get('plt_content')
    )
```

#### 향상된 에러 처리
```python
# 에러 타입에 따른 상세 로깅
error_type = type(firebase_error).__name__
if "messaging" in str(type(firebase_error)).lower():
    # Firebase Messaging 관련 에러 처리
    if any(keyword in str(firebase_error).lower() for keyword in ['token', 'registration', 'unregistered']):
        # 토큰 관련 에러 감지 시 자동 무효화
```

#### 사용자 친화적인 에러 메시지
```python
user_message = "푸시 메시지 전송에 실패했습니다."
if "token" in str(firebase_error).lower():
    user_message += " 앱을 재시작하여 새로운 토큰을 받아주세요."
elif "network" in str(firebase_error).lower():
    user_message += " 네트워크 연결을 확인해주세요."
```

### 4. Member FCM Token API 개선

#### 엄격한 토큰 검증
```python
def validate_fcm_token_format(token: str) -> bool:
    # 길이 검증: 140-200자 (더 엄격)
    # 구조 검증: 프로젝트ID:APA91b... 형태
    # 프로젝트 ID 검증: 허용된 문자 패턴
    # 토큰 파트 검증: APA91b로 시작, 충분한 길이
```

#### 등록 시 추가 검증
```python
# 기존에 저장된 토큰이 있다면 무효화 처리
if old_token and old_token == request.fcm_token:
    firebase_service._handle_token_invalidation(
        old_token, 
        "invalid_token_format_register",
        "토큰 등록",
        "잘못된 형식의 토큰 등록 시도"
    )
```

#### 등록 후 검증
```python
# 토큰 등록 후 간단한 유효성 테스트
if firebase_service.is_available():
    additional_validation = firebase_service._validate_fcm_token(request.fcm_token)
    if not additional_validation:
        logger.warning(f"⚠️ Firebase 서비스 레벨 토큰 검증 실패")
```

## 🧪 테스트 도구

### 1. Enhanced FCM Test Script
- **파일**: `fcm_enhanced_test.sh`
- **기능**: 
  - FCM 토큰 상태 확인
  - 잘못된 토큰 정리 테스트
  - 유효한/잘못된 토큰 등록 테스트
  - 푸시 메시지 전송 테스트 (일반/백그라운드/Silent)
  - 토큰 검증 및 갱신 테스트
  - 만료된 토큰 정리 테스트

### 2. iOS FCM Test Guide
- **파일**: `iOS_FCM_Test_Guide.md`
- **내용**:
  - 앱 재시작 후 토큰 갱신 테스트
  - 포그라운드/백그라운드/강제종료 상태 푸시 테스트
  - Silent 푸시 테스트
  - 토큰 검증 테스트
  - 문제 해결 가이드

## 📊 개선 결과

### 토큰 관리 개선
- ✅ **자동 토큰 검증**: 앱 시작 시 토큰 무결성 자동 확인
- ✅ **잘못된 토큰 필터링**: 형식 검증을 통한 잘못된 토큰 사전 차단
- ✅ **자동 토큰 정리**: 무효화된 토큰 자동 감지 및 DB에서 제거
- ✅ **토큰 갱신 알림**: 사용자에게 적절한 토큰 갱신 안내

### 푸시 수신 안정성 향상
- ✅ **백그라운드 처리**: 앱이 백그라운드에 있어도 안정적인 푸시 수신
- ✅ **강제 종료 상태**: 앱이 완전히 종료되어도 푸시 수신 가능
- ✅ **로컬 알림 보장**: FCM 실패 시 로컬 알림으로 대체 표시
- ✅ **중복 방지**: 동일한 메시지 중복 표시 방지

### 에러 처리 강화
- ✅ **상세한 로깅**: 각 단계별 상세 로그로 문제 추적 용이
- ✅ **자동 복구**: 토큰 문제 발생 시 자동 재시도 및 복구
- ✅ **폴백 메커니즘**: FCM 실패 시 이메일 등 대체 알림 방법 제공
- ✅ **사용자 안내**: 명확하고 실행 가능한 에러 메시지 제공

## 🔄 배포 후 확인사항

### 1. 즉시 확인
1. **기존 토큰 정리**
   ```bash
   ./fcm_enhanced_test.sh 1186
   ```

2. **새로운 토큰 등록**
   - iOS 앱 완전 재시작
   - 새로운 토큰 자동 등록 확인

### 2. 일주일 후 확인
1. **토큰 안정성**: `invalid_tokens.log` 파일에서 무효화 패턴 분석
2. **푸시 성공률**: 푸시 로그에서 성공/실패 비율 확인
3. **사용자 피드백**: 푸시 수신 관련 사용자 문의 감소 확인

### 3. 모니터링 포인트
- FCM 토큰 무효화 빈도
- 푸시 알림 전송 성공률
- 백그라운드 푸시 수신률
- 토큰 갱신 성공률

## 🎯 기대 효과

1. **사용자 경험 개선**
   - 안정적인 푸시 알림 수신
   - 모든 앱 상태에서 일관된 알림 동작

2. **시스템 안정성 향상**
   - 자동 토큰 관리로 수동 개입 불필요
   - 강화된 에러 처리로 시스템 복원력 증대

3. **운영 효율성 증대**
   - 상세한 로깅으로 문제 진단 시간 단축
   - 자동화된 토큰 정리로 DB 품질 유지

4. **확장성 확보**
   - 표준화된 토큰 검증 로직
   - 재사용 가능한 에러 처리 패턴

이번 개선을 통해 FCM 푸시 알림 시스템이 더욱 안정적이고 신뢰할 수 있는 서비스로 발전했습니다.
