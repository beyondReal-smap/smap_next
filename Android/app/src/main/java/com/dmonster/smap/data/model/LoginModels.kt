package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 전화번호/비밀번호 로그인 요청 모델
 */
@Serializable
data class LoginRequest(
    @SerialName("mt_id") val mtId: String,      // 전화번호
    @SerialName("mt_pwd") val mtPwd: String,    // 비밀번호
    @SerialName("fcm_token") val fcmToken: String? = null,
    @SerialName("device_id") val deviceId: String? = null,
    @SerialName("device_model") val deviceModel: String? = null,
    @SerialName("os_type") val osType: String? = null,
    @SerialName("os_version") val osVersion: String? = null,
    @SerialName("app_version") val appVersion: String? = null
)

/**
 * 로그인 응답 모델
 */
@Serializable
data class LoginResponse(
    val success: Boolean = false,
    val message: String = "",
    val data: LoginData? = null
)

/**
 * 로그인 데이터 (토큰 및 사용자 정보)
 */
@Serializable
data class LoginData(
    val token: String? = null,
    val user: SMAPUser? = null
)

/**
 * 사용자 정보 모델
 */
@Serializable
data class SMAPUser(
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("mt_id") val mtId: String? = null,
    @SerialName("mt_name") val mtName: String? = null,
    @SerialName("mt_nickname") val mtNickname: String? = null,
    @SerialName("mt_email") val mtEmail: String? = null,
    @SerialName("mt_hp") val mtHp: String? = null,
    @SerialName("mt_level") val mtLevel: Int? = null,
    @SerialName("mt_status") val mtStatus: Int? = null,
    @SerialName("mt_type") val mtType: Int? = null,          // 1: 일반, 2: Kakao, 3: Apple, 4: Google
    @SerialName("mt_file1") val mtFile1: String? = null,     // 프로필 이미지
    @SerialName("mt_google_id") val mtGoogleId: String? = null,
    @SerialName("mt_apple_id") val mtAppleId: String? = null,
    @SerialName("mt_birth") val mtBirth: String? = null,
    @SerialName("mt_gender") val mtGender: Int? = null,
    @SerialName("mt_wdate") val mtWdate: String? = null,
    @SerialName("mt_ldate") val mtLdate: String? = null
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
@Serializable
data class GoogleLoginRequest(
    @SerialName("google_id") val googleId: String? = null,
    val email: String? = null,
    val name: String? = null,
    @SerialName("given_name") val givenName: String? = null,
    @SerialName("family_name") val familyName: String? = null,
    val image: String? = null,
    @SerialName("id_token") val idToken: String? = null,
    @SerialName("lookup_strategy") val lookupStrategy: String = "email_first",
    @SerialName("search_by_email") val searchByEmail: Boolean = true,
    @SerialName("verify_email_match") val verifyEmailMatch: Boolean = true,
    @SerialName("email_first_lookup") val emailFirstLookup: Boolean = true,
    @SerialName("lookup_priority") val lookupPriority: String = "email"
)

/**
 * Kakao 로그인 요청 모델
 */
@Serializable
data class KakaoLoginRequest(
    @SerialName("kakao_id") val kakaoId: String? = null,
    val email: String? = null,
    val nickname: String? = null,
    @SerialName("profile_image") val profileImage: String? = null,
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("lookup_strategy") val lookupStrategy: String = "email_first",
    @SerialName("device_id") val deviceId: String? = null,
    @SerialName("device_model") val deviceModel: String? = null,
    @SerialName("os_type") val osType: String? = null,
    @SerialName("os_version") val osVersion: String? = null,
    @SerialName("app_version") val appVersion: String? = null
)

/**
 * 소셜 로그인 응답 모델
 */
@Serializable
data class SocialLoginResponse(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    @SerialName("is_new_user") val isNewUser: Boolean? = null,
    val user: SMAPUser? = null,
    val token: String? = null,
    val data: SocialLoginData? = null
)

@Serializable
data class SocialLoginData(
    @SerialName("is_new_user") val isNewUser: Boolean? = null,
    val user: SMAPUser? = null,
    val token: String? = null
)

/**
 * API 에러 응답 모델
 */
@Serializable
data class APIError(
    val detail: String? = null,
    val message: String? = null
) {
    val errorDescription: String
        get() = message ?: detail ?: "알 수 없는 오류가 발생했습니다."
}
