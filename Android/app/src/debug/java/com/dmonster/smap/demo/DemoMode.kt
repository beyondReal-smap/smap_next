package com.dmonster.smap.demo

import android.content.Context
import android.content.Intent
import android.content.res.AssetManager
import android.util.Log
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONArray
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * 스토어 스크린샷용 데모 모드(디버그 빌드 전용 — release 소스셋에는 빈 껍데기만 있다).
 *
 * 켜는 법: adb shell am start -n com.dmonster.smap/.MainActivity --ez smap_demo true
 * 켜지면 화면이 읽는 조회(GET) 몇 가지만 assets/demo 의 가짜 응답으로 바꾼다.
 * 로그인·쓰기 요청 등 나머지는 그대로 실제 서버로 간다.
 * 가짜 응답은 tools/store-demo/build_fixtures.py 가 만든다(iOS 와 같은 데이터).
 */
object DemoMode {
    private const val TAG = "DemoMode"
    private const val EXTRA = "smap_demo"
    private const val API_PREFIX = "/api/v1/"

    @Volatile
    private var enabled = false
    private var assets: AssetManager? = null
    private val rules: List<Rule> by lazy { loadRules() }

    private data class Rule(
        val segments: List<String>,
        val fixture: String,
        val fallback: String?,
        val todayOnly: Boolean
    )

    /** MainActivity 가 시작 인텐트를 넘긴다. smap_demo 값이 있을 때만 켜고 끈다. */
    fun applyLaunchIntent(context: Context, intent: Intent?) {
        if (intent?.hasExtra(EXTRA) != true) return
        assets = context.applicationContext.assets
        enabled = intent.getBooleanExtra(EXTRA, false)
        Log.i(TAG, "데모 모드 ${if (enabled) "켜짐" else "꺼짐"}")
    }

    val interceptor = Interceptor { chain ->
        val request = chain.request()
        if (!enabled || request.method != "GET") return@Interceptor chain.proceed(request)

        val encodedPath = request.url.encodedPath
        val start = encodedPath.indexOf(API_PREFIX)
        if (start < 0) return@Interceptor chain.proceed(request)
        val path = encodedPath.substring(start + API_PREFIX.length).trim('/')

        val body = respond(path, request.url.queryParameter("date"))
            ?: return@Interceptor chain.proceed(request)
        Log.d(TAG, "가짜 응답: $path")
        Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(200)
            .message("OK (demo)")
            .body(body.toResponseBody("application/json; charset=utf-8".toMediaType()))
            .build()
    }

    /** 규칙에 맞으면 응답 본문, 아니면 null(실제 서버로 보낸다). */
    private fun respond(path: String, dateQuery: String?): String? {
        val segments = path.split("/")
        for (rule in rules) {
            if (rule.segments.size != segments.size) continue
            var mid: String? = null
            val matched = rule.segments.indices.all { i ->
                when (val r = rule.segments[i]) {
                    "*" -> true
                    "{mid}" -> { mid = segments[i]; true }
                    else -> r == segments[i]
                }
            }
            if (!matched) continue

            val isOtherDay = rule.todayOnly && dateQuery != null && dateQuery != LocalDate.now().toString()
            val name = if (isOtherDay) rule.fallback else rule.fixture.replace("{mid}", mid ?: "")
            val text = name?.let { readAsset(it) } ?: rule.fallback?.let { readAsset(it) } ?: return null
            return fillTokens(text)
        }
        return null
    }

    private fun loadRules(): List<Rule> {
        val text = readAsset("manifest") ?: error("assets/demo/manifest.json 이 없다 — build_fixtures.py 실행 필요")
        val arr = JSONArray(text)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Rule(
                segments = o.getString("path").split("/"),
                fixture = o.getString("fixture"),
                fallback = if (o.has("fallback")) o.getString("fallback") else null,
                todayOnly = o.optBoolean("todayOnly", false)
            )
        }
    }

    private fun readAsset(name: String): String? {
        val am = assets ?: return null
        return try {
            am.open("demo/$name.json").bufferedReader().use { it.readText() }
        } catch (e: java.io.FileNotFoundException) {
            null
        }
    }

    private val tokenRegex = Regex("""\{\{(D|MD|DOW|WE|NOW)([+-]\d+)\}\}""")
    private val dateTimeFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    private val monthDayFormat = DateTimeFormatter.ofPattern("MM.dd")

    /** 날짜 토큰을 "오늘" 기준 값으로 바꾼다(형식은 build_fixtures.py 머리말 참고). */
    private fun fillTokens(text: String): String {
        val today = LocalDate.now()
        val now = LocalDateTime.now()
        return tokenRegex.replace(text) { m ->
            val n = m.groupValues[2].toLong()
            val day = today.plusDays(n)
            when (m.groupValues[1]) {
                "D" -> day.toString()
                "MD" -> day.format(monthDayFormat)
                "DOW" -> day.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                "WE" -> (day.dayOfWeek.value >= 6).toString()
                else -> now.plusMinutes(n).format(dateTimeFormat) // NOW
            }
        }
    }
}
