package com.dmonster.smap

import com.dmonster.smap.data.model.CreateLocationLogRequest

/**
 * LocationService의 서버 전송 대기 큐.
 *
 * - 같은 사용자·좌표·시각의 위치는 한 번만 쌓는다(같은 위치가 여러 경로로 들어와 중복 업로드되던 문제).
 *   속도·정확도 같은 부가 값이 달라도 시각·좌표가 같으면 같은 위치로 본다.
 * - 용량이 차면 가장 오래된 것부터 버린다(기존 정책 유지: 100건).
 * - 스레드 안전: 위치 콜백 스레드, 배치 타이머, 네트워크 콜백이 동시에 접근한다.
 *
 * 수집 주기·정확도·배터리 정책에는 관여하지 않는다. 중복 제거와 순서 보존만 한다.
 */
internal class PendingLocationQueue(private val maxSize: Int) {
    private val items = ArrayList<CreateLocationLogRequest>()

    val size: Int get() = synchronized(items) { items.size }

    /** @return 새로 쌓았으면 true, 같은 위치가 이미 있어 무시했으면 false */
    fun add(request: CreateLocationLogRequest): Boolean = synchronized(items) {
        if (items.any { sameFix(it, request) }) return false
        items.add(request)
        trim()
        true
    }

    /** 전송에 실패해 돌려받은 항목을 새로 쌓인 것보다 앞(시간순)에 되돌린다. */
    fun addFirst(requests: List<CreateLocationLogRequest>) = synchronized(items) {
        val fresh = requests.filter { r -> items.none { sameFix(it, r) } }
        items.addAll(0, dedupe(fresh))
        trim()
    }

    /** 쌓인 것을 시간순으로 모두 꺼내고 큐를 비운다. */
    fun drain(): List<CreateLocationLogRequest> = synchronized(items) {
        val out = items.toList()
        items.clear()
        out
    }

    fun snapshot(): List<CreateLocationLogRequest> = synchronized(items) { items.toList() }

    /** 디스크에 저장돼 있던 큐로 교체한다(저장본 안의 중복도 제거). */
    fun restore(restored: List<CreateLocationLogRequest>) = synchronized(items) {
        items.clear()
        items.addAll(dedupe(restored))
        trim()
    }

    private fun trim() {
        while (items.size > maxSize) items.removeAt(0)
    }

    private fun dedupe(list: List<CreateLocationLogRequest>): List<CreateLocationLogRequest> {
        val out = ArrayList<CreateLocationLogRequest>(list.size)
        for (r in list) if (out.none { sameFix(it, r) }) out.add(r)
        return out
    }

    private fun sameFix(a: CreateLocationLogRequest, b: CreateLocationLogRequest): Boolean =
        a.mtIdx == b.mtIdx && a.mltTimestamp == b.mltTimestamp &&
            a.mltLat == b.mltLat && a.mltLong == b.mltLong
}

/** 위치 1건 전송 결과. */
internal enum class UploadOutcome {
    /** 서버가 받았다. */
    DELIVERED,
    /** 다시 보내도 소용없어 버린다(예: 403). 다음 항목은 계속 보낸다. */
    DROPPED,
    /** 일시 실패(네트워크·5xx·429·401). 이 항목부터 나머지를 큐에 되돌리고 멈춘다. */
    RETRY_LATER
}

/**
 * 큐에서 꺼낸 위치를 **한 번에 하나씩, 시간순으로** 보낸다.
 *
 * 이전에는 항목마다 코루틴을 띄워 N건을 동시에 쏘았다(같은 시각 4건 전송). 일시 실패가 나면 같은 이유로
 * 나머지도 실패할 가능성이 크므로 더 보내지 않고 남은 항목을 돌려줘 호출자가 큐에 되돌리게 한다.
 *
 * @return 다시 시도해야 할 항목(실패한 것 + 아직 보내지 않은 것), 없으면 빈 목록
 */
internal suspend fun uploadInOrder(
    items: List<CreateLocationLogRequest>,
    send: suspend (CreateLocationLogRequest) -> UploadOutcome
): List<CreateLocationLogRequest> {
    for ((index, request) in items.withIndex()) {
        if (send(request) == UploadOutcome.RETRY_LATER) return items.subList(index, items.size).toList()
    }
    return emptyList()
}
