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
 * 내 장소(MyPlace) 관리 서비스
 */
class MyPlaceService private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "MyPlaceService"
        private const val BASE_URL = "https://api3.smap.site/api/v1"
        
        @Volatile
        private var instance: MyPlaceService? = null
        
        fun getInstance(context: Context): MyPlaceService {
            return instance ?: synchronized(this) {
                instance ?: MyPlaceService(context.applicationContext).also { instance = it }
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
     * 멤버의 저장 장소 목록 조회
     */
    suspend fun getLocations(memberId: Int): List<SavedLocation> = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) {
            Log.e(TAG, "❌ [getLocations] 토큰 없음")
            return@withContext emptyList()
        }
        
        val url = "$BASE_URL/locations/member/$memberId"
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
                Log.e(TAG, "❌ [getLocations] HTTP 오류: ${response.code}")
                return@withContext emptyList()
            }
            
            try {
                val listType = object : TypeToken<List<SavedLocation>>() {}.type
                val locations: List<SavedLocation> = gson.fromJson(responseBody, listType)
                Log.d(TAG, "✅ [getLocations] ${locations.size}개 장소 로드")
                return@withContext locations
            } catch (e: Exception) {
                try {
                    val wrapper = gson.fromJson(responseBody, SavedLocationListResponse::class.java)
                    return@withContext wrapper.data ?: emptyList()
                } catch (e2: Exception) {
                    Log.e(TAG, "❌ [getLocations] 파싱 실패", e2)
                    return@withContext emptyList()
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "❌ [getLocations] 네트워크 오류", e)
            return@withContext emptyList()
        }
    }
    
    /**
     * 장소 생성
     */
    suspend fun createLocation(
        memberId: Int,
        groupId: Int,
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String? = null
    ): SavedLocation? = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext null
        
        val jsonBody = JSONObject().apply {
            put("mt_idx", memberId)
            put("sgt_idx", groupId)
            put("slt_title", title)
            put("slt_add", address)
            put("slt_lat", lat)
            put("slt_long", lng)
            memo?.let { put("slt_memo", it) }
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/locations")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            Log.d(TAG, "🚀 [HTTP] POST $BASE_URL/locations")
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [createLocation] HTTP 오류: ${response.code}")
                return@withContext null
            }
            
            val location = gson.fromJson(responseBody, SavedLocation::class.java)
            Log.d(TAG, "✅ [createLocation] 장소 생성 완료: ${location.name}")
            return@withContext location
        } catch (e: Exception) {
            Log.e(TAG, "❌ [createLocation] 오류", e)
            return@withContext null
        }
    }
    
    /**
     * 장소 수정
     */
    suspend fun updateLocation(
        locationId: Int,
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String? = null,
        enterAlarm: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val jsonBody = JSONObject().apply {
            put("slt_title", title)
            put("slt_add", address)
            put("slt_lat", lat)
            put("slt_long", lng)
            memo?.let { put("slt_memo", it) }
            enterAlarm?.let { put("slt_enter_alarm", it) }
        }
        
        val requestBody = jsonBody.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$BASE_URL/locations/$locationId")
            .put(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [updateLocation] HTTP 오류: ${response.code}")
                return@withContext false
            }
            Log.d(TAG, "✅ [updateLocation] 장소 수정 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [updateLocation] 오류", e)
            return@withContext false
        }
    }
    
    /**
     * 장소 삭제
     */
    suspend fun deleteLocation(locationId: Int): Boolean = withContext(Dispatchers.IO) {
        val token = authService.getToken()
        if (token.isNullOrBlank()) return@withContext false
        
        val request = Request.Builder()
            .url("$BASE_URL/locations/$locationId")
            .delete()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        
        try {
            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.e(TAG, "❌ [deleteLocation] HTTP 오류: ${response.code}")
                return@withContext false
            }
            Log.d(TAG, "✅ [deleteLocation] 장소 삭제 완료")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "❌ [deleteLocation] 오류", e)
            return@withContext false
        }
    }
}
