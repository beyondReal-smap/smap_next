package com.dmonster.smap.data.api

import com.dmonster.smap.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

/**
 * Single Retrofit interface for all SMAP backend API endpoints.
 * Base URL: Configured via BuildConfig.API_BASE_URL
 *
 * Note: KakaoLocationService uses a different base URL and auth header,
 * so it is NOT included here.
 */
interface SmapApi {

    // =========================================================================
    // Auth endpoints (from AuthService)
    // =========================================================================

    @POST("auth/email/send-code")
    suspend fun sendEmailCode(@Body request: EmailCodeRequest): EmailCodeResponse

    @POST("auth/email/verify-code")
    suspend fun verifyEmailCode(@Body request: EmailCodeRequest): EmailCodeResponse

    /** POST /auth/email/change — 로그인한 회원의 이메일 등록·변경(Bearer 필요) */
    @POST("auth/email/change")
    suspend fun changeEmail(@Body request: EmailChangeRequest): EmailCodeResponse

    @POST("auth/reset-password-by-email")
    suspend fun resetPasswordByEmail(@Body request: EmailResetRequest): EmailCodeResponse

    /** POST /auth/reset-password-by-phone — 전화번호(SMS 인증) 기반 비밀번호 재설정 */
    @POST("auth/reset-password-by-phone")
    suspend fun resetPasswordByPhone(@Body request: PhoneResetRequest): PhoneResetResponse

    /** POST /auth/login */
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    /** POST /auth/google-login */
    @POST("auth/google-login")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): SocialLoginResponse

    /** POST /auth/kakao-login */
    @POST("auth/kakao-login")
    suspend fun kakaoLogin(@Body request: KakaoLoginRequest): SocialLoginResponse

    /** POST /auth/logout — refresh token 서버 측 revoke */
    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): LogoutResponse

    @POST("fcm-token/unregister")
    suspend fun unregisterFcmToken(@Body request: FcmUnregisterRequest): okhttp3.ResponseBody

    /** GET /app/version-check?platform=android&version=3.x.x — 강제 업데이트 여부 */
    @GET("app/version-check")
    suspend fun checkAppVersion(
        @Query("platform") platform: String = "android",
        @Query("version") version: String
    ): AppVersionCheckResponse

    // =========================================================================
    // Member / Profile endpoints (from AuthService)
    // =========================================================================

    /** GET /members/me */
    @GET("members/me")
    suspend fun getUserProfile(): ApiResponse<SMAPUser>

    /** POST /members/update-profile */
    @POST("members/update-profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): ApiResponse<Unit>

    /** POST /members/change-password */
    @POST("members/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): ChangePasswordResponse

    /** POST /members/verify-password */
    @POST("members/verify-password")
    suspend fun verifyPassword(@Body request: VerifyPasswordRequest): VerifyPasswordResponse

    /** POST /members/withdraw */
    @POST("members/withdraw")
    suspend fun withdraw(@Body request: WithdrawRequest): WithdrawResponse

    /** POST /members/upload-profile-image (multipart) */
    @Multipart
    @POST("members/upload-profile-image")
    suspend fun uploadProfileImage(
        @Part file: MultipartBody.Part
    ): ProfileImageUploadResponse

    // =========================================================================
    // Notices (from AuthService)
    // =========================================================================

    /** GET /notices/?page={page}&size={size}&show_only=true */
    @GET("notices/")
    suspend fun getNotices(
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
        @Query("show_only") showOnly: Boolean = true
    ): SmapNoticeListWithPagination

    // =========================================================================
    // Registration endpoints (from RegisterModels -- inferred from standard patterns)
    // =========================================================================

    /** POST /auth/register */
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): RegisterResponse

    /** POST /sms/send-verification-code */
    @POST("sms/send-verification-code")
    suspend fun sendSmsVerification(@Body request: SmsVerificationRequest): SmsVerificationResponse

    /** POST /sms/verify-code */
    @POST("sms/verify-code")
    suspend fun verifySmsCode(@Body request: VerifySmsCodeRequest): SmsVerificationResponse

    /** GET /members/check/phone/{phoneNumber} */
    @GET("members/check/phone/{phoneNumber}")
    suspend fun checkPhone(@Path("phoneNumber") phoneNumber: String): PhoneCheckResponse

    // =========================================================================
    // Group endpoints (from GroupService / HomeService)
    // =========================================================================

    /** GET /groups/current-user */
    @GET("groups/current-user")
    suspend fun getCurrentUserGroups(): List<SmapGroup>

    /** GET /groups/{groupId}/stats */
    @GET("groups/{groupId}/stats")
    suspend fun getGroupStats(@Path("groupId") groupId: Int): GroupStats

    /** POST /groups */
    @POST("groups")
    suspend fun createGroup(@Body body: CreateGroupRequest): SmapGroup

    /** PUT /groups/{groupId} */
    @PUT("groups/{groupId}")
    suspend fun updateGroup(
        @Path("groupId") groupId: Int,
        @Body body: UpdateGroupRequest
    ): SmapGroup

    /** PUT /groups/{groupId} (soft-delete via sgt_show=N) */
    @PUT("groups/{groupId}")
    suspend fun deleteGroup(
        @Path("groupId") groupId: Int,
        @Body body: DeleteGroupRequest
    ): SmapGroup

    /** POST /groups/join (from GroupService.joinGroupByCode) */
    @POST("groups/join")
    suspend fun joinGroupByCode(@Body body: JoinGroupByCodeRequest): SmapGroup

    /** GET /groups/code/{code} (from HomeService.joinGroup step 1) */
    @GET("groups/code/{code}")
    suspend fun getGroupByCode(@Path("code") code: String): SmapGroup

    /** POST /groups/{groupId}/join (from HomeService.joinGroup step 2) */
    @POST("groups/{groupId}/join")
    suspend fun joinGroup(
        @Path("groupId") groupId: Int,
        @Body body: JoinGroupRequest
    ): SmapGroup

    @POST("groups/{groupId}/join")
    suspend fun joinGroupFromInvite(@Path("groupId") groupId: Int, @Body body: JoinGroupRequest): okhttp3.ResponseBody

    // =========================================================================
    // Group Member endpoints (from GroupService / HomeService)
    // =========================================================================

    /** GET /group-members/member/{groupId} */
    @GET("group-members/member/{groupId}")
    suspend fun getGroupMembers(@Path("groupId") groupId: Int): List<SmapGroupMember>

    /** PUT /group-members/{groupId}/role */
    @PUT("group-members/{groupId}/role")
    suspend fun updateMemberRole(
        @Path("groupId") groupId: Int,
        @Body body: UpdateMemberRoleRequest
    ): Unit

    /** DELETE /group-members/{groupId}/member/{memberId} */
    @DELETE("group-members/{groupId}/member/{memberId}")
    suspend fun removeMember(
        @Path("groupId") groupId: Int,
        @Path("memberId") memberId: Int
    ): Unit

    // =========================================================================
    // Schedule endpoints (from ScheduleService / HomeService)
    // =========================================================================

    /** GET /schedules/group/{groupId}?days={days} */
    @GET("schedules/group/{groupId}")
    suspend fun getGroupSchedules(
        @Path("groupId") groupId: Int,
        @Query("days") days: Int = 14
    ): List<SmapSchedule>

    /** GET /schedules/{scheduleId} */
    @GET("schedules/{scheduleId}")
    suspend fun getScheduleDetail(@Path("scheduleId") scheduleId: String): SmapSchedule

    /** POST /schedules */
    @POST("schedules")
    suspend fun createSchedule(@Body body: CreateScheduleRequest): CreatedScheduleResponse

    /** PUT /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id={currentUserId} */
    @PUT("schedule/group/{groupId}/schedules/{scheduleId}")
    suspend fun updateSchedule(
        @Path("groupId") groupId: Int,
        @Path("scheduleId") scheduleId: String,
        @Query("current_user_id") currentUserId: String,
        @Body body: UpdateScheduleRequest
    ): ScheduleMutationResponse

    /** DELETE /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id={currentUserId} */
    @HTTP(method = "DELETE", path = "schedule/group/{groupId}/schedules/{scheduleId}", hasBody = true)
    suspend fun deleteSchedule(
        @Path("groupId") groupId: Int,
        @Path("scheduleId") scheduleId: String,
        @Query("current_user_id") currentUserId: String,
        @Body body: DeleteScheduleRequest
    ): Unit

    // =========================================================================
    // MyPlace / Location endpoints (from MyPlaceService)
    // =========================================================================

    /** GET /locations/member/{memberId} */
    @GET("locations/member/{memberId}")
    suspend fun getLocations(@Path("memberId") memberId: Int): List<SavedLocation>

    /** POST /locations */
    @POST("locations")
    suspend fun createLocation(@Body body: CreateLocationRequest): SavedLocation

    /** PUT /locations/{locationId} */
    @PUT("locations/{locationId}")
    suspend fun updateLocation(
        @Path("locationId") locationId: Int,
        @Body body: UpdateLocationRequest
    ): SavedLocation

    /** DELETE /locations/{locationId} */
    @DELETE("locations/{locationId}")
    suspend fun deleteLocation(@Path("locationId") locationId: Int): Unit

    // =========================================================================
    // Notification / Push Log endpoints (from NotificationService)
    // =========================================================================

    /** GET /push-logs/member/{memberId} */
    @GET("push-logs/member/{memberId}")
    suspend fun getMemberPushLogs(@Path("memberId") memberId: Int): List<PushLog>

    /** POST /push-logs/read-all?mt_idx={memberId} */
    @POST("push-logs/read-all")
    suspend fun markAllPushLogsAsRead(@Query("mt_idx") memberId: Int): Unit

    /** POST /push-logs/delete-all?mt_idx={memberId} */
    @POST("push-logs/delete-all")
    suspend fun deleteAllPushLogs(@Query("mt_idx") memberId: Int): Unit

    // =========================================================================
    // Activity Log endpoints (from ActivityLogService)
    // =========================================================================

    /** POST /logs/member-location-logs  (create a new location log entry) */
    @POST("logs/member-location-logs")
    suspend fun createLocationLog(@Body request: CreateLocationLogRequest): retrofit2.Response<Unit>

    /** GET /logs/member-location-logs/{memberId}/map-markers?date={date} */
    @GET("logs/member-location-logs/{memberId}/map-markers")
    suspend fun getLocationLogs(
        @Path("memberId") memberId: Int,
        @Query("date") date: String,
        @Query("min_speed") minSpeed: Double = 1.0,
        @Query("max_accuracy") maxAccuracy: Double = 50.0
    ): retrofit2.Response<okhttp3.ResponseBody>

    /** GET /logs/member-location-logs/{memberId}/summary?date={date} */
    @GET("logs/member-location-logs/{memberId}/summary")
    suspend fun getLocationSummary(
        @Path("memberId") memberId: Int,
        @Query("date") date: String
    ): LocationSummaryResponse

    /** GET /logs/member-location-logs/{memberId}/stay-times?date={date}&min_speed=...&max_accuracy=...&min_duration=... */
    @GET("logs/member-location-logs/{memberId}/stay-times")
    suspend fun getStayTimes(
        @Path("memberId") memberId: Int,
        @Query("date") date: String,
        @Query("min_speed") minSpeed: Double = 1.0,
        @Query("max_accuracy") maxAccuracy: Double = 50.0,
        @Query("min_duration") minDuration: Int = 5
    ): StayTimeListResponse

    /** GET /logs/daily-counts?group_id={groupId}&days={days} */
    @GET("logs/daily-counts")
    suspend fun getDailyCountsForGroup(
        @Query("group_id") groupId: Int,
        @Query("days") days: Int = 14
    ): GroupDailyCountsResponse

    // =========================================================================
    // Chat endpoints
    // =========================================================================

    /** GET /chats/rooms/ */
    @GET("chats/rooms/")
    suspend fun getChatRooms(): ChatRoomListResponse

    /** POST /chats/rooms/dm */
    @POST("chats/rooms/dm")
    suspend fun createDMRoom(@Body body: CreateDMRequest): CreateDMResponse

    /** GET /chats/rooms/{scrIdx}/messages */
    @GET("chats/rooms/{scrIdx}/messages")
    suspend fun getChatMessages(
        @Path("scrIdx") scrIdx: Int,
        @Query("before") before: Int? = null,
        @Query("limit") limit: Int = 50
    ): List<ChatMessage>

    // =========================================================================
    // Subscription endpoints (계약 문서 3절)
    // =========================================================================

    /** GET /subscriptions/me — 현재 로그인한 회원의 구독 상태 */
    @GET("subscriptions/me")
    suspend fun getSubscriptionMe(): SubscriptionStatusResponse

    /** POST /subscriptions/verify — 스토어 구매·복원 토큰 검증 및 반영 */
    @POST("subscriptions/verify")
    suspend fun verifySubscription(@Body request: SubscriptionVerifyRequest): SubscriptionStatusResponse
}
