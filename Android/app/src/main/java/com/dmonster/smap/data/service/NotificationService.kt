package com.dmonster.smap.data.service

import android.content.Context
import android.util.Log
import com.dmonster.smap.data.model.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 알림 및 푸시 로그 서비스
 */
class NotificationService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "NotificationService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: NotificationService? = null
        
        fun getInstance(context: Context): NotificationService {
            return instance ?: synchronized(this) {
                instance ?: NotificationService(context.applicationContext).also { instance = it }
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
     * 특정 회원의 최근 푸시 로그 목록 조회 (최근 7일)
     * GET /api/v1/push-logs/member/{memberId}
     */
    suspend fun getMemberPushLogs(memberId: Int): List<PushLog> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getMemberPushLogs] 토큰 없음")
            return@withContext emptyList()
        }
        
        val url = "$BASE_URL/push-logs/member/$memberId"
        
        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] GET $url")
            val response = httpClient.newCall(request).execute()
            val responseCode = response.code
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [getMemberPushLogs] HTTP 오류: $responseCode - $responseBody")
                return@withContext emptyList()
            }
            
            try {
                // 배열 형태로 파싱 (FastAPI 기본)
                val listType = object : TypeToken<List<PushLog>>() {}.type
                val logs: List<PushLog> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getMemberPushLogs] ${logs.size}개 로그 로드 성공")
                return@withContext logs
            } catch (e: Exception) {
                // wrapper 형태로 재시도
                try {
                    val wrapper = gson.fromJson(responseBody, PushLogListResponse::class.java)
                    return@withContext wrapper.data ?: emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getMemberPushLogs] 파싱 실패: $responseBody", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [getMemberPushLogs] 오류 발생", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 특정 회원의 모든 푸시 로그 읽음 처리
     * POST /api/v1/push-logs/read-all
     */
    suspend fun markAllAsRead(memberId: Int): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val url = "$BASE_URL/push-logs/read-all?mt_idx=$memberId"
        
        val request = Request.Builder()
            .url(url)
            .post("".toRequestBody()) // Empty body
            .addHeader("Authorization", "Bearer $token")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "❌ [markAllAsRead] 오류 발생", e)
            return@withContext false
        }
    }

    /**
     * 특정 회원의 모든 푸시 로그 삭제 처리 (plt_show = 'N')
     * POST /api/v1/push-logs/delete-all
     */
    suspend fun deleteAllPushLogs(memberId: Int): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val url = "$BASE_URL/push-logs/delete-all?mt_idx=$memberId"
        
        val request = Request.Builder()
            .url(url)
            .post("".toRequestBody())
            .addHeader("Authorization", "Bearer $token")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "❌ [deleteAllPushLogs] 오류 발생", e)
            return@withContext false
        }
    }
}
