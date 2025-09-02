# iOS FCM 푸시 알림 테스트 가이드

## 개선된 FCM 시스템 테스트 방법

### 1. 앱 재시작 후 토큰 갱신 테스트

1. **앱 완전 종료**
   - iOS 설정에서 앱을 완전히 종료
   - 홈 버튼 더블 탭 후 앱 스와이프로 종료

2. **앱 재시작**
   - 앱을 다시 실행
   - Xcode 콘솔에서 다음 로그 확인:
   ```
   🔥 [FCM Integrity] 현재 토큰: [새로운 토큰]...
   ✅ [FCM Sync] 서버 토큰 동기화 성공
   ```

3. **토큰 갱신 확인**
   - 서버 로그에서 새로운 토큰 등록 확인
   - `fcm_enhanced_test.sh` 스크립트로 토큰 상태 확인

### 2. 포그라운드 푸시 테스트

1. **앱이 실행된 상태에서 테스트**
   ```bash
   ./fcm_enhanced_test.sh 1186
   ```

2. **확인사항**
   - 푸시 알림이 앱 내에서 표시되는지 확인
   - Xcode 콘솔에서 다음 로그 확인:
   ```
   🔔 [FCM] 포그라운드에서 푸시 알림 수신
   ✅ [FCM Local] 로컬 알림 표시 성공
   ```

### 3. 백그라운드 푸시 테스트

1. **앱을 백그라운드로 전환**
   - 홈 버튼 누르기 또는 제스처로 홈 화면으로 이동

2. **백그라운드 푸시 전송**
   ```bash
   curl -X POST "https://smap.dmonster.kr/api/v1/fcm-sendone/background" \
   -H "Content-Type: application/json" \
   -d '{
     "plt_type": "BACKGROUND_TEST",
     "sst_idx": "0", 
     "plt_condition": "Background Test",
     "plt_memo": "Background push test",
     "mt_idx": 1186,
     "plt_title": "🌙 Background Test",
     "plt_content": "Background push test",
     "content_available": true,
     "priority": "high"
   }'
   ```

3. **확인사항**
   - 알림 센터에 알림이 표시되는지 확인
   - 알림 탭 시 앱이 올바르게 열리는지 확인

### 4. 앱 강제 종료 상태 푸시 테스트

1. **앱 완전 종료**
   - 멀티태스킹 화면에서 앱을 완전히 종료

2. **푸시 전송**
   ```bash
   ./fcm_enhanced_test.sh 1186
   ```

3. **확인사항**
   - 알림 센터에 알림이 표시되는지 확인
   - 알림 탭 시 앱이 올바르게 실행되는지 확인
   - 앱 실행 후 토큰이 자동으로 갱신되는지 확인

### 5. Silent 푸시 테스트

1. **Silent 푸시 전송**
   ```bash
   curl -X POST "https://smap.dmonster.kr/api/v1/fcm-sendone/silent" \
   -H "Content-Type: application/json" \
   -d '{
     "mt_idx": 1186,
     "reason": "token_refresh_test",
     "priority": "high"
   }'
   ```

2. **확인사항**
   - 사용자에게 알림이 표시되지 않는지 확인
   - 앱이 백그라운드에서 깨어나는지 확인
   - Xcode 콘솔에서 토큰 갱신 로그 확인

### 6. 토큰 검증 테스트

1. **잘못된 토큰 등록 시도**
   ```bash
   curl -X POST "https://smap.dmonster.kr/api/v1/member-fcm-token/register" \
   -H "Content-Type: application/json" \
   -d '{
     "mt_idx": 1186,
     "fcm_token": "invalid_token"
   }'
   ```

2. **확인사항**
   - 400 에러와 적절한 에러 메시지 반환 확인
   - 잘못된 토큰이 DB에 저장되지 않는지 확인

### 7. 토큰 만료 시나리오 테스트

1. **DB에서 토큰 만료일을 과거로 설정**
   ```sql
   UPDATE member SET mt_token_expiry_date = '2025-01-01' WHERE mt_idx = 1186;
   ```

2. **푸시 전송 시도**
   ```bash
   ./fcm_enhanced_test.sh 1186
   ```

3. **확인사항**
   - 토큰 만료 에러 메시지 확인
   - 자동 토큰 갱신 프로세스 동작 확인

## 예상 결과

### 성공적인 FCM 시스템의 동작

1. **토큰 관리**
   - ✅ 앱 시작 시 자동 토큰 검증 및 동기화
   - ✅ 잘못된 토큰 자동 감지 및 정리
   - ✅ 토큰 만료 시 자동 갱신

2. **푸시 수신**
   - ✅ 포그라운드: 앱 내 알림 표시
   - ✅ 백그라운드: 알림 센터에 표시
   - ✅ 강제 종료: 알림 센터에 표시, 탭 시 앱 실행

3. **에러 처리**
   - ✅ 토큰 형식 검증
   - ✅ 무효화된 토큰 자동 정리
   - ✅ 사용자 친화적인 에러 메시지

## 문제 해결

### 일반적인 문제들

1. **토큰이 등록되지 않는 경우**
   - iOS 시뮬레이터가 아닌 실제 기기 사용 확인
   - Firebase 프로젝트 설정 확인
   - 앱 재시작 후 재시도

2. **푸시가 수신되지 않는 경우**
   - 알림 권한 설정 확인
   - 인터넷 연결 상태 확인
   - FCM 토큰 유효성 확인

3. **백그라운드에서 푸시가 수신되지 않는 경우**
   - Background App Refresh 설정 확인
   - 저전력 모드 비활성화 확인
   - APNs 설정 확인

## 로그 모니터링

### 중요한 로그 패턴

1. **성공적인 토큰 갱신**
   ```
   ✅ [FCM Sync] 서버 토큰 동기화 성공
   📝 [FCM TOKEN MANAGEMENT] 무효화 기록이 invalid_tokens.log에 저장됨
   ```

2. **푸시 수신 성공**
   ```
   🔔 [FCM] 포그라운드에서 푸시 알림 수신
   ✅ [FCM Local] 로컬 알림 표시 성공
   ```

3. **토큰 검증 실패**
   ```
   ❌ [FCM TOKEN VALIDATION] 토큰 형식이 올바르지 않음
   🚨 [FCM TOKEN MANAGEMENT] 무효화된 토큰 발견
   ```

이 가이드를 통해 개선된 FCM 시스템이 모든 시나리오에서 올바르게 동작하는지 확인할 수 있습니다.
