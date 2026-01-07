package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName

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
data class RegisterRequest(
    @SerializedName("mt_id") var mtId: String = "",
    @SerializedName("mt_pwd") var mtPwd: String? = null,
    @SerializedName("mt_name") var mtName: String = "",
    @SerializedName("mt_nickname") var mtNickname: String = "",
    @SerializedName("mt_email") var mtEmail: String? = null,
    @SerializedName("mt_hp") var mtHp: String? = null,
    @SerializedName("mt_birth") var mtBirth: String? = null,
    @SerializedName("mt_gender") var mtGender: Int? = null,
    @SerializedName("mt_file1") var mtFile1: String? = null,
    @SerializedName("mt_type") var mtType: Int = 1,  // 1:일반, 2:카카오, 3:애플, 4:구글
    @SerializedName("mt_google_id") var mtGoogleId: String? = null,
    @SerializedName("mt_apple_id") var mtAppleId: String? = null,
    @SerializedName("mt_kakao_id") var mtKakaoId: String? = null,
    @SerializedName("mt_agree1") var mtAgree1: Boolean = false,  // 서비스 이용약관 (필수)
    @SerializedName("mt_agree2") var mtAgree2: Boolean = false,  // 개인정보 수집이용 (필수)
    @SerializedName("mt_agree3") var mtAgree3: Boolean = false,  // 위치정보 이용약관 (필수)
    @SerializedName("mt_agree4") var mtAgree4: Boolean = false,  // 마케팅 정보 수신 (선택)
    @SerializedName("mt_agree5") var mtAgree5: Boolean = false,  // 야간 알림 수신 (선택)
    @SerializedName("fcm_token") var fcmToken: String? = null
)

/**
 * SMS 인증 요청
 */
data class SmsVerificationRequest(
    @SerializedName("phone_number") val phoneNumber: String
)

/**
 * SMS 인증 응답
 */
data class SmsVerificationResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("verification_code") val verificationCode: String?  // 개발 환경에서만... 
)

/**
 * 회원가입 응답
 */
data class RegisterResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: RegisterResponseData?
)

data class RegisterResponseData(
    @SerializedName("token") val token: String?,
    @SerializedName("user") val user: SMAPUser?
)

/**
 * 전화번호 중복 확인 응답
 */
data class PhoneCheckResponse(
    @SerializedName("exists") val exists: Boolean,
    @SerializedName("message") val message: String?
)
