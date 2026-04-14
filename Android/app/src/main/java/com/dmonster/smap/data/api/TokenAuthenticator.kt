package com.dmonster.smap.data.api

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.auth.TokenStore
import kotlinx.serialization.SerialName
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
 * 401 응답 → `/auth/refresh` (v2: body) 호출 → 새 access + 새 refresh 받아 원 요청 재시도.
 * Refresh 요청이 실패하면 null 반환해 401을 상위로 전파한다.
 *
 * 동시에 여러 요청이 401을 받을 경우 OkHttp는 connection 단위로 직렬화하지 않으므로
 * 짧은 race가 가능하다. rotation이 활성화되어 있을 때 동시 두 요청이 같은 raw token으로
 * refresh를 시도하면 두 번째가 reuse detection에 걸려 체인이 폐기될 수 있다 →
 * @Synchronized로 단일 진입을 보장한다.
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val prefs: SharedPreferences,
    private val tokenStore: TokenStore,
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

    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        // 한 체인에서 한 번만 재시도. 재귀 호출 방지.
        if (responseCount(response) >= 2) return null

        // refresh 엔드포인트 자신이 401을 반환한 경우 재시도 금지(무한 루프 차단).
        val path = response.request.url.encodedPath
        if (path.endsWith("/$REFRESH_PATH") || path.endsWith(REFRESH_PATH)) return null

        // 다른 요청이 먼저 갱신을 마쳐 prefs의 access가 이미 새 값일 수 있다.
        // 원 요청 헤더와 현재 access가 다르면 갱신 호출 없이 그 값으로 재시도.
        val currentToken = prefs.getString(KEY_TOKEN, null).orEmpty()
        val authHeader = response.request.header("Authorization").orEmpty()
        if (currentToken.isNotBlank() && authHeader != "Bearer $currentToken") {
            return response.request.newBuilder()
                .header("Authorization", "Bearer $currentToken")
                .build()
        }

        // refresh 시도 — secure store에 refresh가 있으면 v2(body), 없으면 v1(Bearer)로 fallback.
        val refresh = tokenStore.getRefreshToken().orEmpty()
        val rotated: RotateResult? = when {
            refresh.isNotBlank() -> refreshWithRefreshToken(refresh)
            currentToken.isNotBlank() ->
                refreshWithBearer(currentToken)?.let { RotateResult(it, null) }
            else -> null
        }
        if (rotated == null) return null

        prefs.edit().putString(KEY_TOKEN, rotated.access).apply()
        rotated.refresh?.let { tokenStore.saveRefreshToken(it) }

        Log.d(TAG, "Token refreshed (v=${if (rotated.refresh != null) "v2" else "v1"}); retrying ${response.request.method} $path")
        return response.request.newBuilder()
            .header("Authorization", "Bearer ${rotated.access}")
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

    private data class RotateResult(val access: String, val refresh: String?)

    /** v2: body `{"refresh_token": "..."}` 호출. 새 access + 새 refresh 반환. */
    private fun refreshWithRefreshToken(refresh: String): RotateResult? {
        val payload = """{"refresh_token":"${escapeJson(refresh)}"}"""
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(refreshUrl())
            .post(payload)
            .build()
        return runCatching {
            refreshClient.newCall(request).execute().use { res ->
                if (!res.isSuccessful) {
                    Log.w(TAG, "v2 refresh failed: HTTP ${res.code}")
                    return@use null
                }
                val body = res.body?.string().orEmpty()
                val parsed = json.decodeFromString<TokenRefreshResponse>(body)
                if (parsed.success && !parsed.token.isNullOrBlank()) {
                    RotateResult(parsed.token, parsed.refreshToken)
                } else {
                    Log.w(TAG, "v2 refresh marked not-success: ${parsed.message}")
                    null
                }
            }
        }.onFailure { Log.w(TAG, "v2 refresh threw", it) }.getOrNull()
    }

    /** v1 fallback: Bearer access token. 새 access만 반환(refresh 없음). */
    private fun refreshWithBearer(oldAccess: String): String? {
        val empty = ByteArray(0).toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(refreshUrl())
            .addHeader("Authorization", "Bearer $oldAccess")
            .post(empty)
            .build()
        return runCatching {
            refreshClient.newCall(request).execute().use { res ->
                if (!res.isSuccessful) {
                    Log.w(TAG, "v1 refresh failed: HTTP ${res.code}")
                    return@use null
                }
                val body = res.body?.string().orEmpty()
                val parsed = json.decodeFromString<TokenRefreshResponse>(body)
                if (parsed.success && !parsed.token.isNullOrBlank()) parsed.token else null
            }
        }.onFailure { Log.w(TAG, "v1 refresh threw", it) }.getOrNull()
    }

    private fun refreshUrl(): String =
        BuildConfig.API_BASE_URL.trimEnd('/') + "/" + REFRESH_PATH

    private fun escapeJson(s: String): String =
        s.replace("\\", "\\\\").replace("\"", "\\\"")
}

@Serializable
private data class TokenRefreshResponse(
    val success: Boolean = false,
    val token: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Int? = null,
    val message: String? = null
)
