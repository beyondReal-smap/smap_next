package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 프로필 업데이트 요청 모델
 */
@Serializable
data class UpdateProfileRequest(
    @SerialName("mt_name") val mtName: String,
    @SerialName("mt_nickname") val mtNickname: String,
    @SerialName("mt_birth") val mtBirth: String? = null,
    @SerialName("mt_gender") val mtGender: Int? = null
)

/**
 * 프로필 업데이트 응답 모델
 */
@Serializable
data class ApiResponse<T>(
    val success: Boolean = false,
    val message: String? = null,
    val data: T? = null
)

/**
 * 비밀번호 변경 요청 모델
 */
@Serializable
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

/**
 * 비밀번호 변경 응답 모델
 */
@Serializable
data class ChangePasswordResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * 프로필 이미지 업로드 응답 모델
 */
@Serializable
data class ProfileImageUploadResponse(
    val success: Boolean = false,
    val message: String? = null,
    @SerialName("new_image_url") val newImageUrl: String? = null
)

/**
 * 회원 탈퇴 요청 모델
 */
@Serializable
data class WithdrawRequest(
    @SerialName("mt_retire_chk") val mtRetireChk: Int,
    @SerialName("mt_retire_etc") val mtRetireEtc: String? = null,
    val reasons: List<String> = emptyList()
)

/**
 * 회원 탈퇴 응답 모델
 */
@Serializable
data class WithdrawResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * 공지사항 모델
 */
@Serializable
data class SmapNotice(
    @SerialName("nt_idx") val ntIdx: Int = 0,
    @SerialName("nt_title") val ntTitle: String = "",
    @SerialName("nt_content") val ntContent: String = "",
    @SerialName("nt_hit") val ntHit: Int = 0,
    @SerialName("nt_wdate") val ntWdate: String = ""
)

/**
 * 공지사항 목록 응답 모델
 */
@Serializable
data class SmapNoticeListWithPagination(
    val notices: List<SmapNotice> = emptyList(),
    val total: Int = 0,
    val page: Int = 0,
    val size: Int = 0,
    @SerialName("total_pages") val totalPages: Int = 0
)

/**
 * 텔레그램 메시지 요청 모델
 */
@Serializable
data class TelegramMessageRequest(
    @SerialName("chat_id") val chatId: String,
    val text: String,
    @SerialName("parse_mode") val parseMode: String = "HTML"
)

/**
 * 비밀번호 확인 요청 모델
 */
@Serializable
data class VerifyPasswordRequest(
    val currentPassword: String
)

/**
 * 비밀번호 확인 응답 모델
 */
@Serializable
data class VerifyPasswordResponse(
    val success: Boolean = false,
    val message: String? = null
)
