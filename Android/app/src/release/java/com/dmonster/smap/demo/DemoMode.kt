package com.dmonster.smap.demo

import android.content.Context
import android.content.Intent
import okhttp3.Interceptor

/**
 * 운영(release) 빌드용 빈 껍데기. 데모 모드는 디버그 빌드에만 있다(src/debug/.../DemoMode.kt).
 * 운영 앱에는 가짜 응답 코드·데이터가 들어가지 않는다.
 */
object DemoMode {
    @Suppress("UNUSED_PARAMETER")
    fun applyLaunchIntent(context: Context, intent: Intent?) = Unit

    val interceptor = Interceptor { chain -> chain.proceed(chain.request()) }
}
