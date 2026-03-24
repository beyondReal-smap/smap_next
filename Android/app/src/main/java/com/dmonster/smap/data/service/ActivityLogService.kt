package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Activity-log service (delegates to SmapApi via Retrofit).
 *
 * NOTE: Methods intentionally do NOT catch exceptions.
 * Errors propagate to the ViewModel's safeApiCall wrapper for proper handling.
 */
class ActivityLogService(private val api: SmapApi) {

    companion object {
        private const val TAG = "ActivityLogService"
    }

    /**
     * GET /logs/member-location-logs/{memberId}/stay-times?date=...
     */
    suspend fun getStayTimes(memberId: Int, date: String): List<StayTime> {
        val response = api.getStayTimes(memberId, date)
        val list = response.data ?: emptyList()
        Log.d(TAG, "[getStayTimes] ${list.size} stay records loaded")
        return list
    }

    /**
     * GET /logs/member-location-logs/{memberId}/daily?date=...
     */
    suspend fun getLocationLogs(memberId: Int, date: String): List<LocationLog> {
        val response = api.getLocationLogs(memberId, date)
        val logs = response.data ?: emptyList()
        Log.d(TAG, "[getLocationLogs] ${logs.size} logs loaded")
        return logs
    }

    /**
     * GET /logs/member-location-logs/{memberId}/summary?date=...
     */
    suspend fun getLocationSummary(memberId: Int, date: String): LocationSummary? {
        val response = api.getLocationSummary(memberId, date)
        Log.d(TAG, "[getLocationSummary] data=${response.data != null}")
        return response.data
    }

    /**
     * GET /logs/daily-counts?group_id=...&days=...
     */
    suspend fun getDailyCountsForGroup(groupId: Int, days: Int = 14): GroupDailyCountsResponse? {
        val response = api.getDailyCountsForGroup(groupId, days)
        Log.d(TAG, "[getDailyCountsForGroup] response received")
        return response
    }
}
