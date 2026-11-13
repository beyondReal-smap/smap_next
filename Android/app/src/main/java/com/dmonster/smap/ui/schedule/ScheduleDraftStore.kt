package com.dmonster.smap.ui.schedule

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * 신규 일정 작성 중 중단됐을 때 다음 세션에서 복구하기 위한 경량 Draft 저장소.
 *
 * iOS `ScheduleFormView.ScheduleDraft` 와 동일 컨셉.
 * - SharedPreferences 기반 (외부 DataStore 의존성 없이 동작)
 * - 편집 모드(`schedule != nil`) 에서는 사용하지 않음
 * - 24시간 초과 draft 는 `loadDraft()` 호출 시 자동 폐기
 */
@Serializable
data class ScheduleDraft(
    val title: String,
    val memo: String,
    val startTime: String,
    val endTime: String,
    val isAllDay: Boolean,
    val locationName: String,
    val locationLat: Double? = null,
    val locationLng: Double? = null,
    val alarmTime: String,
    val repeatConfig: String,
    val selectedGroupSgtIdx: Int? = null,
    val targetMemberMtIdx: Int? = null,
    val savedAt: Long = System.currentTimeMillis()
) {
    /** 복구 Alert 에 보여줄 간단 요약 */
    val summaryLabel: String
        get() = when {
            title.isNotBlank() -> title
            else -> "제목 없는 일정"
        }
}

class ScheduleDraftStore private constructor(private val prefs: SharedPreferences) {
    private val json = Json { ignoreUnknownKeys = true }

    fun save(draft: ScheduleDraft) {
        prefs.edit().putString(KEY_DRAFT, json.encodeToString(draft)).apply()
    }

    fun load(): ScheduleDraft? {
        val raw = prefs.getString(KEY_DRAFT, null) ?: return null
        return try {
            val d = json.decodeFromString<ScheduleDraft>(raw)
            // 24시간 경과 시 자동 폐기 — 오래된 draft 가 새 세션을 오염시키지 않도록
            if (System.currentTimeMillis() - d.savedAt > TTL_MS) {
                clear()
                null
            } else d
        } catch (t: Throwable) {
            // 포맷 변경으로 디코딩 실패 시 깨끗이 비움
            clear()
            null
        }
    }

    fun clear() {
        prefs.edit().remove(KEY_DRAFT).apply()
    }

    companion object {
        private const val PREFS_NAME = "schedule_draft_prefs"
        private const val KEY_DRAFT = "schedule_draft_v1"
        private const val TTL_MS = 24L * 60 * 60 * 1000  // 24h

        fun from(context: Context): ScheduleDraftStore {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return ScheduleDraftStore(prefs)
        }
    }
}
