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
    @SerialName("mt_id") var mtId: String = "",
    @SerialName("mt_pwd") var mtPwd: String? = null,
    @SerialName("mt_name") var mtName: String = "",
    @SerialName("mt_nickname") var mtNickname: String = "",
    @SerialName("mt_email") var mtEmail: String? = null,
    @SerialName("mt_hp") var mtHp: String? = null,
    @SerialName("mt_birth") var mtBirth: String? = null,
    @SerialName("mt_gender") var mtGender: Int? = null,
    @SerialName("mt_file1") var mtFile1: String? = null,
    @SerialName("mt_type") var mtType: Int = 1,  // 1:일반, 2:카카오, 3:애플, 4:구글
    @SerialName("mt_google_id") var mtGoogleId: String? = null,
    @SerialName("mt_apple_id") var mtAppleId: String? = null,
    @SerialName("mt_kakao_id") var mtKakaoId: String? = null,
    @SerialName("mt_agree1") var mtAgree1: Boolean = false,  // 서비스 이용약관 (필수)
    @SerialName("mt_agree2") var mtAgree2: Boolean = false,  // 개인정보 수집이용 (필수)
    @SerialName("mt_agree3") var mtAgree3: Boolean = false,  // 위치정보 이용약관 (필수)
    @SerialName("mt_agree4") var mtAgree4: Boolean = false,  // 마케팅 정보 수신 (선택)
    @SerialName("mt_agree5") var mtAgree5: Boolean = false,  // 야간 알림 수신 (선택)
    @SerialName("fcm_token") var fcmToken: String? = null
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
    @SerialName("verification_code") val verificationCode: String? = null  // 개발 환경에서만...
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
