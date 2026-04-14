# Phase B — Android Refresh Token + 강제 업데이트 통합 가이드

> 본 PR로 들어간 신규 파일 3개와, 별도 정리 후 적용해야 하는 7개 수정 파일의 변경 내역을 정리합니다. 신규 파일만으로는 컴파일 통과가 아닌 **수정 파일과 함께 적용해야** 동작합니다.

## 0. 본 커밋에 포함된 파일

| 파일 | 비고 |
|------|------|
| `Android/app/src/main/java/com/dmonster/smap/data/auth/TokenStore.kt` | 신규 — 인터페이스 |
| `Android/app/src/main/java/com/dmonster/smap/data/auth/EncryptedTokenStore.kt` | 신규 — EncryptedSharedPreferences 구현 |
| `Android/app/src/main/java/com/dmonster/smap/data/api/TokenAuthenticator.kt` | 수정 — v2(body)/v1(Bearer) 분기 + Synchronized + race 회피 |

## 1. 본 커밋에서 stage하지 않은 7개 수정 파일

`Android/` worktree에 다른 진행 작업이 섞여 있어 안전을 위해 stage하지 않았습니다. 본인 worktree와 합친 뒤 별도 커밋으로 올려주세요. 현재 working copy에 이미 적용되어 있어 `git diff`로 확인할 수 있습니다.

### 1.1 `Android/app/build.gradle.kts`

`OkHttp 의존성 블록` 다음에 추가:
```kotlin
// Encrypted preferences for refresh token storage (AndroidX Security)
implementation("androidx.security:security-crypto:1.1.0-alpha06")
```

### 1.2 `Android/app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt`

`kakaoLogin(...)` 메서드 다음에 추가:
```kotlin
/** POST /auth/logout — refresh token 서버 측 revoke */
@POST("auth/logout")
suspend fun logout(@Body request: LogoutRequest): LogoutResponse

/** GET /app/version-check?platform=android&version=3.x.x — 강제 업데이트 여부 */
@GET("app/version-check")
suspend fun checkAppVersion(
    @Query("platform") platform: String = "android",
    @Query("version") version: String
): AppVersionCheckResponse
```

### 1.3 `Android/app/src/main/java/com/dmonster/smap/data/model/LoginModels.kt`

`LoginData`에 필드 추가:
```kotlin
@Serializable
data class LoginData(
    val token: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Int? = null,
    val user: SMAPUser? = null
)
```

`SocialLoginData`에 동일 필드 추가:
```kotlin
@Serializable
data class SocialLoginData(
    @SerialName("is_new_user") val isNewUser: Boolean? = null,
    val user: SMAPUser? = null,
    val token: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Int? = null
)
```

파일 끝(또는 적절한 위치)에 신규 모델 3개 추가:
```kotlin
@Serializable
data class LogoutRequest(
    @SerialName("refresh_token") val refreshToken: String
)

@Serializable
data class LogoutResponse(
    val success: Boolean = false,
    val message: String? = null
)

@Serializable
data class AppVersionCheckResponse(
    val platform: String? = null,
    @SerialName("current_version") val currentVersion: String? = null,
    @SerialName("min_supported_version") val minSupportedVersion: String? = null,
    @SerialName("update_required") val updateRequired: Boolean = false,
    @SerialName("force_update") val forceUpdate: Boolean = false
)
```

### 1.4 `Android/app/src/main/java/com/dmonster/smap/data/service/AuthService.kt`

#### (a) import 추가
```kotlin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
```

#### (b) 생성자에 `tokenStore: TokenStore` 추가
```kotlin
class AuthService(
    private val api: SmapApi,
    private val prefs: SharedPreferences,
    private val tokenStore: com.dmonster.smap.data.auth.TokenStore
) {
```

#### (c) backgroundScope 필드 추가
```kotlin
private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
```

#### (d) refresh helper 추가 (saveToken/getToken 직후)
```kotlin
fun saveRefreshToken(token: String) {
    tokenStore.saveRefreshToken(token)
    Log.d(TAG, "Refresh token saved (${token.length} chars)")
}

fun getRefreshToken(): String? = tokenStore.getRefreshToken()
```

#### (e) `logout()` 재설계 (suspend 변환 X — 호출자 호환)
```kotlin
fun logout() {
    val refresh = tokenStore.getRefreshToken()
    prefs.edit().clear().apply()
    tokenStore.clearRefreshToken()
    Log.d(TAG, "Logged out - local cleared")

    if (!refresh.isNullOrBlank()) {
        backgroundScope.launch {
            runCatching {
                api.logout(LogoutRequest(refreshToken = refresh))
            }.onFailure {
                Log.w(TAG, "Server logout request failed", it)
            }
        }
    }
}
```

#### (f) login / googleLogin / kakaoLogin 성공 경로에 한 줄씩 추가
각 함수 내부 `loginResponse.data?.token?.let { saveToken(it) }` 다음에:
```kotlin
loginResponse.data?.refreshToken?.let { saveRefreshToken(it) }
```
소셜 로그인은 `val refresh = loginResponse.data?.refreshToken` → `refresh?.let { saveRefreshToken(it) }`.

### 1.5 `Android/app/src/main/java/com/dmonster/smap/di/AppModule.kt`

```kotlin
import com.dmonster.smap.data.auth.EncryptedTokenStore
import com.dmonster.smap.data.auth.TokenStore
import dagger.Binds

// 기존 AppModule object 다음에 추가
@Module
@InstallIn(SingletonComponent::class)
abstract class AppBindModule {
    @Binds
    @Singleton
    abstract fun bindTokenStore(impl: EncryptedTokenStore): TokenStore
}
```

### 1.6 `Android/app/src/main/java/com/dmonster/smap/di/ServiceModule.kt`

```kotlin
import com.dmonster.smap.data.auth.TokenStore

// provideAuthService 시그니처 변경
@Provides @Singleton
fun provideAuthService(
    api: SmapApi,
    prefs: SharedPreferences,
    tokenStore: TokenStore
): AuthService = AuthService(api, prefs, tokenStore)
```

### 1.7 `Android/app/src/main/java/com/dmonster/smap/ui/splash/SplashActivity.kt`

#### (a) import 추가
```kotlin
import android.app.AlertDialog
import android.net.Uri
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.api.SmapApi
```

#### (b) 필드 주입
```kotlin
@Inject lateinit var smapApi: SmapApi
```

#### (c) 스플래시 딜레이 분기 변경
```kotlin
lifecycleScope.launch {
    delay(SPLASH_DELAY)
    keepSplashScreen = false

    if (checkForceUpdate()) {
        return@launch  // 다이얼로그 표시 후 멈춤
    }
    navigateNext()
}
```

#### (d) 메서드 3개 추가
```kotlin
private suspend fun checkForceUpdate(): Boolean {
    val response = runCatching {
        smapApi.checkAppVersion(version = BuildConfig.VERSION_NAME)
    }.getOrNull() ?: return false
    if (!response.forceUpdate) return false
    showForceUpdateDialog(response.minSupportedVersion ?: "")
    return true
}

private fun showForceUpdateDialog(minVersion: String) {
    AlertDialog.Builder(this)
        .setCancelable(false)
        .setTitle("업데이트 필요")
        .setMessage("새 버전이 있어 업데이트 후 이용해 주세요.\n(현재 ${BuildConfig.VERSION_NAME} → 최소 $minVersion)")
        .setPositiveButton("스토어로 이동") { _, _ -> openPlayStore(); finish() }
        .setNegativeButton("종료") { _, _ -> finish() }
        .show()
}

private fun openPlayStore() {
    val pkg = packageName
    val intent = runCatching {
        Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
    }.getOrElse {
        Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { startActivity(intent) }.onFailure {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
    }
}
```

## 2. 적용 절차

1. 위 변경을 본인 worktree에 합쳐 컴파일 통과 확인.
2. Phase A 백엔드(`docs/phase-a-integration-guide.md`)도 함께 배포되어야 동작.
3. Play Console에 새 빌드 업로드.
4. **롤아웃 후** 백엔드 `MIN_APP_VERSION_ANDROID`를 신버전 번호로 올려 구버전 차단 활성화.

## 3. 검증

- 새로 로그인 시 `EncryptedSharedPreferences("smap_secure_prefs")`에 refresh_token 저장됨 (`adb shell run-as com.dmonster.smap ls /data/data/com.dmonster.smap/shared_prefs/`).
- 401 응답 시 logcat에서 `TokenAuthenticator: Token refreshed (v=v2); retrying ...` 확인.
- 강제 업데이트 시나리오: 백엔드 `MIN_APP_VERSION_ANDROID`를 현재 빌드보다 높게 → 앱 시작 시 다이얼로그 노출.
