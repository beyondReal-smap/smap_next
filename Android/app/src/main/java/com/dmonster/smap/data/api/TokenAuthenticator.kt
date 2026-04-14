package com.dmonster.smap.data.api

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.BuildConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 401 응답을 받으면 `/auth/refresh`로 새 토큰을 받아 원 요청을 **한 번만** 재시도한다.
 * 재시도가 실패하거나 refresh 자체가 실패하면 null을 반환해 401을 상위로 전파한다.
 * 이 경우 위치 업로드 경로의 `consecutiveAuthFailures` 카운터가 동작한다.
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val prefs: SharedPreferences,
    private val json: Json
) : Authenticator {

    companion object {
        private const val TAG = "TokenAuthenticator"
        private const val KEY_TOKEN = "auth_token"
        private const val REFRESH_PATH = "auth/refresh"
    }

    // refresh 요청 자체는 공용 interceptor/authenticator를 쓰지 않는 bare 클라이언트로 호출한다.
    private val refreshClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        // 한 체인에서 한 번만 재시도. 재귀 호출 방지.
        if (responseCount(response) >= 2) return null

        // refresh 엔드포인트 자신이 401을 반환한 경우 재시도 금지(무한 루프 차단).
        val path = response.request.url.encodedPath
        if (path.endsWith("/$REFRESH_PATH") || path.endsWith(REFRESH_PATH)) return null

        val oldToken = prefs.getString(KEY_TOKEN, null).orEmpty()
        if (oldToken.isBlank()) return null

        val newToken = refreshToken(oldToken) ?: return null

        prefs.edit().putString(KEY_TOKEN, newToken).apply()
        Log.d(TAG, "Token refreshed; retrying ${response.request.method} ${path}")

        return response.request.newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    private fun refreshToken(oldToken: String): String? {
        val url = BuildConfig.API_BASE_URL.trimEnd('/') + "/" + REFRESH_PATH
        val emptyBody = ByteArray(0).toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $oldToken")
            .post(emptyBody)
            .build()

        return runCatching {
            refreshClient.newCall(request).execute().use { res ->
                if (!res.isSuccessful) {
                    Log.w(TAG, "Refresh failed: HTTP ${res.code}")
                    return@use null
                }
                val body = res.body?.string().orEmpty()
                val parsed = json.decodeFromString<TokenRefreshResponse>(body)
                if (parsed.success && !parsed.token.isNullOrBlank()) parsed.token else {
                    Log.w(TAG, "Refresh response marked not-success: ${parsed.message}")
                    null
                }
            }
        }.onFailure {
            Log.w(TAG, "Refresh request threw", it)
        }.getOrNull()
    }
}

@Serializable
private data class TokenRefreshResponse(
    val success: Boolean = false,
    val token: String? = null,
    val message: String? = null
)
