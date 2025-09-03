# FCM 테스트 토큰 문제 해결 가이드

## 🚨 문제 상황
- 서버 로그: `The registration token is not a valid FCM registration token`
- DB에 저장된 토큰: `fWLYBJYTH06ejEjCYVb8TestToken` (가짜 테스트 토큰)
- Firebase가 이 토큰을 유효하지 않다고 거부

## 🔍 원인 분석

### 1. 가짜 테스트 토큰 사용
- **fcm_test.sh**에서 하드코딩된 테스트 토큰 사용
- 실제 Firebase에서는 이런 가짜 토큰을 인식하지 못함
- 테스트 중에 가짜 토큰이 DB에 저장됨

### 2. iOS 앱에서 실제 토큰 미전송
- iOS 앱이 Firebase에서 받은 실제 토큰을 서버에 전송하지 않음
- 또는 토큰 갱신 프로세스에 문제가 있음

## ✅ 해결 방법

### 1. 즉시 해결: DB에서 테스트 토큰 제거

#### A. 테스트 토큰 삭제
```sql
-- 회원 1186의 가짜 토큰 삭제
UPDATE member_t SET mt_token_id = NULL WHERE mt_idx = 1186 AND mt_token_id LIKE 'fWLYBJYTH06ejEjCYVb8TestToken%';
```

#### B. 또는 유효한 실제 토큰으로 교체
```sql
-- 실제 iOS에서 받은 FCM 토큰으로 교체 (예시)
UPDATE member_t SET mt_token_id = '실제_FCM_토큰_여기에_입력' WHERE mt_idx = 1186;
```

### 2. iOS 앱에서 실제 토큰 등록

#### A. iOS 앱 실행
1. iOS 앱을 실행
2. 로그인 진행
3. FCM 토큰이 자동으로 Firebase에서 생성됨
4. 앱이 실제 토큰을 서버에 전송

#### B. iOS 앱 로그 확인
```
✅ [FCM] 현재 FCM 토큰: 실제_긴_토큰_문자열...
🔄 [FCM] 서버에 토큰 업데이트 시작
✅ [FCM] 서버 토큰 업데이트 성공
```

### 3. 테스트 스크립트 개선 (이미 완료 ✅)

#### A. 실제 토큰 자동 조회
- DB에서 실제 토큰을 가져와서 사용
- 가짜 토큰 사용 방지

#### B. 토큰 유효성 사전 검증
- FCM 발송 전에 토큰 형식 검증
- 테스트 토큰 감지 시 경고

## 🧪 테스트 방법

### 1. 현재 토큰 상태 확인
```bash
curl -s "https://api3.smap.site/api/v1/member-fcm-token/status/1186" | jq .
```

### 2. iOS 앱에서 새 토큰 생성
1. iOS 앱 완전 삭제
2. 재설치 및 로그인
3. 새로운 실제 FCM 토큰 자동 등록

### 3. 테스트 스크립트 실행
```bash
./fcm_test.sh  # 이제 실제 토큰 사용
```

## 🔧 예방 조치

### 1. 테스트 환경 분리
- 실제 사용자와 테스트 사용자 분리
- 테스트용 별도 Firebase 프로젝트 사용

### 2. 토큰 유효성 검증 강화
- 서버에서 토큰 등록 시 형식 검증
- 테스트 토큰 패턴 차단

### 3. 모니터링 강화
- 유효하지 않은 토큰 감지 시 알림
- 정기적인 토큰 상태 검증

## 🎯 즉시 실행할 명령

### 1. 테스트 토큰 제거
```bash
# DB에서 테스트 토큰 삭제 (직접 DB 접속 필요)
mysql -u smap2 -p smap2_db -e "UPDATE member_t SET mt_token_id = NULL WHERE mt_idx = 1186 AND mt_token_id LIKE 'fWLYBJYTH06ejEjCYVb8TestToken%';"
```

### 2. iOS 앱 재설정
```
1. iOS 앱 삭제
2. 재설치
3. 로그인
4. 새 FCM 토큰 자동 등록
```

### 3. 테스트 재실행
```bash
./fcm_test.sh  # 실제 토큰으로 테스트
```

## 📋 체크리스트

- [ ] DB에서 테스트 토큰 제거
- [ ] iOS 앱 재설치 및 로그인
- [ ] 새로운 실제 토큰 등록 확인
- [ ] FCM 테스트 스크립트 재실행
- [ ] 실제 푸시 알림 수신 확인

---

이 절차를 따르면 FCM 테스트 토큰 문제가 완전히 해결됩니다!
