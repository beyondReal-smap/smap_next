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
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Home 화면 데이터 서비스 (iOS HomeModels 기반)
 * 그룹, 멤버, 일정 API 호출 담당
 */
class HomeService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "HomeService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: HomeService? = null
        
        fun getInstance(context: Context): HomeService {
            return instance ?: synchronized(this) {
                instance ?: HomeService(context.applicationContext).also { instance = it }
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
     * GET /api/v1/groups/current-user
     */
    suspend fun getGroups(): List<SmapGroup> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        Log.d(TAG, "🔍 [getGroups] Token status: ${if (token.isNullOrEmpty()) "NULL/EMPTY" else "EXISTS(len=${token.length})"} ")
        
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getGroups] 토큰 없음")
            return@withContext emptyList()
        }
        
        val request = Request.Builder()
            .url("$BASE_URL/groups/current-user")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SmapAndroid/1.0")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $BASE_URL/groups/current-user")
            
            val response = httpClient.newCall(request).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode, Body: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroups] HTTP 오류: $responseCode - $responseBody")
                return@withContext emptyList()
            }
            
            // 응답 파싱
            try {
                // 먼저 배열 형태로 파싱 시도 (가장 빈번한 형태)
                val listType = object : TypeToken<List<SmapGroup>>() {}.type
                val groups: List<SmapGroup> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getGroups] 그룹 ${groups.size}개 로드 성공 (list)")
                return@withContext groups
            } catch (e: Exception) {
                // 실패하면 wrapper 형태로 파싱 시도 ({data: [...]})
                try {
                    val wrapper = gson.fromJson(responseBody, GroupListResponse::class.java)
                    if (wrapper != null && wrapper.data != null) {
                        Log.d(TAG, "✅ [getGroups] 그룹 ${wrapper.data.size}개 로드 성공 (wrapper)")
                        return@withContext wrapper.data
                    }
                    return@withContext emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroups] 응답 파싱 실패: $responseBody", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getGroups] 오류 발생", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 그룹 멤버 목록 조회
     * GET /api/v1/group-members/member/{groupId}
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
            .addHeader("User-Agent", "SmapAndroid/1.0")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $BASE_URL/group-members/member/$groupId")
            
            val response = httpClient.newCall(request).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode, Body: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroupMembers] HTTP 오류: $responseCode - $responseBody")
                return@withContext emptyList()
            }
            
            // 응답 파싱
            try {
                // 먼저 배열 형태로 파싱 시도
                val listType = object : TypeToken<List<SmapGroupMember>>() {}.type
                val members: List<SmapGroupMember> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getGroupMembers] 멤버 ${members.size}명 로드 성공 (list)")
                return@withContext members
            } catch (e: Exception) {
                // 실패하면 wrapper 형태로 파싱 시도
                try {
                    val wrapper = gson.fromJson(responseBody, MemberListResponse::class.java)
                    if (wrapper != null && wrapper.data != null) {
                        Log.d(TAG, "✅ [getGroupMembers] 멤버 ${wrapper.data.size}명 로드 성공 (wrapper)")
                        return@withContext wrapper.data
                    }
                    return@withContext emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroupMembers] 응답 파싱 실패: $responseBody", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getGroupMembers] 오류 발생", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 그룹 일정 목록 조회
     * GET /api/v1/schedules/group/{groupId}?days=14
     */
    suspend fun getGroupSchedules(groupId: Int, days: Int = 14): List<SmapSchedule> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getGroupSchedules] 토큰 없음")
            return@withContext emptyList()
        }
        
        val url = "$BASE_URL/schedules/group/$groupId?days=$days"
        
        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SmapAndroid/1.0")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $url")
            
            val response = httpClient.newCall(request).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode, Body: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getGroupSchedules] HTTP 오류: $responseCode - $responseBody")
                return@withContext emptyList()
            }
            
            // 응답 파싱
            try {
                // 먼저 배열 형태로 파싱 시도
                val listType = object : TypeToken<List<SmapSchedule>>() {}.type
                val schedules: List<SmapSchedule> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getGroupSchedules] 일정 ${schedules.size}개 로드 성공 (list)")
                return@withContext schedules
            } catch (e: Exception) {
                // 실패하면 wrapper 형태로 파싱 시도
                try {
                    val wrapper = gson.fromJson(responseBody, ScheduleListResponse::class.java)
                    if (wrapper != null && wrapper.data != null) {
                        Log.d(TAG, "✅ [getGroupSchedules] 일정 ${wrapper.data.size}개 로드 성공 (wrapper)")
                        return@withContext wrapper.data
                    }
                    return@withContext emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getGroupSchedules] 응답 파싱 실패: $responseBody", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getGroupSchedules] 오류 발생", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 그룹 생성
     * POST /api/v1/groups
     */
    suspend fun createGroup(title: String, memo: String): SmapGroup? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [createGroup] 토큰 없음")
            return@withContext null
        }
        
        val requestBody = mapOf(
            "sgt_title" to title,
            "sgt_memo" to memo
        )
        val jsonBody = gson.toJson(requestBody)
        
        val request = Request.Builder()
            .url("$BASE_URL/groups")
            .post(jsonBody.toByteArray().toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SmapAndroid/1.0")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] POST $BASE_URL/groups - $jsonBody")
            
            val response = httpClient.newCall(request).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "📥 [HTTP Response] Code: $responseCode, Body: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [createGroup] HTTP 오류: $responseCode - $responseBody")
                return@withContext null
            }
            
            // 응답 파싱
            try {
                val group = gson.fromJson(responseBody, SmapGroup::class.java)
                Log.d(TAG, "✅ [createGroup] 그룹 생성 성공: ${group?.sgtIdx}")
                return@withContext group
            } catch (e: Exception) {
                Log.e(TAG, "❌ [createGroup] 응답 파싱 실패: $responseBody", e)
                return@withContext null
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [createGroup] 오류 발생", e)
            return@withContext null
        }
    }
}
