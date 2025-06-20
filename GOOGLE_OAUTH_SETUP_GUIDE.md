# Google OAuth 설정 가이드 (nextstep.smap.site)

## 현재 문제
`nextstep.smap.site`에서 Google 로그인 시 "Google Identity Services를 사용할 수 없습니다" 오류가 발생합니다.

## 해결 방법

### 1. Google Cloud Console 접속
1. https://console.cloud.google.com 접속
2. 기존 SMAP 프로젝트 선택 (또는 새 프로젝트 생성)

### 2. OAuth 2.0 클라이언트 ID 설정
1. 왼쪽 메뉴에서 **API 및 서비스** > **사용자 인증 정보** 클릭
2. 기존 OAuth 2.0 클라이언트 ID를 찾아서 **편집** 클릭
3. **승인된 JavaScript 출처** 섹션에서 **URI 추가** 클릭
4. 다음 URL을 추가:
   ```
   https://nextstep.smap.site
   ```

### 3. 새 Client ID 발급 (권장)
기존 Client ID 수정 대신 새로운 Client ID를 생성하는 것을 권장합니다:

1. **사용자 인증 정보 만들기** > **OAuth 클라이언트 ID** 클릭
2. 애플리케이션 유형: **웹 애플리케이션** 선택
3. 이름: `SMAP Production (nextstep.smap.site)` 입력
4. **승인된 JavaScript 출처**에 다음 추가:
   ```
   https://nextstep.smap.site
   ```
5. **승인된 리디렉션 URI**에 다음 추가 (필요시):
   ```
   https://nextstep.smap.site/api/auth/callback/google
   ```
6. **만들기** 클릭

### 4. Client ID 코드 업데이트
새로 발급받은 Client ID를 `frontend/src/config/index.ts` 파일에 업데이트:

```typescript
CLIENT_IDS: {
  'nextstep.smap.site': '새로_발급받은_Client_ID',  // 여기에 새 Client ID 입력
  'app2.smap.site': '기존_Client_ID',
  'localhost:3000': '기존_Client_ID',
},
```

### 5. 설정 적용 대기
- Google Cloud Console 설정 변경 후 **5분~1시간** 정도 기다려야 적용됩니다.
- 즉시 테스트하려면 새 Client ID를 발급받는 것이 더 빠릅니다.

## 확인 방법
1. `nextstep.smap.site`에서 Google 로그인 버튼 클릭
2. Google 로그인 팝업이 정상적으로 열리는지 확인
3. 로그인 성공 후 홈 페이지로 이동하는지 확인

## 임시 해결책
설정이 완료되기 전까지는 **전화번호 로그인**을 사용하세요.

## 기술 세부사항

### 현재 오류 원인
- `nextstep.smap.site` 도메인이 Google OAuth 승인된 JavaScript 출처에 등록되지 않음
- Google Identity Services가 보안상 미등록 도메인에서의 요청을 차단

### 설정 후 동작 방식
1. 사용자가 Google 로그인 버튼 클릭
2. `nextstep.smap.site`에서 Google OAuth 서버로 요청
3. Google에서 도메인 확인 후 로그인 팝업 표시
4. 사용자 인증 완료 후 토큰 발급
5. 백엔드로 토큰 전송하여 사용자 정보 획득

### 보안 고려사항
- Client Secret은 노출되지 않도록 주의
- 승인된 도메인만 추가하여 무단 사용 방지
- HTTPS만 사용 (HTTP는 보안상 허용되지 않음)

## 추가 문의
설정 과정에서 문제가 발생하면 Google Cloud Console 지원팀에 문의하거나 개발팀에 연락하세요. 