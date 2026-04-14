package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 회원가입 단계 (iOS RegisterStep 기반)
 */
enum class RegisterStep(val title: String, val progress: Float) {
    TERMS("이용약관", 0.16f),
    PHONE("전화번호 인증", 0.33f),
    VERIFICATION("인증번호 확인", 0.5f),
    BASIC_INFO("기본 정보", 0.66f),
    PROFILE("프로필 정보", 0.83f),
    COMPLETE("가입 완료", 1.0f)
}

/**
 * 회원가입 요청 데이터 (iOS RegisterRequest 기반)
 */
@Serializable
data class RegisterRequest(
    @SerialName("mt_id") val mtId: String = "",
    @SerialName("mt_pwd") val mtPwd: String? = null,
    @SerialName("mt_name") val mtName: String = "",
    @SerialName("mt_nickname") val mtNickname: String = "",
    @SerialName("mt_email") val mtEmail: String? = null,
    @SerialName("mt_hp") val mtHp: String? = null,
    @SerialName("mt_birth") val mtBirth: String? = null,
    @SerialName("mt_gender") val mtGender: Int? = null,
    @SerialName("mt_file1") val mtFile1: String? = null,
    @SerialName("mt_type") val mtType: Int = 1,  // 1:일반, 2:카카오, 3:애플, 4:구글
    @SerialName("mt_google_id") val mtGoogleId: String? = null,
    @SerialName("mt_apple_id") val mtAppleId: String? = null,
    @SerialName("mt_kakao_id") val mtKakaoId: String? = null,
    @SerialName("mt_agree1") val mtAgree1: Boolean = false,  // 서비스 이용약관 (필수)
    @SerialName("mt_agree2") val mtAgree2: Boolean = false,  // 개인정보 수집이용 (필수)
    @SerialName("mt_agree3") val mtAgree3: Boolean = false,  // 위치정보 이용약관 (필수)
    @SerialName("mt_agree4") val mtAgree4: Boolean = false,  // 마케팅 정보 수신 (선택)
    @SerialName("mt_agree5") val mtAgree5: Boolean = false,  // 야간 알림 수신 (선택)
    @SerialName("mt_token_id") val fcmToken: String? = null
)

/**
 * SMS 인증 요청
 */
@Serializable
data class SmsVerificationRequest(
    @SerialName("phone_number") val phoneNumber: String
)

/**
 * SMS 인증 응답
 */
@Serializable
data class SmsVerificationResponse(
    @SerialName("success") val success: Boolean = false,
    @SerialName("message") val message: String? = null,
    @SerialName("error") val error: String? = null
)

/**
 * SMS 인증번호 검증 요청
 */
@Serializable
data class VerifySmsCodeRequest(
    @SerialName("phone_number") val phoneNumber: String,
    @SerialName("code") val code: String
)

/**
 * 회원가입 응답
 */
@Serializable
data class RegisterResponse(
    @SerialName("success") val success: Boolean = false,
    @SerialName("message") val message: String? = null,
    @SerialName("data") val data: RegisterResponseData? = null
)

@Serializable
data class RegisterResponseData(
    @SerialName("token") val token: String? = null,
    @SerialName("user") val user: SMAPUser? = null
)

/**
 * 전화번호 중복 확인 응답
 */
@Serializable
data class PhoneCheckResponse(
    @SerialName("exists") val exists: Boolean = false,
    @SerialName("message") val message: String? = null
)
