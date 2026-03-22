package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Schedule management service (delegates to SmapApi via Retrofit).
 */
class ScheduleService(
    private val api: SmapApi,
    private val authService: AuthService
) {

    companion object {
        private const val TAG = "ScheduleService"
    }

    private fun mapAlarmStringToMinutes(alarm: String?): Int? {
        return when (alarm) {
            "없음", null -> 0
            "정시" -> 1
            "5분 전" -> 5
            "10분 전" -> 10
            "15분 전" -> 15
            "30분 전" -> 30
            "1시간 전" -> 60
            "1일 전" -> 1440
            else -> null
        }
    }

    /**
     * GET /schedules/group/{groupId}?days=60, then client-side filter by year/month.
     */
    suspend fun getSchedules(groupId: Int, year: Int, month: Int): List<SmapSchedule> {
        return try {
            val startDate = String.format("%04d-%02d-01", year, month)
            val nextMonth = if (month == 12) 1 else month + 1
            val nextYear = if (month == 12) year + 1 else year
            val endDate = String.format("%04d-%02d-01", nextYear, nextMonth)

            val schedules = api.getGroupSchedules(groupId, 60)

            val filtered = schedules.filter { schedule ->
                val date = schedule.date ?: return@filter false
                val isVisible = schedule.sstShow?.uppercase() == "Y"
                isVisible && date >= startDate && date < endDate
            }

            Log.d(TAG, "[getSchedules] ${filtered.size} schedules (total: ${schedules.size})")
            filtered
        } catch (e: Exception) {
            Log.e(TAG, "[getSchedules] error", e)
            emptyList()
        }
    }

    /**
     * GET /schedules/{scheduleId}
     */
    suspend fun getScheduleDetail(scheduleId: String): SmapSchedule? {
        return try {
            api.getScheduleDetail(scheduleId)
        } catch (e: Exception) {
            Log.e(TAG, "[getScheduleDetail] error", e)
            null
        }
    }

    /**
     * POST /schedules
     */
    suspend fun createSchedule(
        groupId: Int,
        memberId: Int,
        title: String,
        startDate: String,
        endDate: String,
        isAllDay: Boolean = false,
        memo: String? = null,
        locationName: String? = null,
        locationLat: Double? = null,
        locationLng: Double? = null,
        alarmTime: String? = null,
        repeatConfig: String? = null
    ): SmapSchedule? {
        return try {
            val body = mutableMapOf<String, Any>(
                "sgt_idx" to groupId,
                "mt_idx" to memberId,
                "sst_title" to title,
                "sst_sdate" to startDate,
                "sst_edate" to endDate,
                "sst_all_day" to if (isAllDay) "Y" else "N",
                "sst_alram" to (mapAlarmStringToMinutes(alarmTime) ?: 0)
            )
            memo?.let { body["sst_memo"] = it }
            locationName?.let { body["sst_location_title"] = it }
            locationLat?.let { body["sst_location_lat"] = it }
            locationLng?.let { body["sst_location_long"] = it }
            repeatConfig?.let { body["sst_repeat_json_v"] = it }

            val schedule = api.createSchedule(body)
            Log.d(TAG, "[createSchedule] created: ${schedule.displayTitle}")
            schedule
        } catch (e: Exception) {
            Log.e(TAG, "[createSchedule] error", e)
            null
        }
    }

    /**
     * PUT /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id=...
     */
    suspend fun updateSchedule(
        scheduleId: String,
        title: String,
        startDate: String,
        endDate: String,
        isAllDay: Boolean = false,
        memo: String? = null,
        locationName: String? = null,
        locationLat: Double? = null,
        locationLng: Double? = null,
        alarmTime: String? = null,
        repeatConfig: String? = null,
        repeatJson: String? = null,
        parentIdx: Int? = null,
        groupId: Int = 0,
        editOption: String = "this"
    ): Boolean {
        return try {
            val currentUserId = authService.getMtIdx().toString()
            val user = authService.getUserData()

            val body = mutableMapOf<String, Any>(
                "sst_idx" to scheduleId,
                "groupId" to groupId,
                "sst_pidx" to (parentIdx ?: 0),
                "sst_title" to title,
                "sst_sdate" to startDate,
                "sst_edate" to endDate,
                "sst_all_day" to if (isAllDay) "Y" else "N",
                "editOption" to editOption,
                "editorId" to currentUserId,
                "editorName" to (user?.mtName ?: ""),
                "sst_alram" to (mapAlarmStringToMinutes(alarmTime) ?: 0)
            )
            memo?.let { body["sst_memo"] = it }
            locationName?.let { body["sst_location_title"] = it }
            locationLat?.let { body["sst_location_lat"] = it }
            locationLng?.let { body["sst_location_long"] = it }
            repeatJson?.let { body["sst_repeat_json"] = it }
            repeatConfig?.let { body["sst_repeat_json_v"] = it }

            api.updateSchedule(groupId, scheduleId, currentUserId, body)
            Log.d(TAG, "[updateSchedule] updated")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[updateSchedule] error", e)
            false
        }
    }

    /**
     * DELETE /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id=...
     */
    suspend fun deleteSchedule(
        scheduleId: String,
        groupId: Int,
        deleteOption: String = "this"
    ): Boolean {
        return try {
            val currentUserId = authService.getMtIdx().toString()

            val body = mapOf<String, Any>(
                "sst_idx" to scheduleId,
                "groupId" to groupId,
                "deleteOption" to deleteOption
            )

            api.deleteSchedule(groupId, scheduleId, currentUserId, body)
            Log.d(TAG, "[deleteSchedule] deleted")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[deleteSchedule] error", e)
            false
        }
    }
}
