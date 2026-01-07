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
 * 일정 관리 서비스
 */
class ScheduleService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "ScheduleService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: ScheduleService? = null
        
        fun getInstance(context: Context): ScheduleService {
            return instance ?: synchronized(this) {
                instance ?: ScheduleService(context.applicationContext).also { instance = it }
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
     * 그룹의 일정 목록 조회
     */
    suspend fun getSchedules(groupId: Int, year: Int, month: Int): List<SmapSchedule> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getSchedules] 토큰 없음")
            return@withContext emptyList()
        }
        
        // 월 시작일과 종료일 계산
        val startDate = String.format("%04d-%02d-01", year, month)
        val nextMonth = if (month == 12) 1 else month + 1
        val nextYear = if (month == 12) year + 1 else year
        val endDate = String.format("%04d-%02d-01", nextYear, nextMonth)
        
        val url = "$BASE_URL/schedules/group/$groupId?days=60"
        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $url")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            Log.d(TAG, "📡 [getSchedules] Raw Response: $responseBody")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getSchedules] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                val listType = object : TypeToken<List<SmapSchedule>>() {}.type
                val schedules: List<SmapSchedule> = gson.fromJson(responseBody, listType)
                
                // Client-side filter for the specific month AND sst_show=Y
                val filtered = schedules.filter { schedule ->
                    val date = schedule.date ?: return@filter false
                    val isVisible = schedule.sstShow?.uppercase() == "Y"
                    isVisible && date >= startDate && date < endDate
                }
                
                Log.d(TAG, "✅ [getSchedules] ${filtered.size}개 일정 로드 (전체: ${schedules.size}, visible 필터 적용)")
                return@withContext filtered
            } catch (e: Exception) {
                try {
                    val wrapper = gson.fromJson(responseBody, ScheduleListResponse::class.java)
                    val filtered = (wrapper.data ?: emptyList()).filter { schedule ->
                        val date = schedule.date ?: return@filter false
                        val isVisible = schedule.sstShow?.uppercase() == "Y"
                        isVisible && date >= startDate && date < endDate
                    }
                    return@withContext filtered
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getSchedules] 파싱 실패", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getSchedules] 네트워크 오류", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 일정 상세 조회
     */
    suspend fun getScheduleDetail(scheduleId: String): SmapSchedule? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext null
        
        val request = Request.Builder()
            .url("$BASE_URL/schedules/$scheduleId")
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) return@withContext null
            
            return@withContext gson.fromJson(responseBody, SmapSchedule::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getScheduleDetail] 오류", e)
            return@withContext null
        }
    }
    
    /**
     * 일정 생성
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
    ): SmapSchedule? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [createSchedule] 토큰 없음")
            return@withContext null
        }
        
        val jsonBody = JSONObject().apply {
            put("sgt_idx", groupId)
            put("mt_idx", memberId)
            put("sst_title", title)
            put("sst_sdate", startDate)
            put("sst_edate", endDate)
            put("sst_all_day", if (isAllDay) "Y" else "N")
            memo?.let { put("sst_memo", it) }
            locationName?.let { put("sst_location_title", it) }
            locationLat?.let { put("sst_location_lat", it) }
            locationLng?.let { put("sst_location_long", it) }
            val alarmMinutes = mapAlarmStringToMinutes(alarmTime)
            put("sst_alram", alarmMinutes ?: 0)
            repeatConfig?.let { put("sst_repeat_json_v", it) }
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/schedules")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] POST $BASE_URL/schedules")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [createSchedule] HTTP 오류: ${response.code} - $responseBody")
                return@withContext null
            }
            
            val schedule = gson.fromJson(responseBody, SmapSchedule::class.java)
            Log.d(TAG, "✅ [createSchedule] 일정 생성 완료: ${schedule.title}")
            return@withContext schedule
        } catch (e: Exception) {
            Log.e(TAG, "❌ [createSchedule] 오류", e)
            return@withContext null
        }
    }
    
    /**
     * 일정 수정
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
        editOption: String = "this" // this, future, all
    ): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val currentUserId = authService.getMtIdx().toString()
        val user = authService.getUserData()
        
        val jsonBody = JSONObject().apply {
            put("sst_idx", scheduleId)
            put("groupId", groupId)
            put("sst_pidx", parentIdx ?: 0)
            put("sst_title", title)
            put("sst_sdate", startDate)
            put("sst_edate", endDate)
            put("sst_all_day", if (isAllDay) "Y" else "N")
            put("editOption", editOption)
            put("editorId", currentUserId)
            put("editorName", user?.mtName ?: "")
            memo?.let { put("sst_memo", it) }
            locationName?.let { put("sst_location_title", it) }
            locationLat?.let { put("sst_location_lat", it) }
            locationLng?.let { put("sst_location_long", it) }
            val alarmMinutes = mapAlarmStringToMinutes(alarmTime)
            put("sst_alram", alarmMinutes ?: 0)
            repeatJson?.let { put("sst_repeat_json", it) }
            repeatConfig?.let { put("sst_repeat_json_v", it) }
        }
        
        val url = "$BASE_URL/schedule/group/$groupId/schedules/$scheduleId?current_user_id=$currentUserId"
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url(url)
            .put(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] PUT $url")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            Log.d(TAG, "📡 [updateSchedule] response: $responseBody")
            
            Log.d(TAG, "✅ [updateSchedule] 일정 수정 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [updateSchedule] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 일정 삭제
     */
    suspend fun deleteSchedule(
        scheduleId: String,
        groupId: Int,
        deleteOption: String = "this" // this, future, all
    ): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val currentUserId = authService.getMtIdx().toString()
        val url = "$BASE_URL/schedule/group/$groupId/schedules/$scheduleId?current_user_id=$currentUserId"
        
        val jsonBody = JSONObject().apply {
            put("sst_idx", scheduleId)
            put("groupId", groupId)
            put("deleteOption", deleteOption)
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url(url)
            .delete(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] DELETE $url")
            val response = httpClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [deleteSchedule] HTTP 오류: ${response.code}")
                return@withContext false
            }
            
            Log.d(TAG, "✅ [deleteSchedule] 일정 삭제 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [deleteSchedule] 오류", e)
            return@withContext false
        }
    }
}
