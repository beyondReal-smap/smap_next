package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

/**
 * 위치 로그 데이터
 */
data class LocationLog(
    @SerializedName("mlt_idx") val mltIdx: Int?,
    @SerializedName("mt_idx") val mtIdx: Int?,
    @SerializedName("mlt_lat") val mltLat: Double?,
    @SerializedName("mlt_long") val mltLong: Double?,
    @SerializedName("mlt_speed") val mltSpeed: Double?,
    @SerializedName("mlt_gps_time") val mltGpsTime: String?,
    @SerializedName("mlt_wdate") val mltWdate: String?
) : Serializable {
    val latitude: Double get() = mltLat ?: 0.0
    val longitude: Double get() = mltLong ?: 0.0
    val speed: Double get() = mltSpeed ?: 0.0
    val time: String get() = mltGpsTime ?: ""
    
    val hasValidCoordinates: Boolean
        get() = mltLat != null && mltLong != null && mltLat != 0.0 && mltLong != 0.0
}

/**
 * 위치 요약 데이터 - iOS API 응답 형식과 일치
 */
data class LocationSummary(
    @SerializedName("schedule_count") val scheduleCount: String?,
    @SerializedName("distance") val distance: String?,
    @SerializedName("duration") val duration: String?,
    @SerializedName("steps") val steps: Int?,
    // Legacy fields (fallback)
    @SerializedName("total_distance") val totalDistance: Double?,
    @SerializedName("total_time") val totalTime: Int?,
    @SerializedName("total_steps") val totalSteps: Int?,
    @SerializedName("date") val date: String?
) : Serializable {
    
    val distanceFormatted: String
        get() {
            // First try iOS format (pre-formatted string)
            if (!distance.isNullOrBlank() && distance != "0" && distance != "0.0") {
                return distance
            }
            // Fallback to legacy format
            val dist = totalDistance ?: 0.0
            return if (dist >= 1000) {
                String.format("%.1f km", dist / 1000)
            } else {
                String.format("%.0f m", dist)
            }
        }
    
    val timeFormatted: String
        get() {
            // First try iOS format (pre-formatted string)
            if (!duration.isNullOrBlank() && duration != "0" && duration != "0분") {
                return duration
            }
            // Fallback to legacy format
            val minutes = totalTime ?: 0
            return if (minutes >= 60) {
                val hours = minutes / 60
                val mins = minutes % 60
                "${hours}시간 ${mins}분"
            } else {
                "${minutes}분"
            }
        }
    
    val stepsFormatted: String
        get() {
            val stepsValue = steps ?: totalSteps ?: 0
            return if (stepsValue >= 10000) {
                String.format("%.1f만 걸음", stepsValue / 10000.0)
            } else {
                String.format("%,d 걸음", stepsValue)
            }
        }
}

data class StayTime(
    @SerializedName("start_time") val startTime: String?,
    @SerializedName("end_time") val endTime: String?,
    @SerializedName("duration") val durationDouble: Double?,
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("start_lat") val startLat: Double?,
    @SerializedName("start_long") val startLong: Double?,
    @SerializedName("location") val location: String?,
    @SerializedName("stay_duration") val stayDuration: String?
) {
    val duration: Int
        get() = durationDouble?.toInt() ?: 0

    val stayLatitude: Double? get() = latitude ?: startLat
    val stayLongitude: Double? get() = longitude ?: startLong

    val formattedDuration: String
        get() {
            if (!stayDuration.isNullOrBlank()) return stayDuration
            val d = duration
            return when {
                d >= 60 -> "${d / 60}시간 ${d % 60}분"
                else -> "${d}분"
            }
        }
}

data class StayTimeListResponse(
    @SerializedName("result") val result: String?,
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<StayTime>?,
    @SerializedName("message") val message: String?
)

/**
 * 일일 활동 카운트 (캘린더용) - iOS와 동일
 */
data class DailyCount(
    @SerializedName("date") val date: String?,
    @SerializedName("count") val count: Int?,
    @SerializedName("formatted_date") val formattedDate: String? = null,
    @SerializedName("day_of_week") val dayOfWeek: String? = null,
    @SerializedName("is_today") val isToday: Boolean? = false,
    @SerializedName("is_weekend") val isWeekend: Boolean? = false
)

/**
 * 멤버별 일별 카운트 - iOS와 동일
 */
data class MemberDailyCount(
    @SerializedName("member_id") val memberId: Int,
    @SerializedName("member_name") val memberName: String?,
    @SerializedName("mt_nickname") val mtNickname: String?,
    @SerializedName("member_photo") val memberPhoto: String?,
    @SerializedName("member_gender") val memberGender: Int?,
    @SerializedName("daily_counts") val dailyCounts: List<DailyCount>?
) {
    val displayName: String
        get() = mtNickname?.takeIf { it.isNotBlank() } ?: memberName ?: ""
}

/**
 * 그룹 전체 일별 카운트 API 응답 - iOS와 동일
 */
data class GroupDailyCountsResponse(
    @SerializedName("member_daily_counts") val memberDailyCounts: List<MemberDailyCount>?,
    @SerializedName("total_daily_counts") val totalDailyCounts: List<DailyCount>?,
    @SerializedName("total_days") val totalDays: Int?,
    @SerializedName("start_date") val startDate: String?,
    @SerializedName("end_date") val endDate: String?,
    @SerializedName("group_id") val groupId: Int?,
    @SerializedName("total_members") val totalMembers: Int?
)

/**
 * 위치 로그 목록 API 응답
 */
data class LocationLogListResponse(
    @SerializedName("result") val result: String?,
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<LocationLog>?,
    @SerializedName("message") val message: String?
)

/**
 * 위치 요약 API 응답
 */
data class LocationSummaryResponse(
    @SerializedName("result") val result: String?,
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: LocationSummary?,
    @SerializedName("message") val message: String?
)

/**
 * 일일 카운트 API 응답 (Legacy - 개별 멤버용)
 */
data class DailyCountsResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<DailyCount>?,
    @SerializedName("message") val message: String?
)

