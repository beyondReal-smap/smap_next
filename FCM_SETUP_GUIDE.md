# FCM (Firebase Cloud Messaging) 설정 가이드

## 1. Firebase 프로젝트 설정

### Firebase Console에서 설정 값 확인
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택 → Project Settings → General 탭
3. "Your apps" 섹션에서 Web app 선택
4. Firebase SDK snippet에서 config 값들 확인

### 필요한 환경변수 (.env.local)
```bash
# Firebase 설정
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

## 2. VAPID 키 생성

### Firebase Console에서 VAPID 키 생성
1. Firebase Console → Project Settings → Cloud Messaging 탭
2. "Web configuration" 섹션
3. "Generate key pair" 버튼 클릭
4. 생성된 키를 `NEXT_PUBLIC_FIREBASE_VAPID_KEY`에 설정

## 3. 서비스 워커 설정

### firebase-messaging-sw.js 파일 수정
`/public/firebase-messaging-sw.js` 파일에서 Firebase 설정 값들을 실제 값으로 변경:

```javascript
const firebaseConfig = {
  apiKey: "실제-api-key",
  authDomain: "실제-project.firebaseapp.com", 
  projectId: "실제-project-id",
  storageBucket: "실제-project.appspot.com",
  messagingSenderId: "실제-sender-id",
  appId: "실제-app-id"
};
```

## 4. FCM 토큰 작동 확인

### 브라우저 개발자 도구에서 확인
1. 로그인 후 Console 탭 확인
2. 다음 로그 메시지들이 나타나는지 확인:
   ```
   [AUTH] 🔔 FCM 토큰 초기화 시작
   [FCM Token Service] ✅ FCM 토큰 획득 성공
   [AUTH] ✅ FCM 토큰 초기화 및 서버 등록 완료
   ```

### 데이터베이스에서 확인
```sql
SELECT mt_idx, mt_name, mt_token_id FROM member_t WHERE mt_token_id IS NOT NULL;
```

## 5. 새로운 FCM 토큰 관리 API

### API 엔드포인트
- **기본 경로**: `/api/v1/member-fcm-token`
- **회원가입용**: `POST /register` - 강제 등록/업데이트
- **로그인용**: `POST /check-and-update` - 필요시에만 업데이트 (권장)
- **상태 조회**: `GET /status/{mt_idx}` - 토큰 보유 상태 확인

### 권장 사용 흐름
1. **회원가입 시**: `POST /register`
2. **로그인 시**: `POST /check-and-update` (동일 토큰이면 DB 업데이트 안함)

### 프론트엔드 통합 메서드
```javascript
// 회원가입 시
await fcmTokenService.initializeAndRegisterToken(mt_idx);

// 로그인 시 (권장)
await fcmTokenService.initializeAndCheckUpdateToken(mt_idx);
```

## 6. 테스트 방법

### 회원가입/로그인 후 자동 처리 확인
브라우저 콘솔에서 다음 로그 확인:
```
[REGISTER] 🔔 회원가입 완료 후 FCM 토큰 등록 시작
[AUTH] 🔔 로그인 후 FCM 토큰 체크/업데이트 시작
[FCM Token Service] ✅ FCM 토큰 체크/업데이트 완료: 이미 최신 상태입니다
```

### FCM 발송 테스트
```bash
curl -X POST http://localhost:3000/api/fcm_sendone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "mt_idx": 1186,
    "title": "테스트 알림",
    "content": "FCM 토큰 테스트입니다."
  }'
```

### 수동 FCM 토큰 체크
```bash
# 로그인 시 사용 (권장)
curl -X POST /api/member-fcm-token/check-and-update \
  -H "Content-Type: application/json" \
  -d '{
    "mt_idx": 1186,
    "fcm_token": "현재_앱의_FCM토큰"
  }'

# 회원가입 시 사용
curl -X POST /api/member-fcm-token/register \
  -H "Content-Type: application/json" \
  -d '{
    "mt_idx": 1186,
    "fcm_token": "현재_앱의_FCM토큰"
  }'
```

## 6. 문제 해결

### 일반적인 문제들
1. **FCM 토큰 획득 실패**: 브라우저 알림 권한 확인
2. **서비스 워커 오류**: Console에서 Service Worker 탭 확인
3. **토큰 서버 업데이트 실패**: 인증 토큰 확인
4. **VAPID 키 오류**: Firebase Console에서 VAPID 키 재생성

### 브라우저 호환성
- Chrome: 완전 지원
- Firefox: 완전 지원  
- Safari: iOS 16.4+ 지원
- Edge: 완전 지원

## 7. 보안 고려사항

### 환경변수 관리
- `.env.local` 파일은 Git에 커밋하지 않기
- 프로덕션에서는 서버 환경변수로 설정
- VAPID 키는 외부 노출 주의

### Firebase 보안 규칙
Firebase Console에서 보안 규칙 설정 권장
