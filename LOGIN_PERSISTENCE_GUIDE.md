# 로그인 상태 유지 기능 구현 가이드

## 개요

강제 종료 후에도 로그인 상태가 유지되도록 프론트엔드에서 로컬 스토리지를 활용한 인증 시스템을 구현했습니다.

## 주요 개선사항

### 1. 강화된 로그인 상태 검증
- JWT 토큰 유효성 검증
- 세션 기간 관리 (7일)
- 자동 토큰 갱신 (만료 24시간 전)
- 사용자 데이터 무결성 검증

### 2. 자동 사용자 정보 최신화
- 앱 시작 시 최신 사용자 정보 조회
- 강제 종료 후 복원 시 정보 최신화
- 백그라운드에서 그룹 데이터 동기화

### 3. 플랫폼 호환성
- Android WebView: DOM 스토리지 및 데이터베이스 활성화됨
- iOS WKWebView: 기본 데이터 저장소 사용
- 브라우저: localStorage + 쿠키 폴백

## 테스트 방법

### 브라우저 콘솔에서 테스트

```javascript
// 1. 현재 인증 상태 확인
SMAP_DEBUG_AUTH()

// 2. 로그인 상태 유지 테스트
SMAP_TEST_PERSISTENCE()

// 3. 수동 인증 상태 새로고침
SMAP_FORCE_REFRESH_AUTH()

// 4. 인증 데이터 초기화 (테스트용)
SMAP_CLEAR_AUTH()
```

### 수동 테스트 시나리오

1. **로그인 테스트**
   ```javascript
   // 로그인 후
   SMAP_DEBUG_AUTH()
   // → 세션 만료까지 남은 시간 확인
   ```

2. **강제 종료 시뮬레이션**
   ```javascript
   // 로그인 상태 확인
   SMAP_DEBUG_AUTH()

   // 브라우저 탭 닫기 (또는 앱 강제 종료)

   // 다시 열어서 확인
   SMAP_DEBUG_AUTH()
   // → 로그인 상태가 유지되는지 확인
   ```

3. **토큰 만료 테스트**
   ```javascript
   // 세션 정보 확인
   SMAP_AUTH_SERVICE.debugAuthState()

   // 토큰 검증 및 갱신 테스트
   SMAP_TEST_PERSISTENCE()
   ```

## 구현 세부사항

### AuthService 주요 기능

```typescript
// 로그인 상태 종합 검증
isLoggedIn(): boolean

// 토큰 검증 및 자동 갱신
checkAndRefreshToken(): Promise<boolean>

// 최신 사용자 정보 조회
getCurrentUserProfile(): Promise<UserProfile | null>

// 디버깅 정보 출력
debugAuthState(): void
```

### AuthContext 개선사항

```typescript
// 강화된 초기 인증 상태 확인
initializeAuth = async () => {
  // 1. 로그인 상태 검증
  const isLoggedIn = authService.isLoggedIn()

  // 2. 토큰 유효성 검증 및 갱신
  const tokenValid = await authService.checkAndRefreshToken()

  // 3. 최신 사용자 데이터 조회
  const updatedUserData = await authService.getCurrentUserProfile()

  // 4. 상태 업데이트 및 백그라운드 동기화
}
```

## 보안 고려사항

1. **세션 만료**: 7일 후 자동 로그아웃
2. **토큰 검증**: JWT 만료 시간 검증
3. **자동 갱신**: 만료 24시간 전 자동 토큰 갱신
4. **데이터 무결성**: 사용자 데이터 유효성 검증

## 플랫폼별 확인사항

### Android WebView
- `setDomStorageEnabled(true)` ✅
- `setDatabaseEnabled(true)` ✅
- localStorage 지원 ✅

### iOS WKWebView
- `WKWebsiteDataStore.default()` 사용 ✅
- 쿠키 및 로컬 데이터 유지 ✅

## 문제 해결

### 로그인 상태가 유지되지 않는 경우

1. **브라우저에서 테스트**
   ```javascript
   // 현재 상태 확인
   SMAP_DEBUG_AUTH()

   // 강제 초기화 후 재테스트
   SMAP_CLEAR_AUTH()
   // → 로그인 후 다시 테스트
   ```

2. **모바일 앱에서 테스트**
   - 앱 강제 종료 후 재시작
   - 브라우저 개발자 도구에서 콘솔 확인

### 토큰 만료 관련

```javascript
// 토큰 만료 확인
SMAP_AUTH_SERVICE.getSessionTimeRemaining()

// 수동 토큰 갱신
SMAP_FORCE_REFRESH_AUTH()
```

## 모니터링

콘솔 로그에서 다음 메시지들을 확인하세요:

```
[AUTH SERVICE] 로그인 상태 유효함 - 자동 로그인 유지
[AUTH SERVICE] 토큰 만료 임박, 자동 갱신 시도
[AUTH CONTEXT] 사용자 데이터 최신화 성공
```

이러한 로그들이 정상적으로 출력되면 로그인 상태 유지 기능이 올바르게 작동하고 있습니다.
