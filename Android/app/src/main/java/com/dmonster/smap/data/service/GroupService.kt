package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Group management service (delegates to SmapApi via Retrofit).
 *
 * NOTE: Methods intentionally do NOT catch exceptions.
 * Errors propagate to the ViewModel's safeApiCall wrapper for proper handling.
 */
class GroupService(
    private val api: SmapApi,
    private val authService: AuthService,
    private val coalescer: RequestCoalescer
) {

    companion object {
        private const val TAG = "GroupService"
    }

    /**
     * GET /groups/current-user
     */
    suspend fun getGroups(): List<SmapGroup> = coalescer.share(RequestKeys.GROUPS) {
        val groups = api.getCurrentUserGroups()
        Log.d(TAG, "[getGroups] ${groups.size} groups loaded")
        groups
    }

    /**
     * GET /group-members/member/{groupId}
     */
    suspend fun getGroupMembers(groupId: Int): List<SmapGroupMember> =
        coalescer.share(RequestKeys.members(groupId)) {
            val members = api.getGroupMembers(groupId)
            Log.d(TAG, "[getGroupMembers] ${members.size} members loaded")
            members
        }

    /**
     * GET /groups/{groupId}/stats
     */
    suspend fun getGroupStats(groupId: Int): GroupStats? {
        val stats = api.getGroupStats(groupId)
        Log.d(TAG, "[getGroupStats] member_count=${stats.memberCount}")
        return stats
    }

    /**
     * Convenience wrapper — prefer calling getGroupStats() directly in the ViewModel
     * to avoid duplicate network calls when both schedule and location counts are needed.
     */
    suspend fun getGroupScheduleCount(groupId: Int): Int {
        val stats = getGroupStats(groupId)
        return stats?.weeklySchedules ?: 0
    }

    /**
     * Convenience wrapper — prefer calling getGroupStats() directly in the ViewModel
     * to avoid duplicate network calls when both schedule and location counts are needed.
     */
    suspend fun getGroupLocationCount(groupId: Int): Int {
        val stats = getGroupStats(groupId)
        return stats?.totalLocations ?: 0
    }

    /**
     * POST /groups
     */
    suspend fun createGroup(title: String, memo: String?): SmapGroup? {
        val body = CreateGroupRequest(
            sgtTitle = title,
            sgtMemo = memo ?: "",
            sgtShow = "Y"
        )
        val group = api.createGroup(body)
        coalescer.invalidate() // 이후 그룹 목록 조회가 생성 전 요청에 합류하지 않게
        Log.d(TAG, "[createGroup] created: ${group.sgtTitle}")
        return group
    }

    /**
     * PUT /groups/{groupId}
     */
    suspend fun updateGroup(groupId: Int, title: String, memo: String?): Boolean {
        val body = UpdateGroupRequest(
            sgtTitle = title,
            sgtMemo = memo ?: ""
        )
        api.updateGroup(groupId, body)
        coalescer.invalidate()
        Log.d(TAG, "[updateGroup] updated")
        return true
    }

    /**
     * PUT /groups/{groupId} (soft delete via sgt_show=N)
     */
    suspend fun deleteGroup(groupId: Int): Boolean {
        api.deleteGroup(groupId, DeleteGroupRequest())
        coalescer.invalidate()
        Log.d(TAG, "[deleteGroup] deleted")
        return true
    }

    /**
     * POST /groups/join
     */
    suspend fun joinGroupByCode(code: String): Boolean {
        val mtIdx = authService.getMtIdx()
        if (mtIdx == 0) {
            throw IllegalStateException("Cannot join group: user id (mtIdx) is missing")
        }
        val body = JoinGroupByCodeRequest(
            mtIdx = mtIdx,
            sgtCode = code.uppercase()
        )
        api.joinGroupByCode(body)
        coalescer.invalidate()
        Log.d(TAG, "[joinGroupByCode] joined")
        return true
    }

    /**
     * PUT /group-members/{groupId}/role
     */
    suspend fun updateMemberRole(groupId: Int, memberId: Int, isLeader: Boolean): Boolean {
        val body = UpdateMemberRoleRequest(
            mtIdx = memberId,
            isLeader = isLeader
        )
        api.updateMemberRole(groupId, body)
        coalescer.invalidate()
        return true
    }

    /**
     * DELETE /group-members/{groupId}/member/{memberId}
     */
    suspend fun removeMember(groupId: Int, memberId: Int): Boolean {
        api.removeMember(groupId, memberId)
        coalescer.invalidate()
        return true
    }
}
