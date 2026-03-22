package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Group management service (delegates to SmapApi via Retrofit).
 */
class GroupService(private val api: SmapApi) {

    companion object {
        private const val TAG = "GroupService"
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
     * GET /groups/{groupId}/stats
     */
    suspend fun getGroupStats(groupId: Int): GroupStats? {
        return try {
            val stats = api.getGroupStats(groupId)
            Log.d(TAG, "[getGroupStats] member_count=${stats.memberCount}")
            stats
        } catch (e: Exception) {
            Log.e(TAG, "[getGroupStats] error", e)
            null
        }
    }

    /**
     * Deprecated, use getGroupStats instead
     */
    suspend fun getGroupScheduleCount(groupId: Int): Int {
        val stats = getGroupStats(groupId)
        return stats?.weeklySchedules ?: 0
    }

    /**
     * Deprecated, use getGroupStats instead
     */
    suspend fun getGroupLocationCount(groupId: Int): Int {
        val stats = getGroupStats(groupId)
        return stats?.totalLocations ?: 0
    }

    /**
     * POST /groups
     */
    suspend fun createGroup(title: String, memo: String?): SmapGroup? {
        return try {
            val body = mutableMapOf<String, Any>(
                "sgt_title" to title,
                "sgt_memo" to (memo ?: ""),
                "sgt_show" to "Y"
            )
            val group = api.createGroup(body)
            Log.d(TAG, "[createGroup] created: ${group.sgtTitle}")
            group
        } catch (e: Exception) {
            Log.e(TAG, "[createGroup] error", e)
            null
        }
    }

    /**
     * PUT /groups/{groupId}
     */
    suspend fun updateGroup(groupId: Int, title: String, memo: String?): Boolean {
        return try {
            val body = mapOf<String, Any>(
                "sgt_title" to title,
                "sgt_memo" to (memo ?: "")
            )
            api.updateGroup(groupId, body)
            Log.d(TAG, "[updateGroup] updated")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[updateGroup] error", e)
            false
        }
    }

    /**
     * PUT /groups/{groupId} (soft delete via sgt_show=N)
     */
    suspend fun deleteGroup(groupId: Int): Boolean {
        return try {
            val body = mapOf<String, Any>("sgt_show" to "N")
            api.deleteGroup(groupId, body)
            Log.d(TAG, "[deleteGroup] deleted")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[deleteGroup] error", e)
            false
        }
    }

    /**
     * POST /groups/join
     */
    suspend fun joinGroupByCode(code: String): Boolean {
        return try {
            val body = mapOf<String, Any>(
                "sgt_code" to code.uppercase()
            )
            api.joinGroupByCode(body)
            Log.d(TAG, "[joinGroupByCode] joined")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[joinGroupByCode] error", e)
            false
        }
    }

    /**
     * PUT /group-members/{groupId}/role
     */
    suspend fun updateMemberRole(groupId: Int, memberId: Int, isLeader: Boolean): Boolean {
        return try {
            val body = mapOf<String, Any>(
                "mt_idx" to memberId,
                "is_leader" to isLeader
            )
            api.updateMemberRole(groupId, body)
            true
        } catch (e: Exception) {
            Log.e(TAG, "[updateMemberRole] error", e)
            false
        }
    }

    /**
     * DELETE /group-members/{groupId}/member/{memberId}
     */
    suspend fun removeMember(groupId: Int, memberId: Int): Boolean {
        return try {
            api.removeMember(groupId, memberId)
            true
        } catch (e: Exception) {
            Log.e(TAG, "[removeMember] error", e)
            false
        }
    }
}
