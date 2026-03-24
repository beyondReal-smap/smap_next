package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Schedule management service (delegates to SmapApi via Retrofit).
 *
 * NOTE: Methods intentionally do NOT catch exceptions.
 * Errors propagate to the ViewModel's safeApiCall wrapper for proper handling.
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
        return filtered
    }

    /**
     * GET /schedules/{scheduleId}
     */
    suspend fun getScheduleDetail(scheduleId: String): SmapSchedule? {
        return api.getScheduleDetail(scheduleId)
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
        val body = CreateScheduleRequest(
            sgtIdx = groupId,
            mtIdx = memberId,
            sstTitle = title,
            sstSdate = startDate,
            sstEdate = endDate,
            sstAllDay = if (isAllDay) "Y" else "N",
            sstAlram = mapAlarmStringToMinutes(alarmTime) ?: 0,
            sstMemo = memo,
            sstLocationTitle = locationName,
            sstLocationLat = locationLat,
            sstLocationLong = locationLng,
            sstRepeatJsonV = repeatConfig
        )

        val schedule = api.createSchedule(body)
        Log.d(TAG, "[createSchedule] created: ${schedule.displayTitle}")
        return schedule
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
        val currentUserId = authService.getMtIdx().toString()
        val user = authService.getUserData()

        val body = UpdateScheduleRequest(
            sstIdx = scheduleId,
            groupId = groupId,
            sstPidx = parentIdx ?: 0,
            sstTitle = title,
            sstSdate = startDate,
            sstEdate = endDate,
            sstAllDay = if (isAllDay) "Y" else "N",
            editOption = editOption,
            editorId = currentUserId,
            editorName = user?.mtName ?: "",
            sstAlram = mapAlarmStringToMinutes(alarmTime) ?: 0,
            sstMemo = memo,
            sstLocationTitle = locationName,
            sstLocationLat = locationLat,
            sstLocationLong = locationLng,
            sstRepeatJson = repeatJson,
            sstRepeatJsonV = repeatConfig
        )

        api.updateSchedule(groupId, scheduleId, currentUserId, body)
        Log.d(TAG, "[updateSchedule] updated")
        return true
    }

    /**
     * DELETE /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id=...
     */
    suspend fun deleteSchedule(
        scheduleId: String,
        groupId: Int,
        deleteOption: String = "this"
    ): Boolean {
        val currentUserId = authService.getMtIdx().toString()

        val body = DeleteScheduleRequest(
            sstIdx = scheduleId,
            groupId = groupId,
            deleteOption = deleteOption
        )

        api.deleteSchedule(groupId, scheduleId, currentUserId, body)
        Log.d(TAG, "[deleteSchedule] deleted")
        return true
    }
}
