# Google Sign-In 사용 가이드

iOS 앱에서 Google Sign-In SDK를 사용하여 네이티브 구글 로그인 기능을 구현했습니다. 이 가이드는 사용법과 구현 세부사항을 설명합니다.

## 📱 기능 개요

- **네이티브 Google Sign-In**: 웹뷰를 거치지 않고 앱 자체에서 구글 로그인 처리
- **자동 햅틱 피드백**: 로그인/로그아웃 시 자동 햅틱 제공
- **사용자 정보 자동 추출**: 이메일, 이름, 프로필 이미지 등
- **ID 토큰 제공**: 서버 인증을 위한 ID 토큰 자동 전달
- **iOS 전용**: iOS에서만 동작 (웹/Android는 기존 방식 사용)
- **signin 페이지 통합**: 기존 로그인 페이지에서 자동으로 네이티브 로그인 사용

## 🔧 설치 및 설정

### 1. CocoaPods 설치
```bash
cd iOS
pod install
```

### 2. 환경 변수 설정
`frontend/.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Google Sign-In 설정
GOOGLE_CLIENT_ID=283271180972-qnh7qqhfqtq7h7q3lktqnqnqnqnqnqnq.apps.googleusercontent.com

# NextAuth 설정
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://nextstep.smap.site

# 기타 환경 변수들
NODE_ENV=production
```

### 3. 필요한 파일들
- `iOS/Podfile`: GoogleSignIn Pod 추가 ✅
- `iOS/smap/GoogleService-Info.plist`: Firebase 설정 (GOOGLE_APP_ID, REVERSED_CLIENT_ID) ✅
- `iOS/smap/Info.plist`: URL scheme 설정 ✅
- `iOS/smap/AppDelegate.swift`: Google Sign-In 초기화 ✅
- `iOS/smap/Main/MainView.swift`: 네이티브 Google Sign-In 구현 ✅
- `frontend/src/app/api/google-auth/route.ts`: 서버 API 엔드포인트 ✅
- `frontend/src/app/signin/page.tsx`: 로그인 페이지 통합 ✅

## 🔄 자동 통합

### signin 페이지에서 자동 사용
기존 `/signin` 페이지에서 Google 로그인 버튼을 클릭하면:

1. **iOS 환경**: 자동으로 네이티브 Google Sign-In SDK 사용
2. **웹 환경**: 기존 NextAuth.js Google 로그인 사용

사용자는 별도의 설정 없이 환경에 맞는 최적의 로그인 경험을 받습니다.

### 로그인 플로우
```
iOS 앱에서 Google 로그인 버튼 클릭
    ↓
네이티브 Google Sign-In SDK 실행
    ↓
사용자 인증 (Google 계정 선택/로그인)
    ↓
ID 토큰 + 사용자 정보 획득
    ↓
/api/google-auth로 토큰 전송
    ↓
서버에서 토큰 검증 + 사용자 정보 저장
    ↓
JWT 토큰 생성 + 쿠키 설정
    ↓
AuthContext 자동 업데이트
    ↓
/home으로 자동 리다이렉트
```

## 📚 사용법

### 기본 사용 (signin 페이지)
기존 signin 페이지를 그대로 사용하면 됩니다. iOS에서는 자동으로 네이티브 Google Sign-In이 사용됩니다.

```tsx
// /signin 페이지에서 Google 로그인 버튼 클릭
// iOS: 네이티브 SDK 자동 사용
// 웹: NextAuth.js 자동 사용
```

### React Hook 사용 (커스텀 구현)

```tsx
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';

function MyComponent() {
  const { 
    isSignedIn, 
    user, 
    isLoading, 
    error, 
    isIOS, 
    signIn, 
    signOut, 
    checkSignInStatus,
    clearError 
  } = useGoogleSignIn();

  const handleLogin = () => {
    signIn();
  };

  const handleLogout = () => {
    signOut();
  };

  // iOS가 아닌 경우 다른 UI 표시
  if (!isIOS) {
    return <div>웹용 Google 로그인</div>;
  }

  return (
    <div>
      {!isSignedIn ? (
        <button onClick={handleLogin} disabled={isLoading}>
          {isLoading ? '로그인 중...' : 'Google로 로그인'}
        </button>
      ) : (
        <div>
          <p>안녕하세요, {user?.name}님!</p>
          <p>이메일: {user?.email}</p>
          <button onClick={handleLogout}>로그아웃</button>
        </div>
      )}
      
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### 컴포넌트 사용

```tsx
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

function LoginPage() {
  const handleSuccess = (user: any) => {
    console.log('로그인 성공:', user);
    // 사용자 정보를 상태관리나 서버로 전송
  };

  const handleError = (error: string) => {
    console.error('로그인 실패:', error);
    // 에러 처리
  };

  return (
    <div className="p-4">
      <h1>로그인</h1>
      <GoogleSignInButton
        onSuccess={handleSuccess}
        onError={handleError}
        className="mt-4"
      />
    </div>
  );
}
```

## 🧪 테스트

### 테스트 페이지 사용
`/test-google` 페이지에서 Google Sign-In 기능을 테스트할 수 있습니다:

```
https://nextstep.smap.site/test-google
```

이 페이지에서는:
- 환경 정보 (iOS 여부, 로그인 상태 등)
- 사용자 정보 표시
- 디버그 정보 확인
- 실제 로그인/로그아웃 테스트

### 실제 기기에서 테스트
Google Sign-In은 실제 iOS 기기에서 테스트하는 것을 권장합니다. 시뮬레이터에서는 일부 기능이 제한될 수 있습니다.

### 테스트 시나리오
1. ✅ 첫 로그인 (계정 선택)
2. ✅ 재로그인 (저장된 계정)
3. ✅ 로그아웃
4. ✅ 계정 전환
5. ✅ 네트워크 오류 상황
6. ✅ 사용자 취소 상황
7. ✅ signin 페이지에서 자동 전환

## 🔄 콜백 함수들

iOS에서 JavaScript로 결과를 전달하기 위한 전역 콜백 함수들:

### 로그인 성공
```javascript
window.googleSignInSuccess = (idToken, userInfoJson) => {
  // idToken: 서버 인증용 ID 토큰
  // userInfoJson: 사용자 정보 JSON 문자열
};
```

### 로그인 실패
```javascript
window.googleSignInError = (errorMessage) => {
  // errorMessage: 오류 메시지
};
```

### 로그아웃 성공
```javascript
window.googleSignOutSuccess = () => {
  // 로그아웃 완료
};
```

### 로그인 상태 확인 결과
```javascript
window.googleSignInStatusResult = (isSignedIn, userInfoJson) => {
  // isSignedIn: 로그인 여부 (boolean)
  // userInfoJson: 로그인된 경우 사용자 정보, 아니면 null
};
```

## 📊 사용자 정보 구조

```typescript
interface GoogleUser {
  email: string;        // 이메일 주소
  name: string;         // 전체 이름
  givenName: string;    // 이름
  familyName: string;   // 성
  imageURL: string;     // 프로필 이미지 URL (200x200)
}
```

## 🚨 에러 처리

### 일반적인 에러 유형
- **설정 오류**: GoogleService-Info.plist 파일 누락 또는 잘못된 설정
- **네트워크 오류**: 인터넷 연결 문제
- **사용자 취소**: 사용자가 로그인 과정을 취소
- **권한 거부**: 앱에 필요한 권한 거부
- **토큰 검증 실패**: 서버에서 ID 토큰 검증 실패

### 에러 처리 예시
```tsx
const { error, clearError } = useGoogleSignIn();

useEffect(() => {
  if (error) {
    // 에러 로깅
    console.error('Google Sign-In 오류:', error);
    
    // 사용자에게 알림
    alert(`로그인 중 오류가 발생했습니다: ${error}`);
    
    // 에러 상태 초기화
    setTimeout(() => {
      clearError();
    }, 3000);
  }
}, [error, clearError]);
```

## 🔒 보안 고려사항

### ID 토큰 검증
서버에서 받은 ID 토큰을 반드시 검증해야 합니다:

```javascript
// 서버 측 검증 (google-auth API에서 자동 처리)
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verify(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.error('토큰 검증 실패:', error);
    return null;
  }
}
```

### 토큰 저장
- ID 토큰은 민감한 정보이므로 안전하게 저장해야 합니다
- 서버로 즉시 전송하고 JWT 토큰으로 교환합니다
- JWT 토큰은 HttpOnly 쿠키로 저장됩니다

## 🛠️ 디버깅

### 로그 확인
iOS 시뮬레터나 기기에서 Xcode 콘솔을 통해 로그를 확인할 수 있습니다:

```
Google Sign-In 성공: {email: "user@example.com", name: "사용자 이름", ...}
ID Token: eyJhbGciOiJSUzI1NiIs...
[GOOGLE API] Google 토큰 검증 성공
[SIGNIN] 네이티브 Google 로그인 성공
```

### 일반적인 문제해결
1. **로그인 버튼이 보이지 않음**: iOS 환경인지 확인
2. **로그인 창이 열리지 않음**: URL scheme 설정 확인
3. **토큰을 받지 못함**: GoogleService-Info.plist 설정 확인
4. **서버 오류**: .env.local의 GOOGLE_CLIENT_ID 확인
5. **권한 거부 에러**: 앱 설정에서 Google 계정 연결 허용 확인

## 📋 체크리스트

### iOS 설정
- [ ] GoogleSignIn Pod 설치 완료
- [ ] GoogleService-Info.plist에 REVERSED_CLIENT_ID 추가
- [ ] Info.plist에 URL scheme 설정
- [ ] AppDelegate에 Google Sign-In 초기화 코드 추가
- [ ] MainView에 네이티브 로그인 메서드 구현

### 웹 설정
- [ ] .env.local에 GOOGLE_CLIENT_ID 설정
- [ ] google-auth-library 패키지 설치
- [ ] /api/google-auth API 엔드포인트 구현
- [ ] signin 페이지에 네이티브 로그인 통합

### 테스트
- [ ] /test-google 페이지에서 기능 확인
- [ ] 실제 iOS 기기에서 로그인 테스트
- [ ] signin 페이지에서 자동 전환 확인
- [ ] 에러 상황 처리 확인

이 가이드를 참고하여 Google Sign-In 기능을 활용하시기 바랍니다. 추가 질문이나 문제가 있으면 언제든지 문의해주세요! 