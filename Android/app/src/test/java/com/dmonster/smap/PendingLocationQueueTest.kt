package com.dmonster.smap

import com.dmonster.smap.data.model.CreateLocationLogRequest
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

/**
 * 35단계 결함 2 재현 테스트: 위치 업로드가 같은 시각에 4건씩 동시 전송되던 문제.
 *
 * 원인(LocationService.flushPendingLocations): 큐에 쌓인 N개를 `forEach { launch { 전송 } }`로 한꺼번에 쏴서
 * N건이 수 ms 안에 동시에 나갔다. 같은 위치가 큐에 두 번 들어가도 걸러내지 못했다.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PendingLocationQueueTest {

    private fun fix(sec: Int, lat: Double = 37.5, lng: Double = 127.0, speed: Double = 0.0) = CreateLocationLogRequest(
        mtIdx = "112137", mltLat = lat, mltLong = lng, mltAccuracy = 8.0, mltSpeed = speed,
        mltTimestamp = "2026-11-13 15:36:%02d".format(sec), mltBattery = "80"
    )

    // ── 큐: 같은 위치의 중복 적재 ─────────────────────────────────────────

    @Test fun `같은 사용자 좌표 시각의 위치는 한 번만 쌓인다`() {
        val q = PendingLocationQueue(maxSize = 100)
        assertTrue(q.add(fix(43)))
        assertFalse("완전히 같은 위치는 중복", q.add(fix(43)))
        assertEquals(1, q.size)
    }

    @Test fun `시각이나 좌표가 다르면 별개의 위치다 - 수집 주기와 양은 그대로`() {
        val q = PendingLocationQueue(maxSize = 100)
        assertTrue(q.add(fix(43)))
        assertTrue(q.add(fix(44)))                    // 시각만 다름
        assertTrue(q.add(fix(43, lat = 37.5001)))     // 좌표만 다름
        assertEquals(3, q.size)
    }

    @Test fun `속도 정확도 등이 달라도 같은 시각 좌표면 중복이다`() {
        val q = PendingLocationQueue(maxSize = 100)
        assertTrue(q.add(fix(43, speed = 0.0)))
        // 292바이트/325바이트처럼 본문 크기가 다른 두 경로가 같은 위치를 각각 올리던 경우
        assertFalse(q.add(fix(43, speed = 1.234567890123)))
        assertEquals(1, q.size)
    }

    @Test fun `가득 차면 가장 오래된 것을 버린다`() {
        val q = PendingLocationQueue(maxSize = 3)
        (1..4).forEach { q.add(fix(it)) }
        assertEquals(listOf(2, 3, 4), q.snapshot().map { it.mltTimestamp.takeLast(2).toInt() })
    }

    @Test fun `drain 은 시간 순서대로 모두 꺼내고 비운다`() {
        val q = PendingLocationQueue(maxSize = 100)
        listOf(43, 44, 45).forEach { q.add(fix(it)) }
        val drained = q.drain()
        assertEquals(listOf(43, 44, 45), drained.map { it.mltTimestamp.takeLast(2).toInt() })
        assertEquals(0, q.size)
        assertTrue(q.drain().isEmpty())
    }

    @Test fun `실패해서 되돌린 항목은 새로 쌓인 것보다 앞에 놓인다`() {
        val q = PendingLocationQueue(maxSize = 100)
        q.add(fix(50))                                // 전송 중에 새로 들어온 위치
        q.addFirst(listOf(fix(43), fix(44)))          // 재시도 대상
        assertEquals(listOf(43, 44, 50), q.snapshot().map { it.mltTimestamp.takeLast(2).toInt() })
    }

    @Test fun `되돌릴 때도 이미 쌓인 같은 위치는 중복으로 보지 않는다`() {
        val q = PendingLocationQueue(maxSize = 100)
        q.add(fix(43))
        q.addFirst(listOf(fix(43)))
        assertEquals(1, q.size)
    }

    @Test fun `복원은 저장돼 있던 큐 안의 중복도 제거한다`() {
        val q = PendingLocationQueue(maxSize = 100)
        q.restore(listOf(fix(43), fix(43), fix(44)))
        assertEquals(2, q.size)
    }

    // ── 순차 전송 ─────────────────────────────────────────────────────

    @Test fun `여러 건은 한 번에 하나씩 순서대로 보낸다 - 동시 전송 없음`() = runTest {
        var inFlight = 0
        var maxInFlight = 0
        val order = ArrayList<Int>()
        val leftover = uploadInOrder(listOf(fix(43), fix(44), fix(45), fix(46))) { r ->
            inFlight++; maxInFlight = maxOf(maxInFlight, inFlight)
            order.add(r.mltTimestamp.takeLast(2).toInt())
            delay(50)                                  // 네트워크 왕복
            inFlight--
            UploadOutcome.DELIVERED
        }
        assertEquals("동시에 나가는 요청은 1건", 1, maxInFlight)
        assertEquals(listOf(43, 44, 45, 46), order)
        assertTrue(leftover.isEmpty())
        assertEquals("4건이 3ms 안이 아니라 차례로", 200L, currentTime)
    }

    @Test fun `재시도 대상 실패가 나면 거기서 멈추고 나머지를 돌려준다`() = runTest {
        val attempted = ArrayList<Int>()
        val leftover = uploadInOrder(listOf(fix(43), fix(44), fix(45), fix(46))) { r ->
            val s = r.mltTimestamp.takeLast(2).toInt()
            attempted.add(s)
            if (s == 44) UploadOutcome.RETRY_LATER else UploadOutcome.DELIVERED
        }
        assertEquals("실패 이후 요청을 더 보내지 않는다(서버·네트워크 폭주 방지)", listOf(43, 44), attempted)
        assertEquals(listOf(44, 45, 46), leftover.map { it.mltTimestamp.takeLast(2).toInt() })
    }

    @Test fun `버리기로 한 항목은 건너뛰고 계속 보낸다`() = runTest {
        val attempted = ArrayList<Int>()
        val leftover = uploadInOrder(listOf(fix(43), fix(44), fix(45))) { r ->
            val s = r.mltTimestamp.takeLast(2).toInt()
            attempted.add(s)
            if (s == 44) UploadOutcome.DROPPED else UploadOutcome.DELIVERED
        }
        assertEquals(listOf(43, 44, 45), attempted)
        assertTrue(leftover.isEmpty())
    }
}
