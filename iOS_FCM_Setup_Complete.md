# 🔥 iOS FCM 토큰 설정 완료 가이드

## ✅ 완료된 설정

### 1. Firebase 초기화 ✅
- `FirebaseApp.configure()` 호출
- `GoogleService-Info.plist` 포함
- Firebase Messaging 델리게이트 설정

### 2. FCM 토큰 생성 ✅
- `messaging(_:didReceiveRegistrationToken:)` 구현
- 토큰 생성 시 자동 로깅
- Utils.shared.setToken() 호출

### 3. WebView 토큰 주입 ✅
- `injectFCMTokenToWebView()` 함수 추가
- 여러 방법으로 WebView 참조 검색
- 재시도 로직 구현 (최대 5회)
- 토큰 주입 확인 로직

### 4. 알림 권한 및 표시 ✅
- 권한 요청: `setupPushNotificationPermissions()`
- 포어그라운드 표시: `completionHandler([.alert, .sound, .badge])`
- 권한 상태 모니터링

## 🚀 테스트 방법

### 앱 실행 후 확인할 로그:
```
🔥 [FCM] Firebase registration token: [토큰]
🔥 [FCM] 토큰 길이: XXX 문자
🔥 [FCM] 토큰 미리보기: [첫30문자]...
🌐 [FCM] WebView에 토큰 주입 시도 시작
🔍 [FCM] 방법 1: rootViewController에서 WebView 찾음
✅ [FCM] WebView에 FCM 토큰 주입 완료!
✅ [FCM] 토큰 주입 확인 성공: SUCCESS:[토큰미리보기]
```

### 브라우저 콘솔에서 확인:
```javascript
// 1. 네이티브 토큰 확인
console.log('iOS 네이티브 토큰:', window.nativeFCMToken ? 'O' : 'X');
if (window.nativeFCMToken) {
    console.log('토큰 미리보기:', window.nativeFCMToken.substring(0, 30) + '...');
}

// 2. 서버에 토큰 업데이트
await fetch('/api/member-fcm-token/check-and-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        mt_idx: 1186,
        fcm_token: window.nativeFCMToken
    })
}).then(r => r.json()).then(console.log);

// 3. 푸시 발송 테스트
await fetch('/api/fcm_sendone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        plt_type: 'manual',
        sst_idx: '0',
        plt_condition: 'direct',
        plt_memo: 'iOS native token test',
        mt_idx: 1186,
        plt_title: 'iOS 네이티브 테스트',
        plt_content: '이제 실제 iOS 기기로 푸시가 와야 합니다!'
    })
}).then(r => r.json()).then(console.log);
```

## 🎯 기대 결과

1. **앱 시작**: FCM 토큰 자동 생성 및 WebView 주입
2. **브라우저**: `window.nativeFCMToken`에 iOS 토큰 설정됨
3. **서버**: `member_t.mt_token_id`에 iOS 네이티브 토큰 저장
4. **푸시**: 실제 iOS 기기로 알림 수신

## 🔧 문제 해결

### 토큰이 주입되지 않는 경우:
1. Xcode 콘솔에서 FCM 로그 확인
2. WebView 로드 완료 후 토큰 생성되는지 확인
3. 재시도 로직이 작동하는지 확인

### 푸시가 오지 않는 경우:
1. iOS 기기에서 알림 권한 허용 확인
2. APNs 키가 Firebase에 등록되었는지 확인
3. Bundle ID가 Firebase 프로젝트와 일치하는지 확인
4. 포어그라운드/백그라운드 상태 확인

## 🎉 완료!

이제 iOS 앱에서 FCM 토큰이 자동으로 생성되고 WebView에 주입되어 서버에 저장됩니다.
실제 푸시 알림을 받을 수 있습니다!
