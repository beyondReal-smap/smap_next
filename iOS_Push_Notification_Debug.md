# 🔔 iOS 푸시 알림 수신 문제 진단 및 해결 가이드

## 📊 현재 상황
- ✅ **서버**: FCM 전송 성공 (projects/com-dmonster-smap/messages/1756815546786051)
- ✅ **토큰**: 유효 (길이: 142자, 형식: eqGRJ4i2rELSiBIYa2UWfS:APA91bH...)
- ✅ **iOS 연결**: FCM 서비스 정상 (30초마다 확인)
- ❌ **수신**: iOS 앱에서 푸시 알림 수신 안됨

## 🎯 진단된 문제점

### 1. 푸시 권한 Swizzling 차단
```swift
@objc func smap_requestAuthorization(options: UNAuthorizationOptions, completionHandler: @escaping (Bool, Error?) -> Void) {
    let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
    if !isLoggedIn {
        print("🛑 [SWZ-PUSH] Blocked push permission before login → returning (false)")
        DispatchQueue.main.async { completionHandler(false, nil) }
        return
    }
}
```
**문제**: 로그인하지 않은 상태에서 푸시 권한 요청이 차단됨

## 🔧 즉시 해결 방법

### A. 디바이스 설정 확인
1. **설정 → 알림 → SMAP → 알림 허용** ✅
2. **설정 → 일반 → 백그라운드 앱 새로고침 → SMAP** ✅  
3. **저전력 모드 해제**
4. **방해금지 모드 해제**

### B. 앱 내 권한 상태 확인
```swift
// Xcode Console에서 실행할 명령
po UNUserNotificationCenter.current().getNotificationSettings { settings in
    print("Authorization Status: \(settings.authorizationStatus.rawValue)")
    print("Alert Setting: \(settings.alertSetting.rawValue)")
    print("Badge Setting: \(settings.badgeSetting.rawValue)")
    print("Sound Setting: \(settings.soundSetting.rawValue)")
}
```

### C. FCM 토큰 강제 갱신
```swift
// AppDelegate에서 실행
Messaging.messaging().deleteToken { error in
    if let error = error {
        print("토큰 삭제 오류: \(error)")
    } else {
        print("토큰 삭제 성공")
        Messaging.messaging().token { token, error in
            if let token = token {
                print("새 토큰: \(token)")
                // 서버에 새 토큰 전송
            }
        }
    }
}
```

## 🚀 근본적 해결 방안

### 1. 푸시 권한 차단 우회
- 앱 시작 시 로그인 상태 확인 후 푸시 권한 요청
- 또는 swizzling 로직 수정

### 2. APNs 인증서 확인
- Firebase Console → Project Settings → Cloud Messaging
- iOS 앱 구성에서 APNs 키/인증서 등록 상태 확인

### 3. iOS 푸시 알림 최적화
- Silent Push와 일반 Push 혼용
- 백그라운드 처리 강화

## 📱 테스트 시나리오

### 단계 1: 앱 상태별 테스트
1. **포그라운드**: 앱이 화면에 보이는 상태에서 푸시 전송
2. **백그라운드**: 홈 버튼으로 앱을 백그라운드로 보낸 후 푸시 전송  
3. **종료**: 앱을 완전 종료 후 푸시 전송

### 단계 2: 디바이스별 테스트
1. **실제 디바이스**: 시뮬레이터에서는 푸시 수신 불가
2. **다른 iOS 디바이스**: 여러 디바이스에서 테스트
3. **iOS 버전별**: 다른 iOS 버전에서 테스트

## 🎯 즉시 시도할 수 있는 해결책

### 1. 앱 완전 재시작
- 앱을 완전히 종료 후 재시작
- FCM 토큰이 자동으로 갱신됨

### 2. 디바이스 재부팅
- iOS 푸시 서비스 재시작
- APNs 연결 재설정

### 3. 로그인 후 푸시 권한 재요청
- 로그인 완료 후 푸시 권한 수동 요청
- 권한 거부된 경우 설정으로 안내

## 📞 추가 디버깅

### 서버 로그에서 확인할 점
- ✅ FCM 전송 성공: `projects/com-dmonster-smap/messages/1756815546786051`
- ✅ 토큰 형식 검증 통과
- ✅ iOS 기기 감지 정상

### iOS 로그에서 확인할 점  
- ✅ FCM 서비스 연결 정상 (30초마다)
- ❓ `didReceiveRemoteNotification` 호출 여부
- ❓ 푸시 권한 상태
- ❓ APNs 등록 상태

## 🔍 다음 단계

1. **푸시 권한 상태 확인**
2. **APNs 등록 상태 확인**  
3. **Firebase Console에서 테스트 푸시 전송**
4. **실제 디바이스에서 테스트**
5. **다른 iOS 디바이스에서 교차 검증**
