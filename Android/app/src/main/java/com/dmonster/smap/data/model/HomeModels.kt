package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Smap 그룹 정보
 */
data class SmapGroup(
    @SerializedName("sgt_idx") val sgtIdx: Int,
    @SerializedName("sgt_title") val sgtTitle: String?,
    @SerializedName("sgt_code") val sgtCode: String?,
    @SerializedName("sgt_memo") val sgtMemo: String?,
    @SerializedName("mt_idx") val mtIdx: Int?,
    @SerializedName("member_count") val memberCount: Int?,
    @SerializedName("sgt_show") val sgtShow: String?,
    @SerializedName("sgt_wdate") val sgtWdate: String?,
    @SerializedName("sgt_udate") val sgtUdate: String?
) : Serializable {
    val id: Int get() = sgtIdx
}

/**
 * Smap 그룹 멤버 정보 (위치 정보 포함)
 */
data class SmapGroupMember(
    @SerializedName("mt_idx") val mtIdx: Int,
    @SerializedName("mt_id") val mtId: String?,
    @SerializedName("mt_name") val mtName: String?,
    @SerializedName("mt_nickname") val mtNickname: String?,
    @SerializedName("mt_email") val mtEmail: String?,
    @SerializedName("mt_file1") val mtFile1: String?,

    // 그룹 관리 필드
    @SerializedName("sgdt_idx") val sgdtIdx: Int?,
    @SerializedName("sgdt_owner_chk") val sgdtOwnerChk: String?,
    @SerializedName("sgdt_leader_chk") val sgdtLeaderChk: String?,
    @SerializedName("sgdt_wdate") val sgdtWdate: String?,

    // 위치 정보 (mlt_...)
    @SerializedName("mlt_lat") var mltLat: Double?,
    @SerializedName("mlt_long") var mltLong: Double?,
    @SerializedName("mlt_speed") var mltSpeed: Double?,
    @SerializedName("mlt_battery") var mltBattery: Int?,
    @SerializedName("mlt_gps_time") var mltGpsTime: String?,

    // UI State (Not serialized)
    var isSelected: Boolean = false
) : Serializable {
    val id: Int get() = mtIdx

    val displayName: String
        get() = if (!mtNickname.isNullOrBlank()) mtNickname else (mtName ?: "알 수 없음")
}

/**
 * Smap 일정 정보
 */
data class SmapSchedule(
    @SerializedName("id") val sstIdx: String, // String으로 유지 (반복 일정 처리 등 호환성 위해)
    @SerializedName("sst_pidx") val sstPidx: Int?,
    @SerializedName("mt_idx") val mtIdx: Int?, 
    @SerializedName("mt_schedule_idx") val mtScheduleIdx: Int?, // 일부 엔드포인트에서 이 이름으로 옴
    @SerializedName("mt_id") val mtId: String? = null,
    @SerializedName("title") val title: String?,
    @SerializedName("sst_title") val sstTitle: String? = null, // API에서 title 대신 sst_title로 올 수 있음
    @SerializedName("date") private val _date: String? = null, // 시작일시 (ISO8601 or yyyy-MM-dd HH:mm:ss)
    @SerializedName("sst_sdate") val sstSdate: String? = null, // 시작일시 (API에서 이 필드로 올 수 있음)
    @SerializedName("sst_edate") val sstEdate: String?, // 종료일시
    @SerializedName("sst_all_day") val sstAllDay: String?,
    @SerializedName("sst_memo") val sstMemo: String?,
    @SerializedName("sgt_idx") val sgtIdx: Int?,
    @SerializedName("location") private val _location: String? = null,
    @SerializedName("sst_location_title") val sstLocationTitle: String? = null, // API에서 이 필드로 올 수 있음
    @SerializedName("sst_show") val sstShow: String?, // 'Y' 또는 'N'
    @SerializedName("mt_name") val mtName: String? = null,
    @SerializedName("mt_file1") val mtFile1: String? = null,
    @SerializedName("sst_repeat_json") val sstRepeatJson: String? = null,
    @SerializedName("sst_repeat_json_v") val sstRepeatJsonV: String? = null,

    // 위치 정보 (일정에 장소가 있는 경우)
    @SerializedName("sst_location_lat") val sstLocationLat: Double?,
    @SerializedName("sst_location_long") val sstLocationLong: Double?,

    // 추가 정보 (Join 결과)
    @SerializedName("member_name") val memberName: String? = null,
    @SerializedName("member_photo") val memberPhoto: String? = null
) : Serializable {
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
data class GroupListResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<SmapGroup>?,
    @SerializedName("message") val message: String?
)

/**
 * 멤버 목록 API 응답
 */
data class MemberListResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<SmapGroupMember>?,
    @SerializedName("message") val message: String?
)

/**
 * 일정 목록 API 응답
 */
data class ScheduleListResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<SmapSchedule>?,
    @SerializedName("message") val message: String?
)

// MARK: - Group Statistics Models

/**
 * 그룹 통계 정보
 */
data class GroupStats(
    @SerializedName("group_id") val groupId: Int,
    @SerializedName("group_title") val groupTitle: String?,
    @SerializedName("member_count") val memberCount: Int,
    @SerializedName("weekly_schedules") val weeklySchedules: Int,
    @SerializedName("total_locations") val totalLocations: Int,
    @SerializedName("stats_period") val statsPeriod: StatsPeriod?,
    @SerializedName("member_stats") val memberStats: List<GroupMemberStats>?
)

/**
 * 통계 기간 정보
 */
data class StatsPeriod(
    @SerializedName("start_date") val startDate: String?,
    @SerializedName("end_date") val endDate: String?,
    @SerializedName("days") val days: Int?
)

/**
 * 그룹 멤버별 통계
 */
data class GroupMemberStats(
    @SerializedName("mt_idx") val mtIdx: Int,
    @SerializedName("mt_name") val mtName: String?,
    @SerializedName("mt_nickname") val mtNickname: String?,
    @SerializedName("weekly_schedules") val weeklySchedules: Int?,
    @SerializedName("total_locations") val totalLocations: Int?,
    @SerializedName("weekly_locations") val weeklyLocations: Int?,
    @SerializedName("is_owner") val isOwner: Boolean?,
    @SerializedName("is_leader") val isLeader: Boolean?
)

/**
 * 그룹 통계 API 응답
 */
data class GroupStatsResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: GroupStats?,
    @SerializedName("message") val message: String?
)
