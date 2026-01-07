package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName

/**
 * 프로필 업데이트 요청 모델
 */
data class UpdateProfileRequest(
    @SerializedName("mt_name") val mtName: String,
    @SerializedName("mt_nickname") val mtNickname: String,
    @SerializedName("mt_birth") val mtBirth: String? = null,
    @SerializedName("mt_gender") val mtGender: Int? = null
)

/**
 * 프로필 업데이트 응답 모델
 */
data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T? = null
)

/**
 * 비밀번호 변경 요청 모델
 */
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

/**
 * 비밀번호 변경 응답 모델
 */
data class ChangePasswordResponse(
    val success: Boolean,
    val message: String?
)

/**
 * 프로필 이미지 업로드 응답 모델
 */
data class ProfileImageUploadResponse(
    val success: Boolean,
    val message: String?,
    @SerializedName("new_image_url") val newImageUrl: String?
)

/**
 * 회원 탈퇴 요청 모델
 */
data class WithdrawRequest(
    @SerializedName("mt_retire_chk") val mtRetireChk: Int,
    @SerializedName("mt_retire_etc") val mtRetireEtc: String? = null,
    val reasons: List<String> = emptyList()
)

/**
 * 회원 탈퇴 응답 모델
 */
data class WithdrawResponse(
    val success: Boolean,
    val message: String?
)

/**
 * 공지사항 모델
 */
data class SmapNotice(
    @SerializedName("nt_idx") val ntIdx: Int,
    @SerializedName("nt_title") val ntTitle: String,
    @SerializedName("nt_content") val ntContent: String,
    @SerializedName("nt_hit") val ntHit: Int,
    @SerializedName("nt_wdate") val ntWdate: String
)

/**
 * 공지사항 목록 응답 모델
 */
data class SmapNoticeListWithPagination(
    val notices: List<SmapNotice>,
    val total: Int,
    val page: Int,
    val size: Int,
    @SerializedName("total_pages") val totalPages: Int
)

/**
 * 텔레그램 메시지 요청 모델
 */
data class TelegramMessageRequest(
    @SerializedName("chat_id") val chatId: String,
    val text: String,
    @SerializedName("parse_mode") val parseMode: String = "HTML"
)

/**
 * 비밀번호 확인 요청 모델
 */
data class VerifyPasswordRequest(
    val currentPassword: String
)

/**
 * 비밀번호 확인 응답 모델
 */
data class VerifyPasswordResponse(
    val success: Boolean,
    val message: String?
)
