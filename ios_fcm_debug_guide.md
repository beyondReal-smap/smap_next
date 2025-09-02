# iOS FCM 푸시 알림 수신 문제 해결 가이드

## 현재 상황
- ✅ 서버에서 FCM 메시지 전송 성공 (Message ID: projects/com-dmonster-smap/messages/1756853243445814)
- ❌ iOS 기기에서 푸시 알림 수신되지 않음

## 📱 1. iOS 기기에서 확인해야 할 사항

### 알림 권한 설정 확인
1. **설정 > 알림 > SMAP**에서 다음 항목들이 활성화되어 있는지 확인:
   - ✅ 알림 허용
   - ✅ 잠금 화면에서 표시
   - ✅ 알림 센터에서 표시  
   - ✅ 배너 스타일: 지속적 또는 일시적
   - ✅ 사운드 활성화
   - ✅ 배지 활성화

### 방해 금지 모드 확인
- **설정 > 집중 모드 > 방해금지** 비활성화
- **제어센터**에서 방해금지 모드 비활성화 확인

## 🔄 2. 앱 상태별 테스트

### 포그라운드 테스트 (앱 실행 중)
```bash
# 앱을 화면에서 실행한 상태로 테스트
./fcm_test.sh
```
- iOS에서 `userNotificationCenter willPresent` 메서드가 호출되어야 함
- 로그에서 "🔔 [FCM] 포그라운드에서 푸시 알림 수신" 확인

### 백그라운드 테스트 (앱 백그라운드)
```bash
# 앱을 홈 버튼으로 백그라운드로 전환 후 테스트
./fcm_test.sh
```
- 알림이 알림 센터에 표시되어야 함
- 탭하면 `userNotificationCenter didReceive` 메서드 호출

### 종료 상태 테스트 (앱 완전 종료)
```bash
# 앱을 완전 종료(앱 전환기에서 위로 밀어서 종료) 후 테스트
./fcm_test.sh
```
- APNs를 통해 직접 전달되어야 함

## 🔑 3. Firebase Console 확인 사항

### APNs 설정 확인
1. **Firebase Console > 프로젝트 설정 > 클라우드 메시징** 접속
2. **Apple 앱 구성** 섹션 확인:
   - APNs 인증키 (.p8 파일) 업로드 여부
   - 키 ID: 올바른 APNs 키 ID 설정 (`AuthKey_9HJRA7XKFF.p8`의 경우 `9HJRA7XKFF`)
   - 팀 ID: Apple Developer Team ID 일치
   - 번들 ID: `com.dmonster.smap` 일치 확인

### APNs 환경 확인
- **Development**: 개발용 인증서/키 (시뮬레이터, 개발 빌드)
- **Production**: 배포용 인증서/키 (App Store, TestFlight)

## 🔍 4. iOS 로그 확인 방법

### Xcode Console 사용
1. **Xcode > Window > Devices and Simulators**
2. iOS 기기 선택
3. **Open Console** 클릭
4. 필터에 `SMAP` 또는 `FCM` 입력
5. FCM 테스트 실행하면서 로그 확인

### 확인해야 할 로그들
```
📱 [APNS] APNS 디바이스 토큰 수신 시작
✅ [APNS] APNS 디바이스 토큰 FCM에 등록 완료
🎯 [FCM Delegate] FCM 토큰 갱신 이벤트 발생!
🔔 [FCM] 포그라운드에서 푸시 알림 수신 (포그라운드일 때)
```

## ⚠️ 5. 일반적인 문제들과 해결책

### APNs 환경 불일치
**문제**: Development 키로 Production 앱에 푸시 전송
**해결**: Firebase Console에서 올바른 APNs 키 업로드

### 토큰 불일치
**문제**: FCM 토큰이 실제 기기와 동기화되지 않음
**해결**: 앱 재설치로 새로운 토큰 생성

### 네트워크 문제
**문제**: iOS 기기의 네트워크 연결 불안정
**해결**: WiFi/셀룰러 연결 확인, 기기 재부팅

## 💡 6. 즉시 시도할 수 있는 해결책

### 단계별 문제 해결
1. **iOS 앱 완전 삭제 후 재설치**
   - 앱을 길게 눌러서 삭제
   - App Store에서 다시 설치
   - 알림 권한 다시 허용

2. **iOS 기기 재부팅**
   - 전원 버튼 + 볼륨 버튼으로 재부팅
   - 네트워크 및 시스템 상태 초기화

3. **알림 권한 재설정**
   - **설정 > 일반 > 재설정 > 개인정보 보호 및 보안 재설정**
   - 앱 재실행 시 알림 권한 다시 허용

4. **Firebase 프로젝트 재설정**
   - APNs 키 삭제 후 다시 업로드
   - 번들 ID 정확성 재확인

## 🧪 7. 고급 디버깅

### FCM 토큰 직접 테스트
Firebase Console의 **Messaging** 탭에서:
1. **새 캠페인** 클릭
2. **알림** 선택
3. 제목/내용 입력
4. **테스트 메시지 전송**
5. FCM 토큰 직접 입력하여 테스트

### APNs 직접 테스트
```bash
# APNs Pusher 도구 사용하여 직접 테스트
# https://github.com/noodlewerk/NWPusher 등 활용
```

## 📞 8. 추가 지원

문제가 지속되면 다음 정보와 함께 문의:
- iOS 버전
- 앱 버전
- FCM 토큰 앞 30자리
- Firebase Console APNs 설정 스크린샷
- iOS 기기 Console 로그

---

이 가이드를 따라 단계별로 확인하면 대부분의 iOS FCM 푸시 알림 문제를 해결할 수 있습니다.
