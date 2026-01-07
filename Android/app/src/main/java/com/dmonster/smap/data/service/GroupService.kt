package com.dmonster.smap.data.service

import android.content.Context
import android.util.Log
import com.dmonster.smap.data.model.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * 그룹 관리 서비스
 * 그룹 CRUD, 멤버 관리, 초대 코드 기능
 */
class GroupService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "GroupService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: GroupService? = null
        
        fun getInstance(context: Context): GroupService {
            return instance ?: synchronized(this) {
                instance ?: GroupService(context.applicationContext).also { instance = it }
            }
        }
    }
    
    private val gson = Gson()
    private val authService = AuthService.getInstance(context)
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
    
    /**
     * 현재 사용자의 그룹 목록 조회
     */
    suspend fun getGroups(): List<SmapGroup> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getGroups] 토큰 없음")
            return@withContext emptyList()
        }
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/current-user")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $BASE_URL/groups/current-user")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroups] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                val listType = object : TypeToken<List<SmapGroup>>() {}.type
                val groups: List<SmapGroup> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getGroups] ${groups.size}개 그룹 로드")
                return@withContext groups
            } catch (e: Exception) {
                try {
                    val wrapper = gson.fromJson(responseBody, GroupListResponse::class.java)
                    return@withContext wrapper.data ?: emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroups] 파싱 실패", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getGroups] 네트워크 오류", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 그룹 멤버 목록 조회
     */
    suspend fun getGroupMembers(groupId: Int): List<SmapGroupMember> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getGroupMembers] 토큰 없음")
            return@withContext emptyList()
        }
        
        val request = Request.Builder()
            .url("$BASE_URL/group-members/member/$groupId")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $BASE_URL/group-members/member/$groupId")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroupMembers] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                val listType = object : TypeToken<List<SmapGroupMember>>() {}.type
                val members: List<SmapGroupMember> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getGroupMembers] ${members.size}명 로드")
                return@withContext members
            } catch (e: Exception) {
                try {
                    val wrapper = gson.fromJson(responseBody, MemberListResponse::class.java)
                    return@withContext wrapper.data ?: emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroupMembers] 파싱 실패", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getGroupMembers] 네트워크 오류", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 그룹 통계 조회 (멤버 수, 주간 일정, 총 위치)
     */
    suspend fun getGroupStats(groupId: Int): GroupStats? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext null
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/$groupId/stats")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $BASE_URL/groups/$groupId/stats")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            Log.d(TAG, "📥 [getGroupStats] Response: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroupStats] HTTP Error: ${response.code}")
                return@withContext null
            }
            
            try {
                // Try parsing direct GroupStats
                val stats = gson.fromJson(responseBody, GroupStats::class.java)
                Log.d(TAG, "✅ [getGroupStats] member_count=${stats.memberCount}, weekly_schedules=${stats.weeklySchedules}, total_locations=${stats.totalLocations}")
                return@withContext stats
            } catch (e: Exception) {
                // Try parsing wrapped response
                try {
                    val wrapper = gson.fromJson(responseBody, GroupStatsResponse::class.java)
                    if (wrapper.success == true && wrapper.data != null) {
                        val stats = wrapper.data
                        Log.d(TAG, "✅ [getGroupStats] (wrapped) member_count=${stats.memberCount}, weekly_schedules=${stats.weeklySchedules}, total_locations=${stats.totalLocations}")
                        return@withContext stats
                    }
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroupStats] Parse Error: ${e2.message}")
                }
                return@withContext null
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getGroupStats] Network Error", e)
            return@withContext null
        }
    }
    
    /**
     * 그룹 일정 개수 조회 (최근 7일) - Deprecated, use getGroupStats instead
     */
    suspend fun getGroupScheduleCount(groupId: Int): Int = withContext(Dispatchers.IO) {
        val stats = getGroupStats(groupId)
        return@withContext stats?.weeklySchedules ?: 0
    }

    /**
     * 그룹 위치 개수 조회 - Deprecated, use getGroupStats instead
     */
    suspend fun getGroupLocationCount(groupId: Int): Int = withContext(Dispatchers.IO) {
        val stats = getGroupStats(groupId)
        return@withContext stats?.totalLocations ?: 0
    }
    
    /**
     * 그룹 생성
     */
    suspend fun createGroup(title: String, memo: String?): SmapGroup? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        val user = authService.getUserData()
        if (token.isNullOrBlank() || user == null) {
            Log.e(TAG, "❌ [createGroup] 인증 정보 없음")
            return@withContext null
        }
        
        val jsonBody = JSONObject().apply {
            put("mt_idx", user.mtIdx)
            put("sgt_title", title)
            put("sgt_memo", memo ?: "")
            put("sgt_show", "Y")
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/groups")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] POST $BASE_URL/groups")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [createGroup] HTTP 오류: ${response.code} - $responseBody")
                return@withContext null
            }
            
            val group = gson.fromJson(responseBody, SmapGroup::class.java)
            Log.d(TAG, "✅ [createGroup] 그룹 생성 완료: ${group.sgtTitle}")
            return@withContext group
        } catch (e: Exception) {
            Log.e(TAG, "❌ [createGroup] 오류", e)
            return@withContext null
        }
    }
    
    /**
     * 그룹 수정
     */
    suspend fun updateGroup(groupId: Int, title: String, memo: String?): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val jsonBody = JSONObject().apply {
            put("sgt_title", title)
            put("sgt_memo", memo ?: "")
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/$groupId")
            .put(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] PUT $BASE_URL/groups/$groupId")
            val response = httpClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [updateGroup] HTTP 오류: ${response.code}")
                return@withContext false
            }
            
            Log.d(TAG, "✅ [updateGroup] 그룹 수정 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [updateGroup] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 그룹 삭제
     */
    suspend fun deleteGroup(groupId: Int): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val jsonBody = JSONObject().apply {
            put("sgt_show", "N")
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/$groupId")
            .put(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] DELETE $BASE_URL/groups/$groupId")
            val response = httpClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [deleteGroup] HTTP 오류: ${response.code}")
                return@withContext false
            }
            
            Log.d(TAG, "✅ [deleteGroup] 그룹 삭제 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [deleteGroup] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 초대 코드로 그룹 가입
     */
    suspend fun joinGroupByCode(code: String): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        val user = authService.getUserData()
        if (token.isNullOrBlank() || user == null) return@withContext false
        
        val jsonBody = JSONObject().apply {
            put("mt_idx", user.mtIdx)
            put("sgt_code", code.uppercase())
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/join")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] POST $BASE_URL/groups/join")
            val response = httpClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [joinGroupByCode] HTTP 오류: ${response.code}")
                return@withContext false
            }
            
            Log.d(TAG, "✅ [joinGroupByCode] 그룹 가입 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [joinGroupByCode] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 멤버 역할 변경
     */
    suspend fun updateMemberRole(groupId: Int, memberId: Int, isLeader: Boolean): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val jsonBody = JSONObject().apply {
            put("mt_idx", memberId)
            put("is_leader", isLeader)
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/group-members/$groupId/role")
            .put(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "❌ [updateMemberRole] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 멤버 탈퇴
     */
    suspend fun removeMember(groupId: Int, memberId: Int): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val request = Request.Builder()
            .url("$BASE_URL/group-members/$groupId/member/$memberId")
            .delete()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "❌ [removeMember] 오류", e)
            return@withContext false
        }
    }
}
