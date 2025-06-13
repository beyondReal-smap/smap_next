# 카카오 로그인 구현 가이드

## 개요
SMAP 프로젝트에 카카오 계정으로 로그인하는 기능을 구현했습니다.

## 구현된 기능

### 1. 백엔드 API
- `POST /api/auth/kakao` - 카카오 로그인 처리
- `DELETE /api/auth/kakao` - 로그아웃 처리
- `GET /api/auth/me` - 현재 사용자 정보 확인

### 2. 프론트엔드 컴포넌트
- `KakaoLogin.tsx` - 카카오 로그인 버튼 및 로직
- `AuthHeader.tsx` - 인증 상태를 표시하는 헤더 컴포넌트

### 3. 설정 파일
- `config.ts` - 카카오 앱 키 설정 추가

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가해야 합니다:

```env
# 카카오 로그인 설정
NEXT_PUBLIC_KAKAO_APP_KEY=your_kakao_javascript_key_here
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## 카카오 개발자 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com/)에 접속
2. 애플리케이션 생성
3. 플랫폼 설정에서 웹 플랫폼 추가
   - 사이트 도메인: `http://localhost:3000` (개발용)
   - Redirect URI: `http://localhost:3000` (개발용)
4. 제품 설정 > 카카오 로그인 활성화
5. 동의항목 설정:
   - 닉네임: 필수
   - 이메일: 선택

## 사용법

### 기본 사용
헤더에 로그인 버튼이 자동으로 표시됩니다. 사용자가 "로그인" 버튼을 클릭하면 모달이 열리고, 카카오 로그인 버튼을 통해 로그인할 수 있습니다.

### 커스텀 사용
`KakaoLogin` 컴포넌트를 직접 사용할 수도 있습니다:

```tsx
import KakaoLogin from './components/KakaoLogin';

function MyComponent() {
  const handleLoginSuccess = (user) => {
    console.log('로그인 성공:', user);
  };

  const handleLoginError = (error) => {
    console.error('로그인 실패:', error);
  };

  return (
    <KakaoLogin
      onLoginSuccess={handleLoginSuccess}
      onLoginError={handleLoginError}
    />
  );
}
```

## JWT 토큰 관리

- 로그인 성공 시 JWT 토큰이 쿠키에 저장됩니다
- 토큰 유효기간: 7일
- 토큰은 `auth-token` 이름으로 HttpOnly 쿠키에 저장

## 보안 고려사항

1. **환경 변수 관리**: 카카오 앱 키는 반드시 환경 변수로 관리
2. **HTTPS 사용**: 프로덕션 환경에서는 반드시 HTTPS 사용
3. **토큰 검증**: 모든 API 요청에서 JWT 토큰 검증
4. **쿠키 보안**: HttpOnly, Secure 플래그 사용

## 트러블슈팅

### 1. 카카오 SDK 로드 실패
- 네트워크 연결 확인
- 카카오 앱 키 설정 확인

### 2. 로그인 팝업이 차단됨
- 브라우저 팝업 차단 해제 안내

### 3. 토큰 만료
- 자동으로 로그아웃 처리되며, 다시 로그인 필요

## 향후 개선사항

1. **자동 토큰 갱신**: 토큰 만료 전 자동 갱신 기능
2. **다중 로그인 지원**: 구글, 네이버 등 다른 소셜 로그인 추가
3. **사용자 프로필 관리**: 프로필 이미지, 닉네임 변경 기능
4. **세션 관리**: Redis를 활용한 세션 관리

## 주의사항

- 개발 환경에서만 로그아웃 버튼이 KakaoLogin 컴포넌트에 표시됩니다
- 프로덕션 배포 시 카카오 개발자 콘솔에서 도메인 설정을 변경해야 합니다
- 카카오 정책에 따라 일부 기능이 제한될 수 있습니다 