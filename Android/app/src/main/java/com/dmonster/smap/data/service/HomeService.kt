package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Home screen data service (delegates to SmapApi via Retrofit).
 *
 * NOTE: Methods intentionally do NOT catch exceptions.
 * Errors propagate to the ViewModel's safeApiCall wrapper for proper handling.
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
        val groups = api.getCurrentUserGroups()
        Log.d(TAG, "[getGroups] ${groups.size} groups loaded")
        return groups
    }

    /**
     * GET /group-members/member/{groupId}
     */
    suspend fun getGroupMembers(groupId: Int): List<SmapGroupMember> {
        val members = api.getGroupMembers(groupId)
        Log.d(TAG, "[getGroupMembers] ${members.size} members loaded")
        return members
    }

    /**
     * GET /schedules/group/{groupId}?days={days}
     */
    suspend fun getGroupSchedules(groupId: Int, days: Int = 14): List<SmapSchedule> {
        val schedules = api.getGroupSchedules(groupId, days)
        Log.d(TAG, "[getGroupSchedules] ${schedules.size} schedules loaded")
        return schedules
    }

    /**
     * POST /groups
     */
    suspend fun createGroup(title: String, memo: String): SmapGroup? {
        val body = CreateGroupRequest(
            sgtTitle = title,
            sgtMemo = memo
        )
        val group = api.createGroup(body)
        Log.d(TAG, "[createGroup] created: ${group.sgtIdx}")
        return group
    }

    /**
     * Two-step join: lookup group by invite code, then join it.
     * Step 1: GET /groups/code/{code}
     * Step 2: POST /groups/{groupId}/join
     */
    suspend fun joinGroup(inviteCode: String): Boolean {
        val mtIdx = authService.getMtIdx()
        if (mtIdx == 0) {
            throw IllegalStateException("Cannot join group: user id (mtIdx) is missing")
        }

        // Step 1: look up group by invite code
        val group = api.getGroupByCode(inviteCode)
        val groupId = group.sgtIdx
        Log.d(TAG, "[joinGroup] group found: $groupId - ${group.sgtTitle}")

        // Step 2: join the group
        val body = JoinGroupRequest(
            mtIdx = mtIdx,
            sgtIdx = groupId
        )
        api.joinGroup(groupId, body)
        Log.d(TAG, "[joinGroup] joined successfully")
        return true
    }
}
