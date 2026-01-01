package com.dmonster.smap

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "SMAP_FCM"
        private const val API_BASE_URL = "https://api3.smap.site/api/v1"
        private const val PREF_NAME = "smap_prefs"
        private const val KEY_MT_IDX = "mt_idx"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_LAST_TOKEN_UPDATE = "last_token_update"

        // 안드로이드 FCM 특징:
        // ✅ Google Play 서비스가 백그라운드에서 항상 실행
        // ✅ FCM 토큰이 안정적으로 유지됨
        // ✅ 배터리 최적화가 iOS보다 유연함
        // ✅ 30일 토큰 유효기간으로 충분한 안정성 확보
    }

    private val client = OkHttpClient()

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        Log.d(TAG, "📩 [ANDROID] FCM 메시지 수신: ${remoteMessage.from}")

        // 현재 저장된 토큰 상태 확인 (삭제 현상 모니터링)
        val appContext = applicationContext
        val currentSavedToken = if (appContext != null) {
            try {
                val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                prefs.getString(KEY_FCM_TOKEN, null)
            } catch (e: Exception) {
                Log.e(TAG, "❌ [ANDROID] 저장된 토큰 가져오기 실패: ${e.message}")
                null
            }
        } else {
            Log.e(TAG, "❌ [ANDROID] Application Context가 null입니다")
            null
        }
        if (currentSavedToken == null) {
            Log.w(TAG, "⚠️ [ANDROID] FCM 수신 시 mt_token_id 없음: 로컬에 저장된 토큰이 없음")
        } else {
            Log.i(TAG, "✅ [ANDROID] FCM 수신 시 mt_token_id 확인: 로컬 토큰 정상 (${currentSavedToken.take(20)}...)")
        }

        // 데이터 메시지 처리
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "📩 [ANDROID] 데이터 메시지: ${remoteMessage.data}")

            // 데이터 메시지에서 토큰 관련 정보 확인
            val tokenInData = remoteMessage.data["fcm_token"]
            if (tokenInData != null && tokenInData != currentSavedToken) {
                Log.w(TAG, "🔄 [ANDROID] 데이터 메시지에 다른 토큰 발견: $tokenInData")
            }
        }

        // 알림 메시지 처리
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "📩 [ANDROID] 알림 메시지: ${notification.title} - ${notification.body}")
            sendNotification(notification.title, notification.body)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        Log.d(TAG, "🔥 [FCM POLICY 2] 토큰 자동 갱신 감지됨 - 즉시 서버 전송")
        Log.d(TAG, "🔥 [FCM POLICY 2] 새로운 토큰 길이: ${token.length} 문자")
        Log.d(TAG, "🔥 [FCM POLICY 2] 토큰 미리보기: ${token.take(30)}...")

        // ✅ 2단계: 토큰 자동 갱신 감지 및 즉시 전송 (가장 중요)
        // FCM SDK가 백그라운드에서 자동으로 토큰을 갱신했을 때 호출됨

        try {
            // 즉시 로컬 저장
            saveTokenToPreferences(token)
            Log.d(TAG, "💾 [FCM] 토큰 로컬 저장 완료")

            // 로그인 상태 확인 후 서버 전송 결정
            val appContext = applicationContext
            if (appContext != null) {
                val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                val isLoggedIn = prefs.getBoolean("is_logged_in", false)
                val mtIdx = prefs.getString("mt_idx", null)

                if (isLoggedIn && !mtIdx.isNullOrEmpty()) {
                    // 🚀 로그인 상태이면 즉시 서버로 전송 (가장 중요 - 지연 없이 업데이트)
                    forceUpdateTokenToServer(token, "auto_refresh")
                    Log.d(TAG, "✅ [FCM] 토큰 자동 갱신 완료 - 서버 업데이트 진행 중")
                } else {
                    // 로그인 전이면 pending 토큰으로 저장
                    Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 전 토큰 갱신 - 서버 전송 대기")
                    savePendingTokenForLogin(token)
                }
            }

            // 토큰 변경 로그 기록
            logTokenChange("auto_refresh", token)

        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM] onNewToken 처리 중 오류 발생", e)
            // 오류 발생 시에도 토큰은 저장
            try {
                saveTokenToPreferences(token)
                Log.d(TAG, "💾 [FCM] 오류 발생에도 토큰 저장 완료")
            } catch (saveError: Exception) {
                Log.e(TAG, "❌ [FCM] 토큰 저장 실패", saveError)
            }
        }
    }

    /**
     * 토큰 변경 로그 기록
     */
    private fun logTokenChange(reason: String, newToken: String) {
        val appContext = applicationContext ?: return
        val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val oldToken = prefs.getString(KEY_FCM_TOKEN, null)

        when (reason) {
            "auto_refresh" -> {
                Log.i(TAG, "🔄 [FCM POLICY 2] 자동 토큰 갱신: ${oldToken?.take(10)}... → ${newToken.take(10)}...")
            }
            "login_register" -> {
                Log.i(TAG, "📝 [FCM POLICY 1] 로그인 시 토큰 등록: ${newToken.take(10)}...")
            }
            "app_launch_check" -> {
                if (oldToken != newToken) {
                    Log.i(TAG, "🔍 [FCM POLICY 3] 앱 실행 시 토큰 변경 감지: ${oldToken?.take(10)}... → ${newToken.take(10)}...")
                } else {
                    Log.d(TAG, "✅ [FCM POLICY 3] 앱 실행 시 토큰 동일 - 갱신 불필요")
                }
            }
        }
    }

    /**
     * FCM 토큰을 강제로 서버에 업데이트 (무조건 푸시 수신 보장)
     */
    fun forceUpdateTokenToServer(token: String, reason: String) {
        Log.d(TAG, "🚀 [FCM FORCE] FCM 토큰 강제 서버 업데이트 시작 - 이유: $reason")

        // 로그인 상태 확인 - 로그인 전에는 FCM 토큰 서버 등록하지 않음
        val appContext = applicationContext ?: return
        val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val isLoggedIn = prefs.getBoolean("is_logged_in", false)
        val mtIdx = prefs.getString("mt_idx", null)

        if (!isLoggedIn || mtIdx.isNullOrEmpty()) {
            Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 상태가 아님 - FCM 토큰 서버 등록 건너뜀")
            Log.d(TAG, "   - isLoggedIn: $isLoggedIn")
            Log.d(TAG, "   - mtIdx: $mtIdx")
            Log.d(TAG, "   - 토큰은 로컬에 저장됨: ${token.take(20)}...")

            // 토큰은 로컬에 저장해두고 로그인 후 등록할 수 있도록 함
            savePendingTokenForLogin(token)
            return
        }

        val currentUserMtIdx = getCurrentUserMtIdx()
        if (currentUserMtIdx == null) {
            Log.w(TAG, "❌ [FCM FORCE] 사용자 정보 없음 - 5초 후 재시도")
            CoroutineScope(Dispatchers.Main).launch {
                kotlinx.coroutines.delay(5000)
                forceUpdateTokenToServer(token, reason + "_retry")
            }
            return
        }

        forceSendTokenToServer(token, currentUserMtIdx, reason)
    }

    private fun forceSendTokenToServer(token: String, mtIdx: Int, reason: String) {
        Log.d(TAG, "🌐 [FCM FORCE] 강제 서버 전송 시작 - mt_idx: $mtIdx")

        try {
            val url = "$API_BASE_URL/member-fcm-token/register"

            // 기존 토큰 확인 및 삭제 현상 모니터링
            val savedToken = getSavedToken()
            if (savedToken == null) {
                Log.w(TAG, "⚠️ [ANDROID] mt_token_id 삭제 감지: 기존 토큰이 없음 (새 토큰: ${token.take(30)}...)")
            } else if (savedToken != token) {
                Log.i(TAG, "🔄 [ANDROID] mt_token_id 변경: 기존 토큰 → 새 토큰 (${savedToken.take(10)}... → ${token.take(10)}...)")
            } else {
                Log.i(TAG, "✅ [ANDROID] mt_token_id 유지: 동일한 토큰 확인")
            }

            val requestData = JSONObject().apply {
                put("mt_idx", mtIdx)
                put("fcm_token", token)
                put("force_update", true)
                put("reason", reason)
                // 안드로이드 플랫폼 명시 (백엔드에서 구분용)
                put("platform", "android")
                put("device_type", "android")
            }

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val requestBody = requestData.toString().toRequestBody(mediaType)

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "SMAP-Android-App")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "❌ [FCM FORCE] 네트워크 오류: ${e.message}")
                    // 3초 후 재시도
                    CoroutineScope(Dispatchers.Main).launch {
                        kotlinx.coroutines.delay(3000)
                        forceSendTokenToServer(token, mtIdx, reason + "_retry")
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    Log.d(TAG, "📊 [FCM FORCE] HTTP 응답 코드: ${response.code}")

                    response.body?.string()?.let { responseBody ->
                        try {
                            val jsonResponse = JSONObject(responseBody)
                            Log.d(TAG, "📋 [FCM FORCE] 서버 응답: $jsonResponse")

                            val success = jsonResponse.optBoolean("success", false)
                            if (success) {
                                Log.d(TAG, "✅ [FCM FORCE] FCM 토큰 강제 업데이트 성공!")
                                // 성공 시 마지막 업데이트 시간 기록
                                saveTokenUpdateTime()
                            } else {
                                Log.e(TAG, "❌ [FCM FORCE] 서버 오류")
                                // 5초 후 재시도
                                CoroutineScope(Dispatchers.Main).launch {
                                    kotlinx.coroutines.delay(5000)
                                    forceSendTokenToServer(token, mtIdx, reason + "_retry")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "❌ [FCM FORCE] JSON 파싱 오류: ${e.message}")
                        }
                    }
                    response.close()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM FORCE] 서버 전송 준비 중 오류 발생", e)
            // 5초 후 재시도
            CoroutineScope(Dispatchers.Main).launch {
                kotlinx.coroutines.delay(5000)
                forceSendTokenToServer(token, mtIdx, reason + "_error_retry")
            }
        }
    }


    private fun sendRegistrationToServer(token: String) {
        Log.d(TAG, "🚀 [FCM API] FCM 토큰 서버 업데이트 시작")

        // 로그인 상태 확인 - 로그인 전에는 FCM 토큰 서버 등록하지 않음
        val appContext = applicationContext ?: return
        val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val isLoggedIn = prefs.getBoolean("is_logged_in", false)
        val mtIdx = prefs.getString("mt_idx", null)

        if (!isLoggedIn || mtIdx.isNullOrEmpty()) {
            Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 상태가 아님 - FCM 토큰 서버 등록 건너뜀")
            Log.d(TAG, "   - isLoggedIn: $isLoggedIn")
            Log.d(TAG, "   - mtIdx: $mtIdx")

            // 토큰은 로컬에 저장해두고 로그인 후 등록할 수 있도록 함
            savePendingTokenForLogin(token)
            return
        }

        // 현재 사용자 mt_idx 가져오기
        val currentUserMtIdx = getCurrentUserMtIdx()
        if (currentUserMtIdx == null) {
            Log.w(TAG, "❌ [FCM API] 현재 사용자 정보를 찾을 수 없음 - 나중에 재시도")
            // 5초 후 재시도
            CoroutineScope(Dispatchers.Main).launch {
                kotlinx.coroutines.delay(5000)
                retryTokenUpdate(token, 1)
            }
            return
        }

        sendTokenToServer(token, currentUserMtIdx)
    }
    
    private fun getCurrentUserMtIdx(): Int? {
        try {
            // Context null 체크 - Service에서 Context가 null일 수 있음
            val context = this
            if (context == null) {
                Log.e(TAG, "❌ [FCM API] Service Context가 null입니다")
                return null
            }

            // Application Context 사용 (더 안정적)
            val appContext = context.applicationContext
            if (appContext == null) {
                Log.e(TAG, "❌ [FCM API] Application Context가 null입니다")
                return null
            }

            // 방법 1: SharedPreferences에서 사용자 정보 확인
            val prefs: SharedPreferences = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            if (prefs == null) {
                Log.e(TAG, "❌ [FCM API] SharedPreferences가 null입니다")
                return null
            }

            // ✅ 로그인 상태 확인 - 로그인 전에는 FCM 토큰 등록하지 않음
            val isLoggedIn = prefs.getBoolean("is_logged_in", false)
            if (!isLoggedIn) {
                Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 상태가 아님 - FCM 토큰 등록 건너뜀")
                return null
            }

            val mtIdx = prefs.getInt(KEY_MT_IDX, -1)

            if (mtIdx != -1) {
                Log.d(TAG, "🔍 [FCM API] SharedPreferences에서 mt_idx 찾음: $mtIdx")
                return mtIdx
            }

            // 방법 2: 다른 키에서 확인
            val altMtIdx = prefs.getString("savedMtIdx", null)?.toIntOrNull()
            if (altMtIdx != null && altMtIdx != -1) {
                Log.d(TAG, "🔍 [FCM API] savedMtIdx에서 mt_idx 찾음: $altMtIdx")
                return altMtIdx
            }

            val currentMtIdx = prefs.getString("current_mt_idx", null)?.toIntOrNull()
            if (currentMtIdx != null && currentMtIdx != -1) {
                Log.d(TAG, "🔍 [FCM API] current_mt_idx에서 mt_idx 찾음: $currentMtIdx")
                return currentMtIdx
            }

            // 방법 3: 로그인 상태이지만 mt_idx가 없는 경우
            Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 상태이지만 mt_idx를 찾을 수 없음")
            return null

        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM API] mt_idx 가져오기 중 오류 발생", e)
            return null
        }
    }
    
    private fun sendTokenToServer(token: String, mtIdx: Int) {
        Log.d(TAG, "🌐 [FCM API] 서버로 토큰 전송 시작 - mt_idx: $mtIdx")
        
        val url = "$API_BASE_URL/member-fcm-token/check-and-update"
        
        val requestData = JSONObject().apply {
            put("mt_idx", mtIdx)
            put("fcm_token", token)
        }
        
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = requestData.toString().toRequestBody(mediaType)
        
        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SMAP-Android-App")
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "❌ [FCM API] 네트워크 오류: ${e.message}")
                // 재시도
                CoroutineScope(Dispatchers.Main).launch {
                    retryTokenUpdate(token, 1)
                }
            }
            
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "🌐 [FCM API] HTTP 응답 코드: ${response.code}")
                
                response.body?.string()?.let { responseBody ->
                    try {
                        val jsonResponse = JSONObject(responseBody)
                        Log.d(TAG, "📋 [FCM API] 서버 응답: $jsonResponse")
                        
                        val success = jsonResponse.optBoolean("success", false)
                        if (success) {
                            Log.d(TAG, "✅ [FCM API] FCM 토큰 업데이트 성공!")
                            
                            // 성공 후 확인
                            verifyTokenUpdate(mtIdx)
                        } else {
                            val message = jsonResponse.optString("message", "알 수 없는 오류")
                            Log.e(TAG, "❌ [FCM API] 서버 오류: $message")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ [FCM API] JSON 파싱 오류: ${e.message}")
                    }
                }
                response.close()
            }
        })
        
        Log.d(TAG, "🚀 [FCM API] API 요청 전송됨")
    }
    
    private fun retryTokenUpdate(token: String, retryCount: Int) {
        val maxRetries = 3
        
        if (retryCount > maxRetries) {
            Log.e(TAG, "❌ [FCM API] 최대 재시도 횟수 초과")
            return
        }
        
        Log.d(TAG, "🔄 [FCM API] FCM 토큰 업데이트 재시도 $retryCount/$maxRetries")
        
        CoroutineScope(Dispatchers.Main).launch {
            kotlinx.coroutines.delay((retryCount * 5000).toLong())
            sendRegistrationToServer(token)
        }
    }
    
    private fun verifyTokenUpdate(mtIdx: Int) {
        Log.d(TAG, "🔍 [FCM API] FCM 토큰 업데이트 확인 시작")
        
        val url = "$API_BASE_URL/member-fcm-token/status/$mtIdx"
        
        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("User-Agent", "SMAP-Android-App")
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "❌ [FCM API] 확인 요청 오류: ${e.message}")
            }
            
            override fun onResponse(call: Call, response: Response) {
                response.body?.string()?.let { responseBody ->
                    try {
                        val jsonResponse = JSONObject(responseBody)
                        Log.d(TAG, "📋 [FCM API] 토큰 상태 확인: $jsonResponse")
                        
                        val hasToken = jsonResponse.optBoolean("has_token", false)
                        if (hasToken) {
                            val tokenPreview = jsonResponse.optString("token_preview", "")
                            Log.d(TAG, "✅ [ANDROID] mt_token_id 존재: DB에 토큰 저장 확인됨: $tokenPreview")
                        } else {
                            Log.e(TAG, "❌ [ANDROID] mt_token_id 없음: DB에 토큰이 저장되지 않음 - 회원 ID: $mtIdx")
                        }

                        // 안드로이드 플랫폼 정보 추가 로깅
                        val platform = jsonResponse.optString("platform", "")
                        if (platform.isNotEmpty()) {
                            Log.d(TAG, "📱 [ANDROID] 플랫폼 정보: $platform")
                        } else {
                            Log.d(TAG, "📱 [ANDROID] 플랫폼 정보 없음")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ [FCM API] 확인 응답 파싱 오류: ${e.message}")
                    }
                }
                response.close()
            }
        })
    }

    private fun sendNotification(title: String?, messageBody: String?) {
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "smap_notification_channel"
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title ?: "SMAP")
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Android Oreo 이상에서는 알림 채널이 필요
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "SMAP 알림",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }

    /**
     * FCM 토큰을 SharedPreferences에 저장
     */
    private fun saveTokenToPreferences(token: String) {
        try {
            val appContext = applicationContext ?: return
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_FCM_TOKEN, token)
                .putLong(KEY_LAST_TOKEN_UPDATE, System.currentTimeMillis())
                .apply()

            Log.d(TAG, "💾 [FCM] 토큰을 SharedPreferences에 저장 완료")
        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM] 토큰 저장 실패: ${e.message}")
        }
    }

    /**
     * 토큰 업데이트 시간을 별도로 저장
     */
    private fun saveTokenUpdateTime() {
        try {
            val appContext = applicationContext ?: return
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putLong("last_force_token_update", System.currentTimeMillis())
                .apply()

            Log.d(TAG, "💾 [FCM] 토큰 강제 업데이트 시간 저장 완료")
        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM] 토큰 업데이트 시간 저장 실패: ${e.message}")
        }
    }

    /**
     * 저장된 FCM 토큰 가져오기
     */
    private fun getSavedToken(): String? {
        return try {
            val appContext = applicationContext ?: return null
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.getString(KEY_FCM_TOKEN, null)
        } catch (e: Exception) {
            Log.e(TAG, "❌ [FCM] 저장된 토큰 가져오기 실패: ${e.message}")
            null
        }
    }

    /**
     * FCM 토큰 유효성 검증 및 갱신
     */
    fun validateAndRefreshTokenIfNeeded() {
        Log.d(TAG, "🔍 [FCM] 토큰 유효성 검증 시작")

        val currentUserMtIdx = getCurrentUserMtIdx()
        if (currentUserMtIdx == null) {
            Log.w(TAG, "⚠️ [FCM] 사용자 정보 없음 - 검증 스킵")
            return
        }

        val savedToken = getSavedToken()
        if (savedToken.isNullOrEmpty()) {
            Log.w(TAG, "⚠️ [FCM] 저장된 토큰 없음 - 새 토큰 요청")
            // 새로운 토큰 요청
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "❌ [FCM] 토큰 가져오기 실패", task.exception)
                    return@addOnCompleteListener
                }

                val newToken = task.result
                Log.d(TAG, "✅ [FCM] 새 토큰 가져오기 성공: ${newToken?.take(30)}...")
                sendRegistrationToServer(newToken)
            }
            return
        }

        // 토큰 유효성 검증 API 호출
        validateTokenWithServer(savedToken, currentUserMtIdx)
    }

    /**
     * 서버에 토큰 유효성 검증 요청
     */
    private fun validateTokenWithServer(token: String, mtIdx: Int) {
        Log.d(TAG, "🌐 [FCM API] 토큰 유효성 검증 요청 시작")

        val url = "$API_BASE_URL/member-fcm-token/validate-and-refresh"

        val requestData = JSONObject().apply {
            put("mt_idx", mtIdx)
            put("fcm_token", token)
        }

        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = requestData.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SMAP-Android-App")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "❌ [FCM API] 토큰 검증 네트워크 오류: ${e.message}")
                // 네트워크 오류 시 재시도하지 않고 다음 기회에 검증
            }

            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "🌐 [FCM API] 토큰 검증 HTTP 응답 코드: ${response.code}")

                response.body?.string()?.let { responseBody ->
                    try {
                        val jsonResponse = JSONObject(responseBody)
                        Log.d(TAG, "📋 [FCM API] 토큰 검증 응답: $jsonResponse")

                        val success = jsonResponse.optBoolean("success", false)
                        val message = jsonResponse.optString("message", "알 수 없는 응답")

                        if (success) {
                            Log.d(TAG, "✅ [ANDROID] FCM 토큰 검증 성공: $message (30일 유효기간 적용)")

                            // 토큰이 갱신된 경우 로컬에도 업데이트
                            if (message.contains("갱신")) {
                                saveTokenToPreferences(token)
                                Log.i(TAG, "💾 [ANDROID] 로컬 토큰 업데이트 완료")
                            } else {
                                Log.i(TAG, "✅ [ANDROID] 토큰 갱신 필요 없음")
                            }
                        } else {
                            Log.w(TAG, "⚠️ [ANDROID] FCM 토큰 검증 실패: $message")

                            // 토큰이 유효하지 않은 경우 새 토큰 요청 (30일 만료 고려)
                            if (message.contains("만료") || message.contains("유효하지")) {
                                Log.d(TAG, "🔄 [ANDROID] 토큰 만료 감지 (30일 기준) - 새 토큰 요청")
                                FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                                    if (task.isSuccessful) {
                                        val newToken = task.result
                                        Log.d(TAG, "✅ [ANDROID] 새 토큰 생성 성공 - Google Play 서비스 연동")
                                        sendRegistrationToServer(newToken)
                                    } else {
                                        Log.e(TAG, "❌ [ANDROID] 새 토큰 생성 실패", task.exception)
                                    }
                                }
                            } else {
                                Log.d(TAG, "ℹ️ [ANDROID] 토큰 검증 실패이지만 만료는 아님")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ [FCM API] JSON 파싱 오류: ${e.message}")
                    }
                }
                response.close()
            }
        })
    }

    /**
     * 로그인 후 등록할 FCM 토큰 저장
     */
    private fun savePendingTokenForLogin(token: String) {
        try {
            val appContext = applicationContext ?: return
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString("pending_fcm_token_after_login", token)
                .putLong("pending_token_timestamp", System.currentTimeMillis())
                .apply()

            Log.d(TAG, "💾 [ANDROID FCM] 로그인 후 등록할 토큰 저장됨")
        } catch (e: Exception) {
            Log.e(TAG, "❌ [ANDROID FCM] Pending 토큰 저장 실패: ${e.message}")
        }
    }

    /**
     * 로그인 후 Pending FCM 토큰 처리
     * MainActivity에서 로그인 완료 후 호출
     */
    fun processPendingTokenAfterLogin() {
        Log.d(TAG, "🔄 [ANDROID FCM] 로그인 후 Pending 토큰 처리 시작")

        try {
            val appContext = applicationContext ?: return
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

            val pendingToken = prefs.getString("pending_fcm_token_after_login", null)
            if (pendingToken.isNullOrEmpty()) {
                Log.d(TAG, "ℹ️ [ANDROID FCM] 처리할 Pending 토큰 없음")
                return
            }

            val timestamp = prefs.getLong("pending_token_timestamp", 0)
            val ageMinutes = (System.currentTimeMillis() - timestamp) / (1000 * 60)

            if (ageMinutes > 30) { // 30분 이상 된 토큰은 폐기
                Log.w(TAG, "⚠️ [ANDROID FCM] Pending 토큰이 너무 오래됨 (${ageMinutes}분) - 폐기")
                prefs.edit()
                    .remove("pending_fcm_token_after_login")
                    .remove("pending_token_timestamp")
                    .apply()
                return
            }

            Log.d(TAG, "🚀 [ANDROID FCM] Pending 토큰 서버 등록 시작")
            forceUpdateTokenToServer(pendingToken, "login_register")

            // 처리 완료 후 삭제
            prefs.edit()
                .remove("pending_fcm_token_after_login")
                .remove("pending_token_timestamp")
                .apply()

            Log.d(TAG, "✅ [ANDROID FCM] Pending 토큰 처리 완료")

        } catch (e: Exception) {
            Log.e(TAG, "❌ [ANDROID FCM] Pending 토큰 처리 중 오류: ${e.message}")
        }
    }
} 