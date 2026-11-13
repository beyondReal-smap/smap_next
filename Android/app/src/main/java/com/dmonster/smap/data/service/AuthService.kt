package com.dmonster.smap.data.service

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Authentication / user-profile service.
 * Network calls delegate to SmapApi; local token/user state uses SharedPreferences.
 * Refresh token만 별도의 EncryptedSharedPreferences(TokenStore)에 보관.
 */
class AuthService(
    private val api: SmapApi,
    private val prefs: SharedPreferences,
    private val tokenStore: com.dmonster.smap.data.auth.TokenStore
) {
    @Volatile var pendingSocialProvider: String? = null
    @Volatile var pendingSocialToken: String? = null

    companion object {
        private const val TAG = "AuthService"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_DATA = "user_data"
        private const val KEY_MT_IDX = "mt_idx"
    }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    // 로그아웃 시 서버 revoke 호출(fire-and-forget). 호출자의 일반 함수 컨텍스트와 호환.
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val inquiryClient = OkHttpClient()

    // =========================================================================
    // Login state
    // =========================================================================

    val isLoggedIn: Boolean
        get() {
            val token = getToken()
            val userData = getUserData()
            val loggedIn = !token.isNullOrBlank() && userData != null
            Log.d(TAG, "isLoggedIn=$loggedIn")
            return loggedIn
        }

    // =========================================================================
    // Token management
    // =========================================================================

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).commit()
        Log.d(TAG, "Token saved")
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    /** Refresh token은 EncryptedSharedPreferences에 분리 저장한다. */
    fun saveRefreshToken(token: String) {
        tokenStore.saveRefreshToken(token)
        Log.d(TAG, "Refresh token saved (${token.length} chars)")
    }

    fun getRefreshToken(): String? = tokenStore.getRefreshToken()

    // =========================================================================
    // User data management
    // =========================================================================

    fun saveUserData(user: SMAPUser) {
        val userJson = json.encodeToString(user)
        prefs.edit().putString(KEY_USER_DATA, userJson).commit()
        prefs.edit().putInt(KEY_MT_IDX, user.mtIdx ?: 0).commit()
        Log.d(TAG, "User data saved: ${user.mtNickname}")
    }

    fun getUserData(): SMAPUser? {
        val userJson = prefs.getString(KEY_USER_DATA, null) ?: return null
        return try {
            json.decodeFromString<SMAPUser>(userJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse user data", e)
            null
        }
    }

    fun getMtIdx(): Int = prefs.getInt(KEY_MT_IDX, 0)

    // =========================================================================
    // Logout
    // =========================================================================

    /**
     * 로그아웃. 로컬 prefs와 secure store를 즉시 비우고, 서버 revoke는 fire-and-forget.
     * 네트워크 실패 시에도 로컬은 항상 비워야 사용자가 다음 진입에서 로그인 화면으로 안내된다.
     */
    fun logout() {
        val refresh = tokenStore.getRefreshToken()
        prefs.edit().clear().apply()
        tokenStore.clearRefreshToken()
        com.dmonster.smap.data.GlobalEventBus.tryEmit(com.dmonster.smap.data.GlobalEvent.LoggedOut)
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

    private suspend fun unregisterPushToken() {
        val fcmToken = prefs.getString("fcm_token", null)
        if (fcmToken.isNullOrBlank()) {
            Log.w(TAG, "저장된 푸시 토큰이 없어 서버 해제를 건너뜁니다.")
            return
        }
        try {
            withTimeout(5_000) { api.unregisterFcmToken(FcmUnregisterRequest(fcmToken)).close() }
        } catch (e: Exception) {
            // 해제 실패로 사용자의 로그아웃이나 탈퇴를 막지 않습니다.
            Log.w(TAG, "푸시 토큰 해제 실패: ${e.javaClass.simpleName}")
        }
    }

    suspend fun logoutWithUnregister() {
        unregisterPushToken()
        logout()
    }

    // =========================================================================
    // Network calls (delegated to SmapApi)
    // =========================================================================

    suspend fun sendEmailCode(email: String, purpose: String) = api.sendEmailCode(EmailCodeRequest(email, purpose))
    suspend fun verifyEmailCode(email: String, purpose: String, code: String) = api.verifyEmailCode(EmailCodeRequest(email, purpose, code))
    suspend fun changeEmail(email: String, token: String) = api.changeEmail(EmailChangeRequest(email, token))

    /** 서버에서 이메일 변경이 끝난 뒤, 저장된 사용자 정보의 이메일만 갱신한다. */
    fun updateStoredEmail(email: String) {
        val user = getUserData() ?: throw IllegalStateException("저장된 사용자 정보가 없습니다.")
        // mt_idx 등 다른 값은 그대로 두고 사용자 JSON 만 갱신한다.
        prefs.edit().putString(KEY_USER_DATA, json.encodeToString(user.copy(mtEmail = email))).commit()
    }

    suspend fun sendSmsCode(phone: String) = api.sendSmsVerification(SmsVerificationRequest(phone))
    suspend fun verifySmsCode(phone: String, code: String) = api.verifySmsCode(VerifySmsCodeRequest(phone, code))
    suspend fun resetPasswordByPhone(phone: String, password: String) = api.resetPasswordByPhone(PhoneResetRequest(phone, newPassword = password))

    suspend fun resetPasswordByEmail(email: String, token: String, password: String) = api.resetPasswordByEmail(EmailResetRequest(email, token, password))

    /**
     * POST /auth/login
     */
    suspend fun login(phoneNumber: String, password: String): LoginResponse {
        val cleanPhone = phoneNumber.trim().let { if (it.contains("@")) it else it.replace("-", "") }

        val request = LoginRequest(
            mtId = cleanPhone,
            mtPwd = password,
            osType = "android"
        )

        return try {
            val loginResponse = api.login(request)

            if (loginResponse.success) {
                Log.d(TAG, "[Login] Success")
                loginResponse.data?.token?.let { saveToken(it) }
                loginResponse.data?.refreshToken?.let { saveRefreshToken(it) }
                loginResponse.data?.user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            // 400(계정 특정 불가 등)·429(시도 횟수 제한)는 서버가 준 안내 문구를 그대로 보여 준다
            LoginResponse(success = false, message = serverGuidanceMessage(e) ?: "로그인 요청에 실패했습니다. 네트워크 연결을 확인해주세요.", data = null)
        }
    }

    /**
     * POST /auth/google-login
     */
    suspend fun googleLogin(
        idToken: String,
        email: String?,
        name: String?,
        googleId: String?
    ): SocialLoginResponse {
        val request = GoogleLoginRequest(
            googleId = googleId,
            email = email,
            name = name,
            idToken = idToken
        )

        return try {
            val loginResponse = api.googleLogin(request)

            if (loginResponse.success == true && !(loginResponse.isNewUser ?: loginResponse.data?.isNewUser ?: false)) {
                Log.d(TAG, "[Social Login] Google success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                val refresh = loginResponse.data?.refreshToken
                token?.let { saveToken(it) }
                refresh?.let { saveRefreshToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Google login failed", e)
            SocialLoginResponse(
                success = false,
                message = "네트워크 연결을 확인해주세요.",
                error = e.javaClass.simpleName
            )
        }
    }

    /**
     * POST /auth/kakao-login
     */
    suspend fun kakaoLogin(
        accessToken: String,
        email: String?,
        nickname: String?,
        kakaoId: String?,
        profileImage: String? = null
    ): SocialLoginResponse {
        val request = KakaoLoginRequest(
            kakaoId = kakaoId ?: "",
            email = email,
            nickname = nickname ?: "",
            accessToken = accessToken,
            profileImage = profileImage
        )

        return try {
            val loginResponse = api.kakaoLogin(request)

            if (loginResponse.success == true && !(loginResponse.isNewUser ?: loginResponse.data?.isNewUser ?: false)) {
                Log.d(TAG, "[Social Login] Kakao success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                val refresh = loginResponse.data?.refreshToken
                token?.let { saveToken(it) }
                refresh?.let { saveRefreshToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Kakao login failed", e)
            SocialLoginResponse(
                success = false,
                message = "네트워크 연결을 확인해주세요.",
                error = e.javaClass.simpleName
            )
        }
    }

    /**
     * GET /members/me
     */
    suspend fun fetchUserProfile(): SMAPUser? {
        return try {
            val response = api.getUserProfile()
            if (response.success && response.data != null) {
                saveUserData(response.data)
                response.data
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "Fetch profile failed", e)
            null
        }
    }

    /**
     * POST /members/update-profile
     */
    suspend fun updateProfile(name: String, nickname: String, birth: String?, gender: Int?): ApiResponse<Unit> {
        return try {
            val request = UpdateProfileRequest(mtName = name, mtNickname = nickname, mtBirth = birth, mtGender = gender)
            val response = api.updateProfile(request)
            if (response.success) {
                fetchUserProfile() // Refresh local data
            }
            ApiResponse(response.success, response.message)
        } catch (e: Exception) {
            Log.e(TAG, "Update profile failed", e)
            ApiResponse(false, "프로필 수정에 실패했습니다. 네트워크 연결을 확인해주세요.")
        }
    }

    /**
     * POST /members/change-password
     */
    suspend fun changePassword(current: String, new: String): ChangePasswordResponse {
        return try {
            val request = ChangePasswordRequest(currentPassword = current, newPassword = new)
            api.changePassword(request)
        } catch (e: Exception) {
            Log.e(TAG, "Change password failed", e)
            ChangePasswordResponse(false, serverGuidanceMessage(e) ?: "비밀번호 변경에 실패했습니다. 네트워크 연결을 확인해주세요.")
        }
    }

    /**
     * POST /members/verify-password
     */
    suspend fun verifyPassword(password: String): VerifyPasswordResponse {
        return try {
            val request = VerifyPasswordRequest(currentPassword = password)
            api.verifyPassword(request)
        } catch (e: Exception) {
            Log.e(TAG, "Verify password failed", e)
            VerifyPasswordResponse(false, serverGuidanceMessage(e) ?: "네트워크 연결을 확인해주세요.")
        }
    }

    /**
     * POST /members/withdraw
     */
    suspend fun withdraw(reasonIdx: Int, etcReason: String?, reasons: List<String>): WithdrawResponse {
        return try {
            unregisterPushToken()
            val request = WithdrawRequest(mtRetireChk = reasonIdx, mtRetireEtc = etcReason, reasons = reasons)
            val response = api.withdraw(request)
            if (response.success) {
                logout()
            }
            response
        } catch (e: Exception) {
            Log.e(TAG, "Withdraw failed", e)
            WithdrawResponse(false, "탈퇴 처리에 실패했습니다. 네트워크 연결을 확인해주세요.")
        }
    }

    /**
     * POST /members/upload-profile-image (multipart)
     */
    suspend fun uploadProfileImage(imageData: ByteArray): ProfileImageUploadResponse {
        return try {
            val requestBody = imageData.toRequestBody("image/jpeg".toMediaType())
            val part = MultipartBody.Part.createFormData("file", "profile.jpg", requestBody)
            val response = api.uploadProfileImage(part)
            if (response.success) {
                fetchUserProfile() // Refresh local data
            }
            response
        } catch (e: Exception) {
            Log.e(TAG, "Upload image failed", e)
            ProfileImageUploadResponse(false, "이미지 업로드에 실패했습니다. 네트워크 연결을 확인해주세요.", null)
        }
    }

    /**
     * GET /notices/?page=...&size=...&show_only=true
     */
    suspend fun getNotices(page: Int = 1, size: Int = 20): SmapNoticeListWithPagination? {
        return try {
            api.getNotices(page, size)
        } catch (e: Exception) {
            Log.e(TAG, "Fetch notices failed", e)
            null
        }
    }

    /**
     * Send 1:1 inquiry via Telegram Bot API.
     * This uses a DIFFERENT base URL (api.telegram.org) so it stays as manual OkHttp.
     */
    suspend fun sendTelegramInquiry(chatId: String, botToken: String, text: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val url = "https://api.telegram.org/bot$botToken/sendMessage"
            val telegramRequest = TelegramMessageRequest(chatId = chatId, text = text)
            val jsonBody = json.encodeToString(telegramRequest)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

            val httpRequest = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .build()

            inquiryClient.newCall(httpRequest).execute().use { response ->
                Log.d(TAG, "[Telegram] Response: ${response.code}")
                if (response.isSuccessful) Result.success(Unit)
                else Result.failure(IllegalStateException("문의 전송에 실패했습니다 (${response.code})."))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Send telegram inquiry failed", e)
            Result.failure(e)
        }
    }
}

fun emailAuthError(error: Throwable): String {
    if (error is retrofit2.HttpException) {
        return when (error.code()) {
            400 -> try { org.json.JSONObject(error.response()?.errorBody()?.string().orEmpty()).optString("detail").ifBlank { "입력 정보를 확인해주세요." } } catch (_: Exception) { "입력 정보를 확인해주세요." }
            409 -> "이미 가입된 이메일입니다."
            429 -> "요청이 많습니다. 잠시 후 다시 시도해주세요."
            502, 503 -> "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            else -> "요청을 처리하지 못했습니다."
        }
    }
    return "네트워크 연결을 확인해주세요."
}

/**
 * 400/429 응답의 detail 문구를 사용자 안내로 쓴다. 문자열 detail 이 없으면 429 는 일반 대기 안내,
 * 그 외(401/422/5xx/네트워크)는 null 을 돌려 호출부가 기존 문구를 쓰게 한다.
 */
internal fun serverGuidanceMessage(error: Throwable): String? {
    if (error !is retrofit2.HttpException) return null
    if (error.code() != 400 && error.code() != 429) return null
    val detail = try {
        val body = error.response()?.errorBody()?.string().orEmpty()
        (Json.parseToJsonElement(body) as? kotlinx.serialization.json.JsonObject)
            ?.get("detail")
            ?.let { it as? kotlinx.serialization.json.JsonPrimitive }
            ?.takeIf { it.isString }?.content
    } catch (_: kotlinx.serialization.SerializationException) { null }
    return detail?.takeIf { it.isNotBlank() }
        ?: if (error.code() == 429) "시도 횟수가 많습니다. 잠시 후 다시 시도해주세요." else null
}
