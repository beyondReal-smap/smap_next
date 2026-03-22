# Android 인프라 현대화 — Hilt DI, Retrofit, Kotlinx Serialization

## Overview

SMAP Android 앱의 아키텍처 인프라를 현대화. 수동 싱글턴 → Hilt DI, 직접 OkHttp → Retrofit, Gson → Kotlinx Serialization, 하드코딩 URL → BuildConfig, 테스트 인프라 구축.

**현재 상태:**
- 26,608줄 / 82개 Kotlin 파일, 100% Jetpack Compose
- minSdk 24, compileSdk 35
- OkHttp 직접 사용 (50+ 개별 OkHttpClient 인스턴스 생성)
- Gson JSON 파싱
- 수동 싱글턴 패턴 (companion object getInstance)
- DI 프레임워크 없음
- 하드코딩 API URL 20곳+, API 키 코드 내 노출
- 테스트 0개
- Service 레이어 2,414줄 (보일러플레이트 대부분)

**목표 상태:**
- minSdk 28 (Android 9.0)
- Hilt DI 전체 적용 (@HiltAndroidApp, @AndroidEntryPoint, @HiltViewModel)
- Retrofit + Kotlinx Serialization 통합 네트워크 레이어
- AuthInterceptor 자동 토큰 주입
- BuildConfig 기반 설정 중앙화
- Result<T> 통합 에러 핸들링
- 테스트 인프라 (MockWebServer, Turbine)
- Service 레이어 ~570줄 (-76%)

---

## Architecture

### 신규 파일 구조

```
com/dmonster/smap/
├── SmapApplication.kt          # @HiltAndroidApp
├── di/
│   ├── NetworkModule.kt        # OkHttpClient, Retrofit, SmapApi 제공
│   ├── ServiceModule.kt        # Service 바인딩
│   └── AppModule.kt            # SharedPreferences, 기타
├── data/
│   ├── api/
│   │   ├── SmapApi.kt          # Retrofit 인터페이스 (모든 엔드포인트)
│   │   ├── AuthInterceptor.kt  # Bearer 토큰 자동 주입
│   │   └── ApiResult.kt        # Result<T> 래퍼 + 에러 타입
│   ├── model/                  # 기존 유지, @Serializable 추가
│   └── service/                # Retrofit 위임으로 간소화
└── ui/                         # @AndroidEntryPoint, @HiltViewModel 적용
```

### Hilt DI 구조

```kotlin
// NetworkModule.kt
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient

    @Provides @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit

    @Provides @Singleton
    fun provideSmapApi(retrofit: Retrofit): SmapApi
}

// ServiceModule.kt
@Module
@InstallIn(SingletonComponent::class)
object ServiceModule {
    @Provides @Singleton
    fun provideAuthService(api: SmapApi, prefs: SharedPreferences): AuthService
    // ... 나머지 Service
}
```

### Retrofit 인터페이스

```kotlin
interface SmapApi {
    // Auth
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @POST("auth/google-login")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): SocialLoginResponse

    @POST("auth/apple-login")
    suspend fun appleLogin(@Body request: AppleLoginRequest): AppleLoginResponse

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): LoginResponse

    // Profile
    @GET("members/me")
    suspend fun fetchProfile(): SmapUser

    @POST("members/update-profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): UpdateProfileResponse

    @POST("members/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): ChangePasswordResponse

    @Multipart
    @POST("members/upload-profile-image")
    suspend fun uploadProfileImage(@Part file: MultipartBody.Part): ProfileImageResponse

    @POST("members/verify-password")
    suspend fun verifyPassword(@Body request: VerifyPasswordRequest): VerifyPasswordResponse

    @POST("members/withdraw")
    suspend fun withdraw(@Body request: WithdrawRequest): WithdrawResponse

    // Groups
    @GET("groups/current-user")
    suspend fun getCurrentUserGroups(): List<SmapGroup>

    @GET("groups/{sgtIdx}/stats")
    suspend fun getGroupStats(@Path("sgtIdx") sgtIdx: Int): StatsResponse

    @POST("groups/")
    suspend fun createGroup(@Body request: CreateGroupRequest): GroupCreateResponse

    @PUT("groups/{sgtIdx}")
    suspend fun updateGroup(@Path("sgtIdx") sgtIdx: Int, @Body request: UpdateGroupRequest): GroupCreateResponse

    @PUT("groups/{sgtIdx}")
    suspend fun deleteGroup(@Path("sgtIdx") sgtIdx: Int, @Body request: DeleteGroupRequest): Response<Unit>

    @GET("groups/code/{code}")
    suspend fun getGroupByCode(@Path("code") code: String): SmapGroup

    @POST("groups/{sgtIdx}/join")
    suspend fun joinGroup(@Path("sgtIdx") sgtIdx: Int, @Body request: JoinGroupRequest): Response<Unit>

    // Group Members
    @GET("group-members/member/{sgtIdx}")
    suspend fun getGroupMembers(@Path("sgtIdx") sgtIdx: Int): List<SmapGroupMember>

    @PUT("group-members/{sgtIdx}/role")
    suspend fun updateMemberRole(@Path("sgtIdx") sgtIdx: Int, @Body request: UpdateRoleRequest): SimpleResponse

    @DELETE("group-members/{sgtIdx}/member/{mtIdx}")
    suspend fun removeMember(@Path("sgtIdx") sgtIdx: Int, @Path("mtIdx") mtIdx: Int): SimpleResponse

    // Locations (MyPlace)
    @GET("locations/member/{memberId}")
    suspend fun getMemberLocations(@Path("memberId") memberId: Int): List<SavedLocation>

    @POST("locations/members/{memberId}/locations")
    suspend fun createLocation(@Path("memberId") memberId: Int, @Body request: LocationCreateRequest): LocationActionResponse

    @PUT("locations/{locationId}")
    suspend fun updateLocation(@Path("locationId") locationId: Int, @Body request: LocationUpdateRequest): SimpleResponse

    @DELETE("locations/{locationId}")
    suspend fun deleteLocation(@Path("locationId") locationId: Int): Response<Unit>

    @PUT("locations/{locationId}/notification")
    suspend fun toggleLocationNotification(@Path("locationId") locationId: Int, @Body request: ToggleNotificationRequest): Response<Unit>

    // Schedules
    @GET("schedules/group/{sgtIdx}")
    suspend fun getGroupSchedules(@Path("sgtIdx") sgtIdx: Int): ScheduleListResponse

    @POST("schedules/")
    suspend fun createSchedule(@Body request: CreateScheduleRequest): SimpleResponse

    @PUT("schedules/{scheduleId}")
    suspend fun updateSchedule(@Path("scheduleId") scheduleId: Int, @Body request: UpdateScheduleRequest): SimpleResponse

    @DELETE("schedules/{scheduleId}")
    suspend fun deleteSchedule(@Path("scheduleId") scheduleId: Int): Response<Unit>

    // Notifications
    @GET("push-logs/member/{memberId}")
    suspend fun getMemberPushLogs(@Path("memberId") memberId: Int): List<PushLog>

    @PATCH("push-logs/{notificationId}/read")
    suspend fun markNotificationRead(@Path("notificationId") notificationId: Int): Response<Unit>

    @POST("push-logs/read-all")
    suspend fun markAllNotificationsRead(@Query("mt_idx") memberId: Int): NotificationActionResponse

    @DELETE("push-logs/{notificationId}")
    suspend fun deleteNotification(@Path("notificationId") notificationId: Int): Response<Unit>

    @POST("push-logs/delete-all")
    suspend fun deleteAllNotifications(@Query("mt_idx") memberId: Int): NotificationActionResponse

    // Activity Log
    @GET("logs/activity/{memberId}")
    suspend fun getActivityLog(@Path("memberId") memberId: Int, @Query("date") date: String): ActivityLogResponse

    @GET("logs/daily-counts/{groupId}")
    suspend fun getDailyCounts(@Path("groupId") groupId: Int, @Query("month") month: String): DailyCountsResponse

    // Location Logging
    @POST("logs/member-location-logs")
    suspend fun createLocationLog(@Body request: LocationLogRequest): Response<Unit>

    // FCM
    @POST("member-fcm-token/register")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): Response<Unit>

    // Groups Summary
    @GET("groups/current-user/summary")
    suspend fun getGroupSummary(): GroupSummary
}
```

### AuthInterceptor

```kotlin
class AuthInterceptor @Inject constructor(
    private val tokenProvider: () -> String?
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
        tokenProvider()?.let { token ->
            request.addHeader("Authorization", "Bearer $token")
        }
        return chain.proceed(request.build())
    }
}
```

### ApiResult 통합 에러 핸들링

```kotlin
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

### BuildConfig 설정 중앙화

```kotlin
// app/build.gradle.kts
android {
    defaultConfig {
        minSdk = 28
        buildConfigField("String", "API_BASE_URL", "\"https://api3.smap.site/api/v1/\"")
        buildConfigField("String", "IMAGE_BASE_URL", "\"https://api3.smap.site\"")
        buildConfigField("String", "WEB_BASE_URL", "\"https://nextstep.smap.site\"")
        buildConfigField("String", "KAKAO_API_KEY", "\"...\"")
    }
    buildFeatures {
        buildConfig = true
    }
}
```

### 데이터 모델 전환

```kotlin
// Before (Gson)
data class SmapGroup(
    @SerializedName("sgt_idx") val sgtIdx: Int,
    @SerializedName("sgt_title") val sgtTitle: String?,
)

// After (Kotlinx Serialization)
@Serializable
data class SmapGroup(
    @SerialName("sgt_idx") val sgtIdx: Int,
    @SerialName("sgt_title") val sgtTitle: String? = null,
)
```

### Service 간소화 예시

```kotlin
// Before (GroupService.kt — 429줄)
class GroupService private constructor(private val context: Context) {
    companion object {
        @Volatile private var instance: GroupService? = null
        fun getInstance(context: Context): GroupService = ...
    }
    private val authService = AuthService.getInstance(context)

    suspend fun getCurrentUserGroups(): List<SmapGroup> {
        return withContext(Dispatchers.IO) {
            val client = OkHttpClient()
            val request = Request.Builder()
                .url("https://api3.smap.site/api/v1/groups/current-user")
                .addHeader("Authorization", "Bearer ${authService.getToken()}")
                .get().build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty")
            Gson().fromJson(body, Array<SmapGroup>::class.java).toList()
        }
    }
    // ... 10+ similar methods
}

// After (GroupService.kt — ~80줄)
class GroupService @Inject constructor(private val api: SmapApi) {
    suspend fun getCurrentUserGroups(): List<SmapGroup> = api.getCurrentUserGroups()
    suspend fun getGroupMembers(sgtIdx: Int) = api.getGroupMembers(sgtIdx)
    suspend fun getGroupStats(sgtIdx: Int) = api.getGroupStats(sgtIdx)
    suspend fun createGroup(title: String, memo: String) = api.createGroup(CreateGroupRequest(title, memo))
    // ... 얇은 래퍼들
}
```

### ViewModel 전환 예시

```kotlin
// Before
class GroupViewModel(application: Application) : AndroidViewModel(application) {
    private val groupService = GroupService.getInstance(application)
    // ...
}

// After
@HiltViewModel
class GroupViewModel @Inject constructor(
    private val groupService: GroupService
) : ViewModel() {
    // ... 동일한 로직, DI로 주입
}
```

---

## 마이그레이션 태스크 순서

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | build.gradle.kts 업데이트 (Hilt, Retrofit, Serialization, minSdk 28) | 없음 |
| 2 | Hilt 설정 (Application, Activities, DI modules) | 1 |
| 3 | Retrofit + AuthInterceptor + SmapApi | 2 |
| 4 | BuildConfig 설정 중앙화 | 1 |
| 5 | 데이터 모델 @Serializable 전환 | 1 |
| 6 | Service 마이그레이션 (8개 → Retrofit 위임) | 3, 5 |
| 7 | ViewModel @HiltViewModel 전환 | 2, 6 |
| 8 | 하드코딩 URL 제거 (UI 레이어) | 4 |
| 9 | 테스트 인프라 + 핵심 테스트 | 3, 6 |
| 10 | OkHttpClient 직접 생성 정리 + Gson import 제거 | 6 |

---

## 예상 변화

| 항목 | Before | After |
|------|--------|-------|
| minSdk | 24 | 28 |
| DI | 수동 싱글턴 | Hilt |
| 네트워크 | OkHttp 직접 (50+ 인스턴스) | Retrofit 단일 인스턴스 |
| JSON | Gson | Kotlinx Serialization |
| Service 코드량 | 2,414줄 | ~570줄 (-76%) |
| 하드코딩 URL | 20곳+ | 0곳 (BuildConfig) |
| API 키 노출 | 코드 내 | BuildConfig |
| 테스트 | 0개 | 핵심 테스트 ~20개 |
| 에러 핸들링 | 145개 try-catch 산재 | ApiResult<T> 통합 |
