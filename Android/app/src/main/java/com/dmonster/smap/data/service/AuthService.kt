package com.dmonster.smap.data.service

import android.content.Context
import android.util.Log
import android.content.SharedPreferences
import com.dmonster.smap.data.model.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * 인증 서비스 (iOS AuthService 기반)
 */
class AuthService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "AuthService"
        private const val PREFS_NAME = "smap_auth_prefs"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_DATA = "user_data"
        private const val KEY_MT_IDX = "mt_idx"
        
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: AuthService? = null
        
        fun getInstance(context: Context): AuthService {
            return instance ?: synchronized(this) {
                instance ?: AuthService(context.applicationContext).also { instance = it }
            }
        }
    }
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()
    
    /**
     * 로그인 상태 확인
     */
    val isLoggedIn: Boolean
        get() {
            val token = getToken()
            val userData = getUserData()
            val loggedIn = !token.isNullOrBlank() && userData != null
            android.util.Log.d(TAG, "🔍 isLoggedIn Check: $loggedIn (token=${if (token != null) (if (token.isBlank()) "blank" else "exists") else "null"}, userData=${if (userData != null) "exists" else "null"})")
            return loggedIn
        }
    
    
    /**
     * 전화번호/비밀번호 로그인
     */
    suspend fun login(phoneNumber: String, password: String): LoginResponse = withContext(Dispatchers.IO) {
        val cleanPhone = phoneNumber.replace("-", "")
        val request = LoginRequest(mtId = cleanPhone, mtPwd = password)
        
        val jsonBody = gson.toJson(request)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/auth/login")
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SmapAndroid/1.0")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP Request] POST $BASE_URL/auth/login")
            
            val response = httpClient.newCall(httpRequest).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode")
            
            if (responseBody.isEmpty()) {
                throw IOException("Empty response body from server")
            }
            
            val loginResponse = gson.fromJson(responseBody, LoginResponse::class.java)
            
            if (loginResponse.success) {
                Log.d(TAG, "✅ [Login] Success - Saving Token")
                loginResponse.data?.token?.let { saveToken(it) }
                loginResponse.data?.user?.let { saveUserData(it) }
            }
            
            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            LoginResponse(success = false, message = "네트워크 오류: ${e.message}", data = null)
        }
    }
    
    /**
     * Google 로그인
     */
    suspend fun googleLogin(
        idToken: String,
        email: String?,
        name: String?,
        googleId: String?
    ): SocialLoginResponse = withContext(Dispatchers.IO) {
        val request = GoogleLoginRequest(
            googleId = googleId,
            email = email,
            name = name,
            idToken = idToken
        )
        
        val jsonBody = gson.toJson(request)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/auth/google-login")
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP Request] POST $BASE_URL/auth/google-login")
            val response = httpClient.newCall(httpRequest).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode")
            
            if (responseBody.isEmpty()) {
                throw IOException("Empty response body from server")
            }
            
            val loginResponse = gson.fromJson(responseBody, SocialLoginResponse::class.java)
            
            if (loginResponse.success == true) {
                Log.d(TAG, "✅ [Social Login] Success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                
                token?.let { saveToken(it) }
                user?.let { saveUserData(it) }
            }
            
            loginResponse
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Google login failed", e)
            SocialLoginResponse(
                success = false,
                message = "네트워크 오류: ${e.message}",
                error = e.message,
                isNewUser = null,
                user = null,
                token = null,
                data = null
            )
        }
    }
    
    /**
     * Kakao 로그인
     */
    suspend fun kakaoLogin(
        accessToken: String,
        email: String?,
        nickname: String?,
        kakaoId: String?,
        profileImage: String? = null
    ): SocialLoginResponse = withContext(Dispatchers.IO) {
        val request = KakaoLoginRequest(
            kakaoId = kakaoId,
            email = email,
            nickname = nickname,
            accessToken = accessToken,
            profileImage = profileImage
        )
        
        val jsonBody = gson.toJson(request)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/auth/kakao-login")
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP Request] POST $BASE_URL/auth/kakao-login")
            val response = httpClient.newCall(httpRequest).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode")
            
            if (responseBody.isEmpty()) {
                throw IOException("Empty response body from server")
            }
            
            val loginResponse = gson.fromJson(responseBody, SocialLoginResponse::class.java)
            
            if (loginResponse.success == true) {
                // Raw Response Body 로깅 추가 (디버깅용)
                Log.d(TAG, "✅ [Social Login] Success (Kakao)")
                Log.d(TAG, "📦 Response JSON: $responseBody")
                
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
                message = "네트워크 오류: ${e.message}",
                error = e.message,
                isNewUser = null,
                user = null,
                token = null,
                data = null
            )
        }
    }
    
    // Token 관리
    fun saveToken(token: String) {
        val success = prefs.edit().putString(KEY_TOKEN, token).commit()
        Log.d(TAG, "🔑 Token saved: ${token.take(10)}... (Success: $success)")
    }
    
    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    
    // 사용자 데이터 관리
    fun saveUserData(user: SMAPUser) {
        val json = gson.toJson(user)
        val success1 = prefs.edit().putString(KEY_USER_DATA, json).commit()
        val success2 = prefs.edit().putInt(KEY_MT_IDX, user.mtIdx ?: 0).commit()
        Log.d(TAG, "👤 User data saved: ${user.mtNickname} (Success: ${success1 && success2})")
    }
    
    fun getUserData(): SMAPUser? {
        val userJson = prefs.getString(KEY_USER_DATA, null) ?: return null
        return try {
            gson.fromJson(userJson, SMAPUser::class.java)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to parse user data", e)
            null
        }
    }
    
    fun getMtIdx(): Int = prefs.getInt(KEY_MT_IDX, 0)
    
    /**
     * 로그아웃
     */
    fun logout() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_DATA)
            .remove(KEY_MT_IDX)
            .apply()
        android.util.Log.d(TAG, "Logged out")
    }

    /**
     * 사용자 프로필 정보 조회
     */
    suspend fun fetchUserProfile(): SMAPUser? = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext null
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/me")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                // Wrapper class to match server response structure
                data class ProfileResponse(val success: Boolean, val data: SMAPUser?)
                val profileResponse = gson.fromJson(responseBody, ProfileResponse::class.java)
                
                if (profileResponse.success && profileResponse.data != null) {
                    saveUserData(profileResponse.data)
                    return@withContext profileResponse.data
                }
            }
            null
        } catch (e: Exception) {
            Log.e(TAG, "Fetch profile failed", e)
            null
        }
    }

    /**
     * 프로필 정보 업데이트
     */
    suspend fun updateProfile(name: String, nickname: String, birth: String?, gender: Int?): ApiResponse<Unit> = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext ApiResponse(false, "Authentication required")
        
        val updateRequest = UpdateProfileRequest(mtName = name, mtNickname = nickname, mtBirth = birth, mtGender = gender)
        val jsonBody = gson.toJson(updateRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/update-profile")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                val apiResponse = gson.fromJson(responseBody, ApiResponse::class.java)
                if (apiResponse.success) {
                    fetchUserProfile() // Refresh local data
                }
                return@withContext ApiResponse(apiResponse.success, apiResponse.message)
            }
            ApiResponse(false, "Server error: ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Update profile failed", e)
            ApiResponse(false, "Network error: ${e.message}")
        }
    }

    /**
     * 비밀번호 변경
     */
    suspend fun changePassword(current: String, new: String): ChangePasswordResponse = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext ChangePasswordResponse(false, "Authentication required")
        
        val passwordRequest = ChangePasswordRequest(currentPassword = current, newPassword = new)
        val jsonBody = gson.toJson(passwordRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/change-password")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                return@withContext gson.fromJson(responseBody, ChangePasswordResponse::class.java)
            }
            ChangePasswordResponse(false, "Server error: ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Change password failed", e)
            ChangePasswordResponse(false, "Network error: ${e.message}")
        }
    }

    /**
     * 비밀번호 확인 (회원탈퇴 전 본인 확인용)
     */
    suspend fun verifyPassword(password: String): VerifyPasswordResponse = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext VerifyPasswordResponse(false, "Authentication required")
        
        val verifyRequest = VerifyPasswordRequest(currentPassword = password)
        val jsonBody = gson.toJson(verifyRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/verify-password")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                return@withContext gson.fromJson(responseBody, VerifyPasswordResponse::class.java)
            }
            VerifyPasswordResponse(false, "Server error: ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Verify password failed", e)
            VerifyPasswordResponse(false, "Network error: ${e.message}")
        }
    }

    /**
     * 회원 탈퇴
     */
    suspend fun withdraw(reasonIdx: Int, etcReason: String?, reasons: List<String>): WithdrawResponse = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext WithdrawResponse(false, "Authentication required")
        
        val withdrawRequest = WithdrawRequest(mtRetireChk = reasonIdx, mtRetireEtc = etcReason, reasons = reasons)
        val jsonBody = gson.toJson(withdrawRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/withdraw")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                val withdrawResponse = gson.fromJson(responseBody, WithdrawResponse::class.java)
                if (withdrawResponse.success) {
                    logout()
                }
                return@withContext withdrawResponse
            }
            WithdrawResponse(false, "Server error: ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Withdraw failed", e)
            WithdrawResponse(false, "Network error: ${e.message}")
        }
    }

    /**
     * 프로필 이미지 업로드
     */
    suspend fun uploadProfileImage(imageData: ByteArray): ProfileImageUploadResponse = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext ProfileImageUploadResponse(false, "Authentication required", null)
        
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", "profile.jpg", imageData.toRequestBody("image/jpeg".toMediaType()))
            .build()
        
        val httpRequest = Request.Builder()
            .url("$BASE_URL/members/upload-profile-image")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                val uploadResponse = gson.fromJson(responseBody, ProfileImageUploadResponse::class.java)
                if (uploadResponse.success) {
                    fetchUserProfile() // Refresh local data
                }
                return@withContext uploadResponse
            }
            ProfileImageUploadResponse(false, "Server error: ${response.code}", null)
        } catch (e: Exception) {
            Log.e(TAG, "Upload image failed", e)
            ProfileImageUploadResponse(false, "Network error: ${e.message}", null)
        }
    }

    /**
     * 공지사항 목록 조회
     */
    suspend fun getNotices(page: Int = 1, size: Int = 20): SmapNoticeListWithPagination? = withContext(Dispatchers.IO) {
        val token = getToken()
        
        val url = "$BASE_URL/notices/?page=$page&size=$size&show_only=true"
        val requestBuilder = Request.Builder()
            .url(url)
            .get()
            .addHeader("Content-Type", "application/json")
        
        token?.let {
            requestBuilder.addHeader("Authorization", "Bearer $it")
        }
        
        try {
            val response = httpClient.newCall(requestBuilder.build()).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                return@withContext gson.fromJson(responseBody, SmapNoticeListWithPagination::class.java)
            }
            null
        } catch (e: Exception) {
            Log.e(TAG, "Fetch notices failed", e)
            null
        }
    }

    /**
     * 1:1 문의 전송 (Telegram Bot API 이용)
     */
    suspend fun sendTelegramInquiry(chatId: String, botToken: String, text: String): Boolean = withContext(Dispatchers.IO) {
        val url = "https://api.telegram.org/bot$botToken/sendMessage"
        
        val telegramRequest = TelegramMessageRequest(chatId = chatId, text = text)
        val jsonBody = gson.toJson(telegramRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
        
        val httpRequest = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(httpRequest).execute()
            Log.d(TAG, "📡 [Telegram] Response: ${response.code}")
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Send telegram inquiry failed", e)
            false
        }
    }
}
