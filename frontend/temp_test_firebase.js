// Firebase 환경변수가 설정되지 않은 상태에서 Google 로그인 후 예상 로그:
console.log(`
예상 FCM 로그:
1. Google 로그인 성공
2. [GOOGLE LOGIN] 🔔 FCM 토큰 체크/업데이트 시작
3. [FCM Token Service] ⚠️ Firebase 앱이 초기화되지 않음 - 환경변수 확인 필요
4. [GOOGLE LOGIN] ⚠️ FCM 토큰 체크/업데이트 실패: FCM 토큰 획득 실패

이 로그가 나타나면 Google 로그인 플로우는 정상 작동하고 있는 것입니다.
Firebase 환경변수만 설정하면 FCM도 정상 작동할 것입니다.
`);
