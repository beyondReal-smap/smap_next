package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Notification / push-log service (delegates to SmapApi via Retrofit).
 */
class NotificationService(private val api: SmapApi) {

    companion object {
        private const val TAG = "NotificationService"
    }

    /**
     * GET /push-logs/member/{memberId}
     */
    suspend fun getMemberPushLogs(memberId: Int): List<PushLog> {
        return try {
            val logs = api.getMemberPushLogs(memberId)
            Log.d(TAG, "[getMemberPushLogs] ${logs.size} logs loaded")
            logs
        } catch (e: Exception) {
            Log.e(TAG, "[getMemberPushLogs] error", e)
            emptyList()
        }
    }

    /**
     * POST /push-logs/read-all?mt_idx={memberId}
     */
    suspend fun markAllAsRead(memberId: Int): Boolean {
        return try {
            api.markAllPushLogsAsRead(memberId)
            true
        } catch (e: Exception) {
            Log.e(TAG, "[markAllAsRead] error", e)
            false
        }
    }

    /**
     * POST /push-logs/delete-all?mt_idx={memberId}
     */
    suspend fun deleteAllPushLogs(memberId: Int): Boolean {
        return try {
            api.deleteAllPushLogs(memberId)
            true
        } catch (e: Exception) {
            Log.e(TAG, "[deleteAllPushLogs] error", e)
            false
        }
    }
}
