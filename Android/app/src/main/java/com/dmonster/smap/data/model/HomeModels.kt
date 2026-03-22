package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Smap 그룹 정보
 */
@Serializable
data class SmapGroup(
    @SerialName("sgt_idx") val sgtIdx: Int = 0,
    @SerialName("sgt_title") val sgtTitle: String? = null,
    @SerialName("sgt_code") val sgtCode: String? = null,
    @SerialName("sgt_memo") val sgtMemo: String? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("member_count") val memberCount: Int? = null,
    @SerialName("sgt_show") val sgtShow: String? = null,
    @SerialName("sgt_wdate") val sgtWdate: String? = null,
    @SerialName("sgt_udate") val sgtUdate: String? = null
) {
    val id: Int get() = sgtIdx
}

/**
 * Smap 그룹 멤버 정보 (위치 정보 포함)
 */
@Serializable
data class SmapGroupMember(
    @SerialName("mt_idx") val mtIdx: Int = 0,
    @SerialName("mt_id") val mtId: String? = null,
    @SerialName("mt_name") val mtName: String? = null,
    @SerialName("mt_nickname") val mtNickname: String? = null,
    @SerialName("mt_email") val mtEmail: String? = null,
    @SerialName("mt_file1") val mtFile1: String? = null,

    // 그룹 관리 필드
    @SerialName("sgdt_idx") val sgdtIdx: Int? = null,
    @SerialName("sgdt_owner_chk") val sgdtOwnerChk: String? = null,
    @SerialName("sgdt_leader_chk") val sgdtLeaderChk: String? = null,
    @SerialName("sgdt_wdate") val sgdtWdate: String? = null,

    // 위치 정보 (mlt_...)
    @SerialName("mlt_lat") var mltLat: Double? = null,
    @SerialName("mlt_long") var mltLong: Double? = null,
    @SerialName("mlt_speed") var mltSpeed: Double? = null,
    @SerialName("mlt_battery") var mltBattery: Int? = null,
    @SerialName("mlt_gps_time") var mltGpsTime: String? = null,

    // UI State (Not serialized)
    @Transient var isSelected: Boolean = false
) {
    val id: Int get() = mtIdx

    val displayName: String
        get() = if (!mtNickname.isNullOrBlank()) mtNickname else (mtName ?: "알 수 없음")
}

/**
 * Smap 일정 정보
 */
@Serializable
data class SmapSchedule(
    @SerialName("id") val sstIdx: String, // String으로 유지 (반복 일정 처리 등 호환성 위해)
    @SerialName("sst_pidx") val sstPidx: Int? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("mt_schedule_idx") val mtScheduleIdx: Int? = null, // 일부 엔드포인트에서 이 이름으로 옴
    @SerialName("mt_id") val mtId: String? = null,
    @SerialName("title") val title: String? = null,
    @SerialName("sst_title") val sstTitle: String? = null, // API에서 title 대신 sst_title로 올 수 있음
    @SerialName("date") private val _date: String? = null, // 시작일시 (ISO8601 or yyyy-MM-dd HH:mm:ss)
    @SerialName("sst_sdate") val sstSdate: String? = null, // 시작일시 (API에서 이 필드로 올 수 있음)
    @SerialName("sst_edate") val sstEdate: String? = null, // 종료일시
    @SerialName("sst_all_day") val sstAllDay: String? = null,
    @SerialName("sst_memo") val sstMemo: String? = null,
    @SerialName("sgt_idx") val sgtIdx: Int? = null,
    @SerialName("location") private val _location: String? = null,
    @SerialName("sst_location_title") val sstLocationTitle: String? = null, // API에서 이 필드로 올 수 있음
    @SerialName("sst_show") val sstShow: String? = null, // 'Y' 또는 'N'
    @SerialName("mt_name") val mtName: String? = null,
    @SerialName("mt_file1") val mtFile1: String? = null,
    @SerialName("sst_repeat_json") val sstRepeatJson: String? = null,
    @SerialName("sst_repeat_json_v") val sstRepeatJsonV: String? = null,

    // 위치 정보 (일정에 장소가 있는 경우)
    @SerialName("sst_location_lat") val sstLocationLat: Double? = null,
    @SerialName("sst_location_long") val sstLocationLong: Double? = null,

    // 추가 정보 (Join 결과)
    @SerialName("member_name") val memberName: String? = null,
    @SerialName("member_photo") val memberPhoto: String? = null
) {
    val id: String get() = sstIdx

    // date 필드가 없으면 sst_sdate 사용
    val date: String? get() = _date ?: sstSdate

    // location 필드가 없으면 sst_location_title 사용
    val location: String? get() = _location ?: sstLocationTitle

    // title이 없으면 sst_title 사용
    val displayTitle: String get() = title ?: sstTitle ?: "제목 없음"

    // To be populated from outside if needed, or matched via mtScheduleIdx
    @Transient var memberNameOverride: String? = null
    @Transient var memberPhotoOverride: String? = null

    val validMemberName: String get() = memberNameOverride ?: memberName ?: mtName ?: "나"
    val validMemberPhoto: String? get() = memberPhotoOverride ?: memberPhoto ?: mtFile1

    val repeatDescription: String? get() {
        if (!sstRepeatJsonV.isNullOrEmpty() && sstRepeatJsonV != "안함" && sstRepeatJsonV != "None") {
            return sstRepeatJsonV
        }
        val json = sstRepeatJson ?: return null
        if (json.isEmpty() || json == "null") return null

        return try {
            val jsonObj = org.json.JSONObject(json)
            val r1 = jsonObj.optString("r1")
            when (r1) {
                "1" -> "매일"
                "2" -> "매월"
                "3" -> "매주"
                "4" -> "매년"
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    val isRecurring: Boolean get() {
        if (!sstRepeatJson.isNullOrEmpty() && sstRepeatJson != "null" && sstRepeatJson != "None" && sstRepeatJson != "안함") {
            return true
        }
        return (sstPidx ?: 0) > 0
    }

    val status: ScheduleStatus
        get() = calculateStatus()

    private fun calculateStatus(): ScheduleStatus {
        val now = System.currentTimeMillis()

        fun parseDate(dateStr: String?): Long? {
            if (dateStr == null) return null
            return try {
                // ISO8601 형식 (T 포함) 처리
                val cleanDate = dateStr.replace("Z", "").split(".")[0] // 밀리초 제거
                val format = if (cleanDate.contains("T")) {
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.KOREA)
                } else {
                    SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.KOREA)
                }
                format.parse(cleanDate)?.time
            } catch (e: Exception) {
                null
            }
        }

        val start = parseDate(date)
        val end = parseDate(sstEdate)

        return when {
            start == null -> ScheduleStatus.UPCOMING
            now < start -> ScheduleStatus.UPCOMING
            end != null && now > end -> ScheduleStatus.COMPLETED
            else -> ScheduleStatus.ONGOING
        }
    }
}

@Serializable
enum class ScheduleStatus(val text: String) {
    COMPLETED("완료"),
    ONGOING("진행 중"),
    UPCOMING("예정"),
    DEFAULT("상태 없음")
}

// MARK: - API Response Wrappers

/**
 * 그룹 목록 API 응답
 */
@Serializable
data class GroupListResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<SmapGroup>? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 멤버 목록 API 응답
 */
@Serializable
data class MemberListResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<SmapGroupMember>? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 일정 목록 API 응답
 */
@Serializable
data class ScheduleListResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<SmapSchedule>? = null,
    @SerialName("message") val message: String? = null
)

// MARK: - Group Statistics Models

/**
 * 그룹 통계 정보
 */
@Serializable
data class GroupStats(
    @SerialName("group_id") val groupId: Int = 0,
    @SerialName("group_title") val groupTitle: String? = null,
    @SerialName("member_count") val memberCount: Int = 0,
    @SerialName("weekly_schedules") val weeklySchedules: Int = 0,
    @SerialName("total_locations") val totalLocations: Int = 0,
    @SerialName("stats_period") val statsPeriod: StatsPeriod? = null,
    @SerialName("member_stats") val memberStats: List<GroupMemberStats>? = null
)

/**
 * 통계 기간 정보
 */
@Serializable
data class StatsPeriod(
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("days") val days: Int? = null
)

/**
 * 그룹 멤버별 통계
 */
@Serializable
data class GroupMemberStats(
    @SerialName("mt_idx") val mtIdx: Int = 0,
    @SerialName("mt_name") val mtName: String? = null,
    @SerialName("mt_nickname") val mtNickname: String? = null,
    @SerialName("weekly_schedules") val weeklySchedules: Int? = null,
    @SerialName("total_locations") val totalLocations: Int? = null,
    @SerialName("weekly_locations") val weeklyLocations: Int? = null,
    @SerialName("is_owner") val isOwner: Boolean? = null,
    @SerialName("is_leader") val isLeader: Boolean? = null
)

/**
 * 그룹 통계 API 응답
 */
@Serializable
data class GroupStatsResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: GroupStats? = null,
    @SerialName("message") val message: String? = null
)
