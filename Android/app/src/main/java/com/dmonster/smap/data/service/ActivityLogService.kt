package com.dmonster.smap.data.service

import android.content.Context
import android.util.Log
import com.dmonster.smap.data.model.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * 활동 로그 서비스
 */
class ActivityLogService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "ActivityLogService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: ActivityLogService? = null
        
        fun getInstance(context: Context): ActivityLogService {
            return instance ?: synchronized(this) {
                instance ?: ActivityLogService(context.applicationContext).also { instance = it }
            }
        }
    }

    suspend fun getStayTimes(memberId: Int, date: String): List<StayTime> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext emptyList()
        
        // Use default parameters as per iOS: min_speed=1.0, max_accuracy=50.0, min_duration=5
        val url = "$BASE_URL/logs/member-location-logs/$memberId/stay-times?date=$date&min_speed=1.0&max_accuracy=50.0&min_duration=5"
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
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getStayTimes] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                val wrapper = gson.fromJson(responseBody, StayTimeListResponse::class.java)
                val list = wrapper.data ?: emptyList()
                Log.d(TAG, "✅ [getStayTimes] ${list.size}개 체류 데이터 로드")
                return@withContext list
            } catch (e: Exception) {
                 Log.e(TAG, "❌ [getStayTimes] 파싱 실패", e)
                 return@withContext emptyList()
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getStayTimes] 네트워크 오류", e)
            return@withContext emptyList()
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
     * 멤버의 위치 로그 조회
     */
    suspend fun getLocationLogs(memberId: Int, date: String): List<LocationLog> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getLocationLogs] 토큰 없음")
            return@withContext emptyList()
        }
        
        val url = "$BASE_URL/logs/member-location-logs/$memberId/daily?date=$date"
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
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getLocationLogs] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                // Try parsing as wrapped response first (Standard API format)
                val wrapper = gson.fromJson(responseBody, LocationLogListResponse::class.java)
                val logs = wrapper.data ?: emptyList()
                Log.d(TAG, "✅ [getLocationLogs] ${logs.size}개 로그 로드 (Wrapper)")
                return@withContext logs
            } catch (e: Exception) {
                try {
                    // Fallback to direct list
                    val listType = object : TypeToken<List<LocationLog>>() {}.type
                    val logs: List<LocationLog> = gson.fromJson(responseBody, listType)
                    Log.d(TAG, "✅ [getLocationLogs] ${logs.size}개 로그 로드 (Direct)")
                    return@withContext logs
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getLocationLogs] 파싱 실패", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getLocationLogs] 네트워크 오류", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 일일 요약 조회
     */
    suspend fun getLocationSummary(memberId: Int, date: String): LocationSummary? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext null
        
        val url = "$BASE_URL/logs/member-location-logs/$memberId/summary?date=$date"
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
            
            Log.d(TAG, "📦 [getLocationSummary] Response: ${responseBody.take(500)}")
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getLocationSummary] HTTP 오류: ${response.code}")
                return@withContext null
            }
            
            try {
                // Try parsing as wrapped response first (Standard API format)
                val wrapper = gson.fromJson(responseBody, LocationSummaryResponse::class.java)
                val summary = wrapper.data
                Log.d(TAG, "✅ [getLocationSummary] Parser: Wrapper -> Data: ${summary != null} - dist: ${summary?.distance}, dur: ${summary?.duration}")
                return@withContext summary
            } catch (e: Exception) {
                try {
                    // Fallback to direct object
                    val summary = gson.fromJson(responseBody, LocationSummary::class.java)
                    Log.d(TAG, "✅ [getLocationSummary] Parser: Direct -> distance: ${summary.distance}")
                    return@withContext summary
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getLocationSummary] 파싱 실패", e2)
                    return@withContext null
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getLocationSummary] 네트워크 오류", e)
            return@withContext null
        }
    }
    
    /**
     * 그룹 전체 멤버의 일별 활동 카운트 조회 - iOS와 동일한 API
     * GET /logs/daily-counts?group_id={groupId}&days={days}
     */
    suspend fun getDailyCountsForGroup(groupId: Int, days: Int = 14): GroupDailyCountsResponse? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getDailyCountsForGroup] 토큰 없음")
            return@withContext null
        }
        
        val url = "$BASE_URL/logs/daily-counts?group_id=$groupId&days=$days"
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
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getDailyCountsForGroup] HTTP Error: ${response.code} - $responseBody")
                return@withContext null
            }
            
            Log.d(TAG, "✅ [getDailyCountsForGroup] Response received: ${responseBody.take(200)}...")
            
            try {
                return@withContext gson.fromJson(responseBody, GroupDailyCountsResponse::class.java)
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getDailyCountsForGroup] 파싱 실패", e)
                return@withContext null
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getDailyCountsForGroup] 네트워크 오류", e)
            return@withContext null
        }
    }
}
