package com.dmonster.smap.data.api

import android.content.SharedPreferences
import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val prefs: SharedPreferences
) : Interceptor {
    companion object {
        private const val TAG = "AuthInterceptor"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = prefs.getString("auth_token", null)
        val request = chain.request().newBuilder().apply {
            token?.let { addHeader("Authorization", "Bearer $it") }
        }.build()

        val response = chain.proceed(request)

        // NOTE: 401이 오더라도 여기서 토큰을 삭제하지 않는다.
        // 위치 업로드처럼 장시간 백그라운드로 호출되는 엔드포인트에서 서버가 간헐적으로
        // 401을 낼 경우, 토큰이 즉시 삭제되면 이후 모든 요청이 헤더 없이 나가 영구 401 루프에 빠진다.
        // 토큰 폐기는 명시적 로그아웃이나 재인증 실패 경로에서만 수행한다.
        if (response.code == 401) {
            Log.w(TAG, "401 Unauthorized on ${chain.request().url.encodedPath} (token kept — handle at auth flow)")
        }

        return response
    }
}
