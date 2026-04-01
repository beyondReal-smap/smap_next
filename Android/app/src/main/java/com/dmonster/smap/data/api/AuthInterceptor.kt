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

        if (response.code == 401) {
            Log.w(TAG, "401 Unauthorized - clearing auth token")
            prefs.edit().remove("auth_token").apply()
        }

        return response
    }
}
