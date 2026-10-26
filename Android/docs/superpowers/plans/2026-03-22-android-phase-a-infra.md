# Android Phase A: 인프라 현대화 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hilt DI + Retrofit + Kotlinx Serialization 도입으로 Android 앱 아키텍처 현대화. 수동 싱글턴과 OkHttp 보일러플레이트 제거, 통합 네트워크 레이어 구축.

**Architecture:** build.gradle.kts에 의존성 추가 → Hilt DI 모듈 설정 → Retrofit API 인터페이스 생성 → 데이터 모델 @Serializable 전환 → 각 Service를 Retrofit 위임으로 간소화 → ViewModel을 @HiltViewModel로 전환. 각 태스크는 독립적으로 빌드 가능.

**Tech Stack:** Kotlin, Hilt, Retrofit2, Kotlinx Serialization, OkHttp, Jetpack Compose

**Spec:** `Android/docs/superpowers/specs/2026-03-22-android-infra-modernization-design.md`

**Working Directory:** `/Users/genie/SmapSource/smap_next/Android`

---

## File Map

### New Files
```
app/src/main/java/com/dmonster/smap/
├── di/
│   ├── NetworkModule.kt        # @Module: OkHttpClient, Retrofit, SmapApi
│   ├── ServiceModule.kt        # @Module: Service 바인딩
│   └── AppModule.kt            # @Module: SharedPreferences 등
├── data/
│   └── api/
│       ├── SmapApi.kt           # Retrofit 인터페이스
│       ├── AuthInterceptor.kt   # Bearer 토큰 자동 주입
│       └── ApiResult.kt         # 통합 에러 핸들링

app/src/test/java/com/dmonster/smap/
├── data/api/
│   └── SmapApiTest.kt           # Retrofit 엔드포인트 테스트
└── data/service/
    └── GroupServiceTest.kt      # Service 통합 테스트
```

### Modified Files
```
app/build.gradle.kts              # Hilt, Retrofit, Serialization, minSdk 28
build.gradle.kts (root)           # Hilt/KSP 플러그인
gradle.properties                 # BuildConfig URL 추가
SmapApplication.kt                # @HiltAndroidApp
MainActivity.kt                   # @AndroidEntryPoint
ui/login/LoginActivity.kt         # @AndroidEntryPoint
ui/register/RegisterActivity.kt   # @AndroidEntryPoint
ui/splash/SplashActivity.kt       # @AndroidEntryPoint
data/model/*.kt (8 files)         # @Serializable + @SerialName
data/service/*.kt (8 files)       # @Inject constructor, Retrofit 위임
ui/*/ViewModel.kt (10 files)      # @HiltViewModel + @Inject constructor
```

---

## Task 1: build.gradle.kts 업데이트

**Files:**
- Modify: `build.gradle.kts` (root)
- Modify: `app/build.gradle.kts`
- Modify: `gradle.properties`

- [ ] **Step 1: Root build.gradle.kts에 Hilt + KSP 플러그인 추가**

Read the current root `build.gradle.kts`, then add:
```kotlin
plugins {
    // ... existing plugins
    id("com.google.dagger.hilt.android") version "2.51.1" apply false
    id("com.google.devtools.ksp") version "1.9.24-1.0.20" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.24" apply false
}
```

NOTE: KSP version must match Kotlin version. Current Kotlin is 1.9.24, so KSP is `1.9.24-1.0.20`.

- [ ] **Step 2: app/build.gradle.kts 업데이트**

Add plugins:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.serialization")
}
```

Change minSdk:
```kotlin
minSdk = 28
```

Add BuildConfig fields to defaultConfig:
```kotlin
defaultConfig {
    // ... existing
    buildConfigField("String", "API_BASE_URL", "\"https://api3.aiagnt.kr/api/v1/\"")
    buildConfigField("String", "IMAGE_BASE_URL", "\"https://api3.aiagnt.kr\"")
    buildConfigField("String", "WEB_BASE_URL", "\"https://nextstep.aiagnt.kr\"")
}
```

Add dependencies:
```kotlin
dependencies {
    // ... existing dependencies

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-android-compiler:2.51.1")

    // Retrofit
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Kotlinx Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")

    // Testing
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("app.cash.turbine:turbine:1.0.0")
}
```

Keep existing OkHttp and Gson deps for now (removed in Task 10).

- [ ] **Step 3: Gradle sync & build**

```bash
cd /Users/genie/SmapSource/smap_next/Android && ./gradlew assembleDebug 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add build.gradle.kts app/build.gradle.kts gradle.properties
git commit -m "chore: add Hilt, Retrofit, Kotlinx Serialization dependencies, minSdk 28"
```

---

## Task 2: Hilt 설정 (Application + Activities)

**Files:**
- Modify: `SmapApplication.kt` → `@HiltAndroidApp`
- Modify: `MainActivity.kt` → `@AndroidEntryPoint`
- Modify: `ui/login/LoginActivity.kt` → `@AndroidEntryPoint`
- Modify: `ui/register/RegisterActivity.kt` → `@AndroidEntryPoint`
- Modify: `ui/splash/SplashActivity.kt` → `@AndroidEntryPoint`
- Create: `di/AppModule.kt`

- [ ] **Step 1: SmapApplication에 @HiltAndroidApp 추가**

```kotlin
@HiltAndroidApp
class SmapApplication : Application() { ... }
```

- [ ] **Step 2: 모든 Activity에 @AndroidEntryPoint 추가**

각 Activity 클래스 앞에 `@AndroidEntryPoint` annotation 추가. 기존 코드는 변경하지 않음.

- [ ] **Step 3: AppModule 생성**

Create: `app/src/main/java/com/dmonster/smap/di/AppModule.kt`
```kotlin
package com.dmonster.smap.di

import android.content.Context
import android.content.SharedPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideSharedPreferences(@ApplicationContext context: Context): SharedPreferences {
        return context.getSharedPreferences("smap_auth_prefs", Context.MODE_PRIVATE)
    }
}
```

- [ ] **Step 4: Build verify**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add Hilt DI setup (Application, Activities, AppModule)"
```

---

## Task 3: Retrofit + AuthInterceptor + SmapApi

**Files:**
- Create: `data/api/AuthInterceptor.kt`
- Create: `data/api/SmapApi.kt`
- Create: `data/api/ApiResult.kt`
- Create: `di/NetworkModule.kt`

- [ ] **Step 1: AuthInterceptor**

Create: `app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt`
```kotlin
package com.dmonster.smap.data.api

import android.content.SharedPreferences
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val prefs: SharedPreferences
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = prefs.getString("auth_token", null)
        val request = chain.request().newBuilder().apply {
            token?.let { addHeader("Authorization", "Bearer $it") }
            addHeader("Content-Type", "application/json")
        }.build()
        return chain.proceed(request)
    }
}
```

- [ ] **Step 2: ApiResult**

Create: `app/src/main/java/com/dmonster/smap/data/api/ApiResult.kt`
```kotlin
package com.dmonster.smap.data.api

import retrofit2.HttpException
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    data class NetworkError(val exception: Exception) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(call())
    } catch (e: HttpException) {
        ApiResult.Error(e.code(), e.message())
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    }
}
```

- [ ] **Step 3: SmapApi (Retrofit 인터페이스)**

Create: `app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt`

이 파일은 크므로 implementer가 스펙의 SmapApi 인터페이스를 참조하여 작성. 핵심 엔드포인트:
- Auth: login, googleLogin, appleLogin, register
- Profile: fetchProfile, updateProfile, changePassword, uploadProfileImage, withdraw
- Groups: getGroups, createGroup, updateGroup, deleteGroup, joinGroup, getGroupMembers, getGroupStats
- Locations: getMemberLocations, createLocation, updateLocation, deleteLocation
- Schedules: getGroupSchedules, createSchedule, updateSchedule, deleteSchedule
- Notifications: getPushLogs, markRead, markAllRead, deleteNotification
- ActivityLog: getActivityLog, getDailyCounts
- FCM: registerFcmToken

NOTE: 현재 Service 파일들의 실제 엔드포인트 URL과 HTTP 메서드를 읽어서 정확히 매핑.

- [ ] **Step 4: NetworkModule**

Create: `app/src/main/java/com/dmonster/smap/di/NetworkModule.kt`
```kotlin
package com.dmonster.smap.di

import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.api.AuthInterceptor
import com.dmonster.smap.data.api.SmapApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                        else HttpLoggingInterceptor.Level.NONE
            })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    fun provideSmapApi(retrofit: Retrofit): SmapApi {
        return retrofit.create(SmapApi::class.java)
    }
}
```

- [ ] **Step 5: Build verify & commit**

```bash
git commit -m "feat: add Retrofit + AuthInterceptor + SmapApi + NetworkModule"
```

---

## Task 4: 데이터 모델 @Serializable 전환

**Files:**
- Modify: `data/model/*.kt` (8 files)

- [ ] **Step 1: 모든 모델 파일에서 Gson 어노테이션을 Kotlinx Serialization으로 교체**

각 data class에서:
```kotlin
// Before
import com.google.gson.annotations.SerializedName

data class SmapGroup(
    @SerializedName("sgt_idx") val sgtIdx: Int,
    @SerializedName("sgt_title") val sgtTitle: String? = null,
)

// After
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SmapGroup(
    @SerialName("sgt_idx") val sgtIdx: Int,
    @SerialName("sgt_title") val sgtTitle: String? = null,
)
```

8개 모델 파일 전부: LoginModels.kt, HomeModels.kt, ActivityLogModels.kt, LegalContent.kt, SettingsModels.kt, MyPlaceModels.kt, RegisterModels.kt, NotificationModels.kt

**NOTE:**
- `@SerializedName` → `@SerialName`
- `import com.google.gson.annotations.SerializedName` → `import kotlinx.serialization.SerialName`
- 각 data class에 `@Serializable` 추가
- 기본값이 없는 nullable 필드에 `= null` 추가 (Kotlinx Serialization은 더 strict)

- [ ] **Step 2: Build verify & commit**

```bash
git commit -m "refactor: migrate data models from Gson to Kotlinx Serialization"
```

---

## Task 5: Service 마이그레이션 (8개 → Retrofit 위임)

**Files:**
- Modify: `data/service/*.kt` (8 files)
- Create: `di/ServiceModule.kt`

이것이 가장 큰 태스크. 각 Service의 수동 OkHttp 코드를 SmapApi 위임으로 교체.

- [ ] **Step 1: ServiceModule 생성**

Create: `app/src/main/java/com/dmonster/smap/di/ServiceModule.kt`
```kotlin
package com.dmonster.smap.di

import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.service.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ServiceModule {
    @Provides @Singleton
    fun provideAuthService(api: SmapApi, prefs: SharedPreferences): AuthService = AuthService(api, prefs)

    @Provides @Singleton
    fun provideGroupService(api: SmapApi): GroupService = GroupService(api)

    @Provides @Singleton
    fun provideHomeService(api: SmapApi): HomeService = HomeService(api)

    @Provides @Singleton
    fun provideScheduleService(api: SmapApi): ScheduleService = ScheduleService(api)

    @Provides @Singleton
    fun provideMyPlaceService(api: SmapApi): MyPlaceService = MyPlaceService(api)

    @Provides @Singleton
    fun provideNotificationService(api: SmapApi): NotificationService = NotificationService(api)

    @Provides @Singleton
    fun provideActivityLogService(api: SmapApi): ActivityLogService = ActivityLogService(api)
}
```

- [ ] **Step 2: 각 Service를 Retrofit 위임으로 리팩토링**

Implementer가 각 Service를 읽고, 모든 메서드를 SmapApi 위임으로 교체:

```kotlin
// Before (GroupService.kt — 429줄)
class GroupService private constructor(private val context: Context) {
    companion object { ... getInstance() ... }
    private val httpClient = OkHttpClient.Builder().build()

    suspend fun getGroups(): List<SmapGroup> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$BASE_URL/groups/current-user")
            .addHeader("Authorization", "Bearer ${authService.getToken()}")
            .get().build()
        val response = httpClient.newCall(request).execute()
        Gson().fromJson(response.body?.string(), ...)
    }
}

// After (~80줄)
class GroupService @Inject constructor(private val api: SmapApi) {
    suspend fun getGroups() = api.getCurrentUserGroups()
    suspend fun getGroupMembers(sgtIdx: Int) = api.getGroupMembers(sgtIdx)
    suspend fun getGroupStats(sgtIdx: Int) = api.getGroupStats(sgtIdx)
    suspend fun createGroup(title: String, memo: String) = api.createGroup(CreateGroupRequest(title, memo))
    // ...
}
```

핵심: companion object 싱글턴 패턴 전부 제거. `@Inject constructor`로 교체.

- [ ] **Step 3: Build verify & commit**

```bash
git commit -m "refactor: migrate all Services to Retrofit, add ServiceModule"
```

---

## Task 6: ViewModel @HiltViewModel 전환

**Files:**
- Modify: `ui/*/ViewModel.kt` (10 files)

- [ ] **Step 1: 모든 ViewModel을 @HiltViewModel로 전환**

```kotlin
// Before
class GroupViewModel(application: Application) : AndroidViewModel(application) {
    private val groupService = GroupService.getInstance(application)
}

// After
@HiltViewModel
class GroupViewModel @Inject constructor(
    private val groupService: GroupService
) : ViewModel() {
    // 동일한 로직, AndroidViewModel → ViewModel
}
```

10개 ViewModel: LoginViewModel, HomeViewModel, GroupViewModel, ScheduleViewModel, MyPlaceViewModel, SettingsViewModel, ActivityLogViewModel, RegisterViewModel, ForgotPasswordViewModel, NotificationViewModel

**NOTE:**
- `AndroidViewModel(application)` → `ViewModel()` (Application 컨텍스트 불필요해짐)
- `Service.getInstance(application)` → constructor injection
- UI 코드에서 `viewModel()` 호출은 Hilt가 자동 처리 (`hiltViewModel()`)

- [ ] **Step 2: UI 코드에서 viewModel 생성 방식 업데이트**

Compose에서:
```kotlin
// Before
val viewModel: GroupViewModel = viewModel()

// After (Hilt)
val viewModel: GroupViewModel = hiltViewModel()
```

`hiltViewModel()` 사용을 위해 import 추가:
```kotlin
import androidx.hilt.navigation.compose.hiltViewModel
```

그리고 dependency 추가 (Task 1에서 이미 추가되어 있어야 함):
```kotlin
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
```

- [ ] **Step 3: Build verify & commit**

```bash
git commit -m "refactor: migrate ViewModels to @HiltViewModel with constructor injection"
```

---

## Task 7: 하드코딩 URL 제거 (UI 레이어)

**Files:** UI 파일들에서 하드코딩된 URL을 BuildConfig로 교체

- [ ] **Step 1: 하드코딩 URL 찾기**

```bash
grep -rn "api3.aiagnt.kr\|nextstep.aiagnt.kr" app/src/main/java/ --include="*.kt" | grep -v "service/" | grep -v "BuildConfig"
```

- [ ] **Step 2: 각 참조를 BuildConfig로 교체**

```kotlin
// Before
"https://api3.aiagnt.kr/images/$path"

// After
"${BuildConfig.IMAGE_BASE_URL}/images/$path"
```

```kotlin
// Before
"https://nextstep.aiagnt.kr$path"

// After
"${BuildConfig.WEB_BASE_URL}$path"
```

- [ ] **Step 3: Service 파일의 companion object BASE_URL도 제거**

이미 Task 5에서 Retrofit이 BuildConfig.API_BASE_URL을 사용하므로, Service의 `private const val BASE_URL` 상수 제거.

- [ ] **Step 4: Build verify & commit**

```bash
git commit -m "refactor: replace hardcoded URLs with BuildConfig constants"
```

---

## Task 8: 테스트 인프라 + 핵심 테스트

**Files:**
- Create: `app/src/test/java/com/dmonster/smap/data/api/SmapApiTest.kt`
- Create: `app/src/test/java/com/dmonster/smap/data/service/GroupServiceTest.kt`

- [ ] **Step 1: SmapApi 엔드포인트 테스트**

MockWebServer로 Retrofit 엔드포인트 검증:
```kotlin
@Test
fun `getGroups returns list`() = runTest {
    server.enqueue(MockResponse().setBody("""[{"sgt_idx": 1, "sgt_title": "Test"}]"""))
    val result = api.getCurrentUserGroups()
    assertEquals(1, result.size)
    assertEquals("Test", result[0].sgtTitle)
}
```

- [ ] **Step 2: GroupService 통합 테스트**

```kotlin
@Test
fun `getGroups delegates to api`() = runTest {
    server.enqueue(MockResponse().setBody("[]"))
    val result = service.getGroups()
    assertTrue(result.isEmpty())
}
```

- [ ] **Step 3: 테스트 실행**

```bash
./gradlew test 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git commit -m "test: add SmapApi and GroupService tests with MockWebServer"
```

---

## Task 9: Gson 제거 + OkHttp 직접 사용 정리

**Files:** 전체 app/src/main/java/

- [ ] **Step 1: 남은 Gson import 확인 & 제거**

```bash
grep -rn "import com.google.gson" app/src/main/java/ --include="*.kt"
```

각 파일에서 Gson import와 사용을 제거. Retrofit이 Kotlinx Serialization으로 자동 변환하므로 수동 Gson 파싱 불필요.

일부 파일에서 Gson이 아직 필요한 경우 (예: FCM 메시지 파싱), 해당 부분만 Kotlinx Serialization의 `Json.decodeFromString()`으로 교체.

- [ ] **Step 2: 직접 OkHttpClient 생성 제거**

```bash
grep -rn "OkHttpClient.Builder\|OkHttpClient()" app/src/main/java/ --include="*.kt" | grep -v "di/"
```

Service/ViewModel에서 직접 `OkHttpClient()`를 생성하는 코드 제거 (Hilt가 주입한 인스턴스 사용).

- [ ] **Step 3: build.gradle.kts에서 Gson 의존성 제거**

```kotlin
// 제거
implementation("com.google.code.gson:gson:2.11.0")
implementation("org.json:json:20240303")
```

- [ ] **Step 4: Build verify & commit**

```bash
git commit -m "chore: remove Gson dependency, clean up direct OkHttpClient usage"
```

---

## Task 10: 전체 빌드 & 테스트 검증

- [ ] **Step 1: 전체 테스트**

```bash
./gradlew test 2>&1 | tail -10
```

- [ ] **Step 2: 전체 빌드**

```bash
./gradlew assembleDebug 2>&1 | tail -5
```

- [ ] **Step 3: 정리 확인**

```bash
# Gson 잔여 확인
grep -rn "Gson\|SerializedName" app/src/main/java/ --include="*.kt" | wc -l
# 직접 OkHttpClient 확인
grep -rn "OkHttpClient()\|OkHttpClient.Builder" app/src/main/java/ --include="*.kt" | grep -v "di/" | wc -l
# companion object getInstance 확인
grep -rn "fun getInstance" app/src/main/java/ --include="*.kt" | wc -l
```

모두 0이어야 함.

---

## Summary

| Task | 핵심 | 파일 |
|------|------|------|
| 1 | build.gradle.kts (deps, minSdk) | 3 수정 |
| 2 | Hilt 설정 (App, Activities) | 5 수정 + 1 생성 |
| 3 | Retrofit + SmapApi + Auth | 3 생성 + 1 생성 |
| 4 | 모델 @Serializable | 8 수정 |
| 5 | Service → Retrofit 위임 | 8 수정 + 1 생성 |
| 6 | ViewModel → @HiltViewModel | 10 수정 |
| 7 | 하드코딩 URL → BuildConfig | ~10 수정 |
| 8 | 테스트 | 2 생성 |
| 9 | Gson/OkHttp 정리 | ~15 수정 |
| 10 | 검증 | - |

**완료 후:**
- minSdk 28, Hilt DI 전체, Retrofit 통합 네트워크
- Service 코드량 2,414줄 → ~570줄 (-76%)
- 수동 싱글턴 0개, 하드코딩 URL 0개
- Kotlinx Serialization, 테스트 인프라 구축
