package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 푸시 알림 로그 모델 (backend PushLogResponse 기반)
 */
@Serializable
data class PushLog(
    @SerialName("plt_idx") val pltIdx: Int = 0,
    @SerialName("plt_type") val pltType: Int? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("sst_idx") val sstIdx: Int? = null,
    @SerialName("plt_condition") val pltCondition: String? = null,
    @SerialName("plt_memo") val pltMemo: String? = null,
    @SerialName("plt_title") val pltTitle: String? = null,
    @SerialName("plt_content") val pltContent: String? = null,
    @SerialName("plt_sdate") val pltSdate: String? = null, // ISO8601
    @SerialName("plt_status") val pltStatus: Int? = null,
    @SerialName("plt_read_chk") val pltReadChk: String? = null, // 'Y' or 'N'
    @SerialName("plt_show") val pltShow: String? = null, // 'Y' or 'N'
    @SerialName("push_json") val pushJson: String? = null,
    @SerialName("plt_wdate") val pltWdate: String? = null,
    @SerialName("plt_rdate") val pltRdate: String? = null
) {
    val id: Int get() = pltIdx
    val isRead: Boolean get() = pltReadChk == "Y"
}

/**
 * 알림 통계 요약
 */
@Serializable
data class NotificationSummary(
    val total: Int = 0,
    val unread: Int = 0,
    val read: Int = 0
)

/**
 * 푸시 로그 API 응답 래퍼 (List 형태)
 */
@Serializable
data class PushLogListResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<PushLog>? = null,
    @SerialName("message") val message: String? = null
)
