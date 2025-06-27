# Google Sign-In 설정 가이드

## 현재 문제
Google Sign-In 오류 코드 10이 발생하는 이유는 OAuth 클라이언트 ID가 올바르게 설정되지 않았기 때문입니다.

## 현재 상황
- `google-services.json` 파일이 업데이트되어 OAuth 클라이언트 ID가 포함됨
- 웹 클라이언트 ID로 변경하여 테스트 중

## 해결 단계

### 1. Google Cloud Console에서 OAuth 클라이언트 ID 추가

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 `com-dmonster-smap` 선택
3. **API 및 서비스** > **사용자 인증 정보**로 이동
4. **사용자 인증 정보 만들기** > **OAuth 클라이언트 ID** 클릭
5. **Android** 선택
6. 다음 정보 입력:
   - **패키지 이름**: `com.dmonster.smap`
   - **SHA-1 인증서 지문**: `8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17`

### 2. Google Sign-In API 활성화

1. Google Cloud Console에서 **API 및 서비스** > **라이브러리**로 이동
2. **Google Sign-In API** 검색 및 활성화

### 3. OAuth 동의 화면 설정

1. **API 및 서비스** > **OAuth 동의 화면**으로 이동
2. **외부** 선택
3. 앱 정보 입력:
   - **앱 이름**: SMAP
   - **사용자 지원 이메일**: 개발자 이메일
   - **개발자 연락처 정보**: 개발자 이메일

### 4. SHA-1 인증서 지문 확인

#### 개발용 (Debug) SHA-1 확인:
```bash
cd AndroidWebView
./gradlew signingReport
```

#### 릴리즈용 SHA-1 확인:
```bash
keytool -list -v -keystore <your-keystore-path> -alias <your-alias>
```

### 5. google-services.json 업데이트

OAuth 클라이언트 ID를 추가한 후, 새로운 `google-services.json` 파일을 다운로드하여 `app/` 폴더에 교체하세요.

### 6. 코드에서 OAuth 클라이언트 ID 확인

`MainActivity.kt`의 `setupGoogleSignIn()` 메서드에서 올바른 클라이언트 ID를 사용하고 있는지 확인:

```kotlin
private fun setupGoogleSignIn() {
    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestIdToken("YOUR_OAUTH_CLIENT_ID_HERE") // 올바른 클라이언트 ID로 교체
        .requestEmail()
        .requestProfile()
        .build()
    
    googleSignInClient = GoogleSignIn.getClient(this, gso)
}
```

## 현재 사용 중인 클라이언트 ID

- **웹 클라이언트 ID**: `283271180972-38reu7hqcogn8b465nu2dh89f5a03ac5.apps.googleusercontent.com`
- **Android 클라이언트 ID**: `283271180972-lamjiad6ljpa02fk30k6nh6arqq4rc4o.apps.googleusercontent.com`

## 일반적인 오류 코드

- **10**: DEVELOPER_ERROR - OAuth 클라이언트 ID 설정 문제
- **12501**: SIGN_IN_CANCELLED - 사용자가 로그인 취소
- **7**: NETWORK_ERROR - 네트워크 오류
- **5**: INVALID_ACCOUNT - 잘못된 계정
- **4**: SIGN_IN_REQUIRED - 로그인 필요

## 테스트

설정 완료 후 앱을 다시 빌드하고 Google Sign-In을 테스트해보세요.

## 디버깅

앱에서 Google Sign-In 시도 시 로그를 확인하여 자세한 오류 정보를 확인할 수 있습니다:

```bash
adb logcat | grep -E "(GoogleSignIn|SMAP)"
``` 