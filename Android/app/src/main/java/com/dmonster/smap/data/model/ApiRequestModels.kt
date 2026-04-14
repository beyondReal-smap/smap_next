package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// =========================================================================
// Group request models
// =========================================================================

@Serializable
data class CreateGroupRequest(
    @SerialName("sgt_title") val sgtTitle: String,
    @SerialName("sgt_memo") val sgtMemo: String = "",
    @SerialName("sgt_show") val sgtShow: String = "Y"
)

@Serializable
data class UpdateGroupRequest(
    @SerialName("sgt_title") val sgtTitle: String,
    @SerialName("sgt_memo") val sgtMemo: String = ""
)

@Serializable
data class DeleteGroupRequest(
    @SerialName("sgt_show") val sgtShow: String = "N"
)

@Serializable
data class JoinGroupByCodeRequest(
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("sgt_code") val sgtCode: String
)

@Serializable
data class JoinGroupRequest(
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("sgt_idx") val sgtIdx: Int
)

@Serializable
data class UpdateMemberRoleRequest(
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("is_leader") val isLeader: Boolean
)

// =========================================================================
// Schedule request models
// =========================================================================

@Serializable
data class CreateScheduleRequest(
    @SerialName("sgt_idx") val sgtIdx: Int,
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("sst_title") val sstTitle: String,
    @SerialName("sst_sdate") val sstSdate: String,
    @SerialName("sst_edate") val sstEdate: String,
    @SerialName("sst_all_day") val sstAllDay: String = "N",
    @SerialName("sst_alram") val sstAlram: Int = 0,
    @SerialName("sst_memo") val sstMemo: String? = null,
    @SerialName("sst_location_title") val sstLocationTitle: String? = null,
    @SerialName("sst_location_lat") val sstLocationLat: Double? = null,
    @SerialName("sst_location_long") val sstLocationLong: Double? = null,
    @SerialName("sst_repeat_json_v") val sstRepeatJsonV: String? = null
)

@Serializable
data class UpdateScheduleRequest(
    @SerialName("sst_idx") val sstIdx: String,
    @SerialName("groupId") val groupId: Int,
    @SerialName("sst_pidx") val sstPidx: Int = 0,
    @SerialName("sst_title") val sstTitle: String,
    @SerialName("sst_sdate") val sstSdate: String,
    @SerialName("sst_edate") val sstEdate: String,
    @SerialName("sst_all_day") val sstAllDay: String = "N",
    @SerialName("editOption") val editOption: String = "this",
    @SerialName("editorId") val editorId: String,
    @SerialName("editorName") val editorName: String = "",
    @SerialName("sst_alram") val sstAlram: Int = 0,
    @SerialName("sst_memo") val sstMemo: String? = null,
    @SerialName("sst_location_title") val sstLocationTitle: String? = null,
    @SerialName("sst_location_lat") val sstLocationLat: Double? = null,
    @SerialName("sst_location_long") val sstLocationLong: Double? = null,
    @SerialName("sst_repeat_json") val sstRepeatJson: String? = null,
    @SerialName("sst_repeat_json_v") val sstRepeatJsonV: String? = null
)

@Serializable
data class DeleteScheduleRequest(
    @SerialName("sst_idx") val sstIdx: String,
    @SerialName("groupId") val groupId: Int,
    @SerialName("deleteOption") val deleteOption: String = "this"
)

// =========================================================================
// Location request models
// =========================================================================

@Serializable
data class CreateLocationRequest(
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("sgt_idx") val sgtIdx: Int,
    @SerialName("slt_title") val sltTitle: String,
    @SerialName("slt_add") val sltAdd: String,
    @SerialName("slt_lat") val sltLat: Double,
    @SerialName("slt_long") val sltLong: Double,
    @SerialName("slt_memo") val sltMemo: String? = null,
    @SerialName("slt_enter_alarm") val sltEnterAlarm: String? = "Y"
)

@Serializable
data class UpdateLocationRequest(
    @SerialName("slt_title") val sltTitle: String,
    @SerialName("slt_add") val sltAdd: String,
    @SerialName("slt_lat") val sltLat: Double,
    @SerialName("slt_long") val sltLong: Double,
    @SerialName("slt_memo") val sltMemo: String? = null,
    @SerialName("slt_enter_alarm") val sltEnterAlarm: String? = null
)
