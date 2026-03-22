package com.dmonster.smap.data.service

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*
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
 */
class AuthService(
    private val api: SmapApi,
    private val prefs: SharedPreferences
) {

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
        Log.d(TAG, "Token saved: ${token.take(10)}...")
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

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

    fun logout() {
        prefs.edit().clear().apply()
        Log.d(TAG, "Logged out - all data cleared")
    }

    // =========================================================================
    // Network calls (delegated to SmapApi)
    // =========================================================================

    /**
     * POST /auth/login
     */
    suspend fun login(phoneNumber: String, password: String): LoginResponse {
        val cleanPhone = phoneNumber.replace("-", "")

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
                loginResponse.data?.user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            LoginResponse(success = false, message = "Network error: ${e.message}", data = null)
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

            if (loginResponse.success == true) {
                Log.d(TAG, "[Social Login] Google success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                token?.let { saveToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Google login failed", e)
            SocialLoginResponse(
                success = false,
                message = "Network error: ${e.message}",
                error = e.message
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
            kakaoId = kakaoId,
            email = email,
            nickname = nickname,
            accessToken = accessToken,
            profileImage = profileImage
        )

        return try {
            val loginResponse = api.kakaoLogin(request)

            if (loginResponse.success == true) {
                Log.d(TAG, "[Social Login] Kakao success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                token?.let { saveToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Kakao login failed", e)
            SocialLoginResponse(
                success = false,
                message = "Network error: ${e.message}",
                error = e.message
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
            ApiResponse(false, "Network error: ${e.message}")
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
            ChangePasswordResponse(false, "Network error: ${e.message}")
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
            VerifyPasswordResponse(false, "Network error: ${e.message}")
        }
    }

    /**
     * POST /members/withdraw
     */
    suspend fun withdraw(reasonIdx: Int, etcReason: String?, reasons: List<String>): WithdrawResponse {
        return try {
            val request = WithdrawRequest(mtRetireChk = reasonIdx, mtRetireEtc = etcReason, reasons = reasons)
            val response = api.withdraw(request)
            if (response.success) {
                logout()
            }
            response
        } catch (e: Exception) {
            Log.e(TAG, "Withdraw failed", e)
            WithdrawResponse(false, "Network error: ${e.message}")
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
            ProfileImageUploadResponse(false, "Network error: ${e.message}", null)
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
    suspend fun sendTelegramInquiry(chatId: String, botToken: String, text: String): Boolean {
        return try {
            val url = "https://api.telegram.org/bot$botToken/sendMessage"
            val telegramRequest = TelegramMessageRequest(chatId = chatId, text = text)
            val jsonBody = json.encodeToString(telegramRequest)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

            val httpClient = OkHttpClient()
            val httpRequest = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .build()

            val response = httpClient.newCall(httpRequest).execute()
            Log.d(TAG, "[Telegram] Response: ${response.code}")
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Send telegram inquiry failed", e)
            false
        }
    }
}
