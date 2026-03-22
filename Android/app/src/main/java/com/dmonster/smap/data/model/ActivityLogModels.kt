package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 위치 로그 생성 요청 (LocationService -> server)
 */
@Serializable
data class CreateLocationLogRequest(
    @SerialName("act") val act: String = "create_location_log",
    @SerialName("mt_idx") val mtIdx: String,
    @SerialName("mlt_lat") val mltLat: Double,
    @SerialName("mlt_long") val mltLong: Double,
    @SerialName("mlt_accuracy") val mltAccuracy: Double,
    @SerialName("mlt_speed") val mltSpeed: Double,
    @SerialName("mlt_altitude") val mltAltitude: Double = 0.0,
    @SerialName("mlt_timestamp") val mltTimestamp: String,
    @SerialName("mlt_battery") val mltBattery: String,
    @SerialName("mlt_fine_location") val mltFineLocation: String = "N",
    @SerialName("mlt_location_chk") val mltLocationChk: String = "N",
    @SerialName("mt_health_work") val mtHealthWork: String = "0"
)

/**
 * 위치 로그 데이터
 */
@Serializable
data class LocationLog(
    @SerialName("mlt_idx") val mltIdx: Int? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("mlt_lat") val mltLat: Double? = null,
    @SerialName("mlt_long") val mltLong: Double? = null,
    @SerialName("mlt_speed") val mltSpeed: Double? = null,
    @SerialName("mlt_gps_time") val mltGpsTime: String? = null,
    @SerialName("mlt_wdate") val mltWdate: String? = null
) {
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
@Serializable
data class LocationSummary(
    @SerialName("schedule_count") val scheduleCount: String? = null,
    @SerialName("distance") val distance: String? = null,
    @SerialName("duration") val duration: String? = null,
    @SerialName("steps") val steps: Int? = null,
    // Legacy fields (fallback)
    @SerialName("total_distance") val totalDistance: Double? = null,
    @SerialName("total_time") val totalTime: Int? = null,
    @SerialName("total_steps") val totalSteps: Int? = null,
    @SerialName("date") val date: String? = null
) {

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

@Serializable
data class StayTime(
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("end_time") val endTime: String? = null,
    @SerialName("duration") val durationDouble: Double? = null,
    @SerialName("latitude") val latitude: Double? = null,
    @SerialName("longitude") val longitude: Double? = null,
    @SerialName("start_lat") val startLat: Double? = null,
    @SerialName("start_long") val startLong: Double? = null,
    @SerialName("location") val location: String? = null,
    @SerialName("stay_duration") val stayDuration: String? = null
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

@Serializable
data class StayTimeListResponse(
    @SerialName("result") val result: String? = null,
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<StayTime>? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 일일 활동 카운트 (캘린더용) - iOS와 동일
 */
@Serializable
data class DailyCount(
    @SerialName("date") val date: String? = null,
    @SerialName("count") val count: Int? = null,
    @SerialName("formatted_date") val formattedDate: String? = null,
    @SerialName("day_of_week") val dayOfWeek: String? = null,
    @SerialName("is_today") val isToday: Boolean? = false,
    @SerialName("is_weekend") val isWeekend: Boolean? = false
)

/**
 * 멤버별 일별 카운트 - iOS와 동일
 */
@Serializable
data class MemberDailyCount(
    @SerialName("member_id") val memberId: Int = 0,
    @SerialName("member_name") val memberName: String? = null,
    @SerialName("mt_nickname") val mtNickname: String? = null,
    @SerialName("member_photo") val memberPhoto: String? = null,
    @SerialName("member_gender") val memberGender: Int? = null,
    @SerialName("daily_counts") val dailyCounts: List<DailyCount>? = null
) {
    val displayName: String
        get() = mtNickname?.takeIf { it.isNotBlank() } ?: memberName ?: ""
}

/**
 * 그룹 전체 일별 카운트 API 응답 - iOS와 동일
 */
@Serializable
data class GroupDailyCountsResponse(
    @SerialName("member_daily_counts") val memberDailyCounts: List<MemberDailyCount>? = null,
    @SerialName("total_daily_counts") val totalDailyCounts: List<DailyCount>? = null,
    @SerialName("total_days") val totalDays: Int? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("group_id") val groupId: Int? = null,
    @SerialName("total_members") val totalMembers: Int? = null
)

/**
 * 위치 로그 목록 API 응답
 */
@Serializable
data class LocationLogListResponse(
    @SerialName("result") val result: String? = null,
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<LocationLog>? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 위치 요약 API 응답
 */
@Serializable
data class LocationSummaryResponse(
    @SerialName("result") val result: String? = null,
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: LocationSummary? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 일일 카운트 API 응답 (Legacy - 개별 멤버용)
 */
@Serializable
data class DailyCountsResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<DailyCount>? = null,
    @SerialName("message") val message: String? = null
)
