package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Home screen data service (delegates to SmapApi via Retrofit).
 */
class HomeService(
    private val api: SmapApi,
    private val authService: AuthService
) {

    companion object {
        private const val TAG = "HomeService"
    }

    /**
     * Returns the current user's mt_idx.
     */
    fun getCurrentUserIdx(): Int? {
        return authService.getUserData()?.mtIdx
    }

    /**
     * GET /groups/current-user
     */
    suspend fun getGroups(): List<SmapGroup> {
        return try {
            val groups = api.getCurrentUserGroups()
            Log.d(TAG, "[getGroups] ${groups.size} groups loaded")
            groups
        } catch (e: Exception) {
            Log.e(TAG, "[getGroups] error", e)
            emptyList()
        }
    }

    /**
     * GET /group-members/member/{groupId}
     */
    suspend fun getGroupMembers(groupId: Int): List<SmapGroupMember> {
        return try {
            val members = api.getGroupMembers(groupId)
            Log.d(TAG, "[getGroupMembers] ${members.size} members loaded")
            members
        } catch (e: Exception) {
            Log.e(TAG, "[getGroupMembers] error", e)
            emptyList()
        }
    }

    /**
     * GET /schedules/group/{groupId}?days={days}
     */
    suspend fun getGroupSchedules(groupId: Int, days: Int = 14): List<SmapSchedule> {
        return try {
            val schedules = api.getGroupSchedules(groupId, days)
            Log.d(TAG, "[getGroupSchedules] ${schedules.size} schedules loaded")
            schedules
        } catch (e: Exception) {
            Log.e(TAG, "[getGroupSchedules] error", e)
            emptyList()
        }
    }

    /**
     * POST /groups
     */
    suspend fun createGroup(title: String, memo: String): SmapGroup? {
        return try {
            val body = mapOf<String, Any>(
                "sgt_title" to title,
                "sgt_memo" to memo
            )
            val group = api.createGroup(body)
            Log.d(TAG, "[createGroup] created: ${group.sgtIdx}")
            group
        } catch (e: Exception) {
            Log.e(TAG, "[createGroup] error", e)
            null
        }
    }

    /**
     * Two-step join: lookup group by invite code, then join it.
     * Step 1: GET /groups/code/{code}
     * Step 2: POST /groups/{groupId}/join
     */
    suspend fun joinGroup(inviteCode: String): Boolean {
        return try {
            val mtIdx = authService.getMtIdx()
            if (mtIdx == 0) {
                Log.e(TAG, "[joinGroup] user id missing")
                return false
            }

            // Step 1: look up group by invite code
            val group = api.getGroupByCode(inviteCode)
            val groupId = group.sgtIdx
            Log.d(TAG, "[joinGroup] group found: $groupId - ${group.sgtTitle}")

            // Step 2: join the group
            val body = mapOf<String, Any>(
                "mt_idx" to mtIdx,
                "sgt_idx" to groupId
            )
            api.joinGroup(groupId, body)
            Log.d(TAG, "[joinGroup] joined successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[joinGroup] error", e)
            false
        }
    }
}
