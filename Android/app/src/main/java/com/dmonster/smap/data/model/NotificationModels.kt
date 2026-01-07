package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable
import java.util.Date

/**
 * 푸시 알림 로그 모델 (backend PushLogResponse 기반)
 */
data class PushLog(
    @SerializedName("plt_idx") val pltIdx: Int,
    @SerializedName("plt_type") val pltType: Int?,
    @SerializedName("mt_idx") val mtIdx: Int?,
    @SerializedName("sst_idx") val sstIdx: Int?,
    @SerializedName("plt_condition") val pltCondition: String?,
    @SerializedName("plt_memo") val pltMemo: String?,
    @SerializedName("plt_title") val pltTitle: String?,
    @SerializedName("plt_content") val pltContent: String?,
    @SerializedName("plt_sdate") val pltSdate: String?, // ISO8601
    @SerializedName("plt_status") val pltStatus: Int?,
    @SerializedName("plt_read_chk") val pltReadChk: String?, // 'Y' or 'N'
    @SerializedName("plt_show") val pltShow: String?, // 'Y' or 'N'
    @SerializedName("push_json") val pushJson: String?,
    @SerializedName("plt_wdate") val pltWdate: String?,
    @SerializedName("plt_rdate") val pltRdate: String?
) : Serializable {
    val id: Int get() = pltIdx
    val isRead: Boolean get() = pltReadChk == "Y"
}

/**
 * 알림 통계 요약
 */
data class NotificationSummary(
    val total: Int = 0,
    val unread: Int = 0,
    val read: Int = 0
)

/**
 * 푸시 로그 API 응답 래퍼 (List 형태)
 */
data class PushLogListResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<PushLog>?,
    @SerializedName("message") val message: String?
)
