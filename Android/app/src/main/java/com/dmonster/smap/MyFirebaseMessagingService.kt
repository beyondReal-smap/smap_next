package com.dmonster.smap

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.RingtoneManager
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
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
        private const val PREF_NAME = "smap_auth_prefs"
        private const val KEY_MT_IDX = "mt_idx"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_LAST_TOKEN_UPDATE = "last_token_update"

        private val staticClient = OkHttpClient()

        /**
         * 외부(로그인 등)에서 토큰 업데이트를 트리거할 때 사용
         */
        fun triggerTokenUpdate(context: Context) {
            Log.d(TAG, "🚀 [FCM] 외부에서 토큰 업데이트 트리거됨")
            try {
                FirebaseMessaging.getInstance().token
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val token = task.result
                            if (!token.isNullOrEmpty()) {
                                Log.d(TAG, "✅ [FCM] 현재 토큰 획득 성공: ${token.take(20)}...")
                                forceUpdateTokenToServer(context, token, "manual_trigger")
                            } else {
                                Log.e(TAG, "❌ [FCM] 획득한 토큰이 비어있습니다.")
                            }
                        } else {
                            Log.e(TAG, "❌ [FCM] 토큰 획득 실패 (Task Not Successful)", task.exception)
                        }
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "❌ [FCM] 토큰 획득 리스너 자체 실패: ${e.message}", e)
                    }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [FCM] FirebaseMessaging 호출 중 예외 발생: ${e.message}", e)
            }
        }

        /**
         * FCM 토큰을 강제로 서버에 업데이트 (무조건 푸시 수신 보장)
         */
        fun forceUpdateTokenToServer(context: Context, token: String, reason: String) {
            val appContext = context.applicationContext ?: context
            Log.d(TAG, "🚀 [FCM FORCE] FCM 토큰 강제 서버 업데이트 시작 - 이유: $reason")

            // 로그인 상태 확인
            val prefs = appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            val authToken = prefs.getString("auth_token", null)
            val isLoggedIn = !authToken.isNullOrBlank()
            val mtIdx = prefs.getInt(KEY_MT_IDX, -1)

            if (!isLoggedIn || mtIdx == -1) {
                Log.w(TAG, "⚠️ [ANDROID FCM] 로그인 상태가 아님 - FCM 토큰 서버 등록 건너뜀")
                savePendingTokenForLogin(appContext, token)
                return
            }

            forceSendTokenToServer(appContext, token, mtIdx, reason)
        }

        private fun forceSendTokenToServer(context: Context, token: String, mtIdx: Int, reason: String) {
            Log.d(TAG, "🌐 [FCM FORCE] 강제 서버 전송 시작 - mt_idx: $mtIdx")

            try {
                val url = "$API_BASE_URL/member-fcm-token/register"
                
                val requestData = JSONObject().apply {
                    put("mt_idx", mtIdx)
                    put("fcm_token", token)
                    put("force_update", true)
                    put("reason", reason)
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

                staticClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e(TAG, "❌ [FCM FORCE] 네트워크 오류: ${e.message}")
                        CoroutineScope(Dispatchers.Main).launch {
                            kotlinx.coroutines.delay(3000)
                            forceSendTokenToServer(context, token, mtIdx, reason + "_retry")
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        response.body?.string()?.let { responseBody ->
                            try {
                                val jsonResponse = JSONObject(responseBody)
                                val success = jsonResponse.optBoolean("success", false)
                                if (success) {
                                    Log.d(TAG, "✅ [FCM FORCE] FCM 토큰 강제 업데이트 성공!")
                                    saveTokenUpdateTime(context)
                                    saveTokenToPreferences(context, token)
                                } else {
                                    Log.e(TAG, "❌ [FCM FORCE] 서버 오류: ${jsonResponse.optString("message")}")
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "❌ [FCM FORCE] JSON 파싱 오류: ${e.message}")
                            }
                        }
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "❌ [FCM FORCE] 서버 전송 오류", e)
            }
        }

        private fun savePendingTokenForLogin(context: Context, token: String) {
            val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString("pending_fcm_token_after_login", token)
                .putLong("pending_token_timestamp", System.currentTimeMillis())
                .apply()
        }

        private fun saveTokenToPreferences(context: Context, token: String) {
            val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_FCM_TOKEN, token)
                .putLong(KEY_LAST_TOKEN_UPDATE, System.currentTimeMillis())
                .apply()
        }

        private fun saveTokenUpdateTime(context: Context) {
            val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putLong("last_force_token_update", System.currentTimeMillis())
                .apply()
        }
    }

    private val client = OkHttpClient()

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "📩 [ANDROID] FCM 메시지 수신: ${remoteMessage.from}")

        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "📩 [ANDROID] 알림 메시지: ${notification.title} - ${notification.body}")
            sendNotification(notification.title, notification.body)
        }
        
        // 데이터 메시지가 있는 경우 처리
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "📩 [ANDROID] 데이터 메시지 수신: ${remoteMessage.data}")
            // 필요한 경우 데이터 메시지 처리 로직 추가
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "🔥 [FCM] 새로운 토큰 생성됨: ${token.take(20)}...")
        forceUpdateTokenToServer(this, token, "auto_refresh")
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
            .setSmallIcon(R.drawable.ic_stat_notification)  // 🔥 알림 전용 모노크롬 아이콘
            .setContentTitle(title ?: "SMAP")
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_MAX) // 최상위 우선순위
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "SMAP 알림",
                NotificationManager.IMPORTANCE_HIGH // 중요도 높음 (팝업 허용)
            )
            channel.description = "SMAP의 주요 알림을 수신합니다."
            channel.enableLights(true)
            channel.enableVibration(true)
            notificationManager.createNotificationChannel(channel)
        }

        // Android 13+ 권한 체크 로그
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            if (!hasPermission) {
                Log.e(TAG, "❌ [FCM] 알림 권한이 없습니다! (Android 13+)")
            }
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
        Log.d(TAG, "✅ [FCM] 알림 표시 완료: $title")
    }

    /**
     * 로그인 후 Pending FCM 토큰 처리
     * MainActivity에서 로그인 완료 후 호출
     */
    fun processPendingTokenAfterLogin() {
        Log.d(TAG, "🔄 [ANDROID FCM] 로그인 후 Pending 토큰 처리 시작")
        val prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val pendingToken = prefs.getString("pending_fcm_token_after_login", null)
        
        if (!pendingToken.isNullOrEmpty()) {
            forceUpdateTokenToServer(this, pendingToken, "login_register")
            prefs.edit()
                .remove("pending_fcm_token_after_login")
                .remove("pending_token_timestamp")
                .apply()
        }
    }
}