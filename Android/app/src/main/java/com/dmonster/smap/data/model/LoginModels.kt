package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName

/**
 * 전화번호/비밀번호 로그인 요청 모델
 */
data class LoginRequest(
    @SerializedName("mt_id") val mtId: String,      // 전화번호
    @SerializedName("mt_pwd") val mtPwd: String,    // 비밀번호
    @SerializedName("fcm_token") val fcmToken: String? = null,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("device_model") val deviceModel: String? = null,
    @SerializedName("os_type") val osType: String? = null,
    @SerializedName("os_version") val osVersion: String? = null,
    @SerializedName("app_version") val appVersion: String? = null
)

/**
 * 로그인 응답 모델
 */
data class LoginResponse(
    val success: Boolean,
    val message: String,
    val data: LoginData?
)

/**
 * 로그인 데이터 (토큰 및 사용자 정보)
 */
data class LoginData(
    val token: String?,
    val user: SMAPUser?
)

/**
 * 사용자 정보 모델
 */
data class SMAPUser(
    @SerializedName("mt_idx") val mtIdx: Int?,
    @SerializedName("mt_id") val mtId: String?,
    @SerializedName("mt_name") val mtName: String?,
    @SerializedName("mt_nickname") val mtNickname: String?,
    @SerializedName("mt_email") val mtEmail: String?,
    @SerializedName("mt_hp") val mtHp: String?,
    @SerializedName("mt_level") val mtLevel: Int?,
    @SerializedName("mt_status") val mtStatus: Int?,
    @SerializedName("mt_type") val mtType: Int?,          // 1: 일반, 2: Kakao, 3: Apple, 4: Google
    @SerializedName("mt_file1") val mtFile1: String?,     // 프로필 이미지
    @SerializedName("mt_google_id") val mtGoogleId: String?,
    @SerializedName("mt_apple_id") val mtAppleId: String?,
    @SerializedName("mt_birth") val mtBirth: String?,
    @SerializedName("mt_gender") val mtGender: Int?,
    @SerializedName("mt_wdate") val mtWdate: String?,
    @SerializedName("mt_ldate") val mtLdate: String?
) {
    /**
     * 표시용 이름 (닉네임 > 이름 > 이메일 순)
     */
    val displayName: String
        get() = mtNickname?.takeIf { it.isNotEmpty() }
            ?: mtName?.takeIf { it.isNotEmpty() }
            ?: mtEmail
            ?: "사용자"
    
    /**
     * 전화번호 (mt_id 또는 mt_hp)
     */
    val phoneNumber: String?
        get() = mtId ?: mtHp
}

/**
 * Google 로그인 요청 모델
 */
data class GoogleLoginRequest(
    @SerializedName("google_id") val googleId: String?,
    val email: String?,
    val name: String?,
    @SerializedName("given_name") val givenName: String? = null,
    @SerializedName("family_name") val familyName: String? = null,
    val image: String? = null,
    @SerializedName("id_token") val idToken: String?,
    @SerializedName("lookup_strategy") val lookupStrategy: String = "email_first",
    @SerializedName("search_by_email") val searchByEmail: Boolean = true,
    @SerializedName("verify_email_match") val verifyEmailMatch: Boolean = true,
    @SerializedName("email_first_lookup") val emailFirstLookup: Boolean = true,
    @SerializedName("lookup_priority") val lookupPriority: String = "email"
)

/**
 * Kakao 로그인 요청 모델
 */
data class KakaoLoginRequest(
    @SerializedName("kakao_id") val kakaoId: String?,
    val email: String?,
    val nickname: String?,
    @SerializedName("profile_image") val profileImage: String? = null,
    @SerializedName("access_token") val accessToken: String?,
    @SerializedName("lookup_strategy") val lookupStrategy: String = "email_first",
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("device_model") val deviceModel: String? = null,
    @SerializedName("os_type") val osType: String? = null,
    @SerializedName("os_version") val osVersion: String? = null,
    @SerializedName("app_version") val appVersion: String? = null
)

/**
 * 소셜 로그인 응답 모델
 */
data class SocialLoginResponse(
    val success: Boolean,
    val message: String?,
    val error: String?,
    @SerializedName("is_new_user") val isNewUser: Boolean?,
    val user: SMAPUser?,
    val token: String?,
    val data: SocialLoginData?
)

data class SocialLoginData(
    @SerializedName("is_new_user") val isNewUser: Boolean?,
    val user: SMAPUser?,
    val token: String?
)

/**
 * API 에러 응답 모델
 */
data class APIError(
    val detail: String?,
    val message: String?
) {
    val errorDescription: String
        get() = message ?: detail ?: "알 수 없는 오류가 발생했습니다."
}
