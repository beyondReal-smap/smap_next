package com.dmonster.smap.data.service

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

/**
 * 같은 조회가 동시에 여러 번 나가던 결함(35단계 결함 3)의 재현 테스트.
 * 탭/ViewModel마다 각자 `GET /groups/current-user`를 불러 첫 진입에 4건이 30ms 안에 나갔다.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RequestCoalescerTest {
    /** 운영(SupervisorJob + IO)과 같은 성질의 테스트용 스코프: 요청 하나가 실패해도 스코프가 취소되지 않는다. */
    private fun TestScope.prodLikeScope() = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))

    @Test
    fun `같은 키의 동시 호출은 네트워크 호출 1번을 공유한다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        var calls = 0
        val gate = CompletableDeferred<List<Int>>()

        val callers = List(4) { async { coalescer.share("groups") { calls++; gate.await() } } }
        runCurrent()
        assertEquals("4명이 동시에 불러도 요청은 1건", 1, calls)

        gate.complete(listOf(1, 2, 3))
        callers.forEach { assertEquals(listOf(1, 2, 3), it.await()) }
        assertEquals(1, calls)
    }

    @Test
    fun `다른 키는 각자 호출한다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        var calls = 0
        val gate = CompletableDeferred<Int>()
        val a = async { coalescer.share("members:1") { calls++; gate.await() } }
        val b = async { coalescer.share("members:2") { calls++; gate.await() } }
        runCurrent()
        assertEquals(2, calls)
        gate.complete(7)
        assertEquals(7, a.await()); assertEquals(7, b.await())
    }

    @Test
    fun `끝난 뒤의 호출은 새로 가져온다 - 캐시가 아니다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        var calls = 0
        assertEquals(1, coalescer.share("k") { ++calls })
        assertEquals(2, coalescer.share("k") { ++calls })
    }

    @Test
    fun `변경 후 invalidate 하면 진행 중이던 옛 요청에 합류하지 않는다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        val oldGate = CompletableDeferred<String>()
        val newGate = CompletableDeferred<String>()
        val gates = ArrayDeque(listOf(oldGate, newGate))
        var calls = 0

        val before = async { coalescer.share("groups") { calls++; gates.removeFirst().await() } }
        runCurrent()
        coalescer.invalidate() // 그룹 생성 성공 직후
        val after = async { coalescer.share("groups") { calls++; gates.removeFirst().await() } }
        runCurrent()
        assertEquals("생성 이후의 조회는 새 요청", 2, calls)

        oldGate.complete("생성 전 목록"); newGate.complete("생성 후 목록")
        assertEquals("생성 전 목록", before.await())
        assertEquals("생성 후 목록", after.await())

        // 옛 요청이 늦게 끝나도 새 요청 등록을 지우지 않는다
        var third = 0
        assertEquals("fresh", coalescer.share("groups") { third++; "fresh" })
        assertEquals(1, third)
    }

    @Test
    fun `실패는 합류한 모두에게 전달되고 다음 호출은 다시 시도한다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        val gate = CompletableDeferred<Unit>()
        var calls = 0
        val callers = List(3) {
            async { runCatching { coalescer.share("k") { calls++; gate.await(); throw IOException("net") } } }
        }
        runCurrent()
        gate.complete(Unit)
        callers.forEach { assertTrue(it.await().exceptionOrNull() is IOException) }
        assertEquals(1, calls)

        assertEquals("ok", coalescer.share("k") { calls++; "ok" })
        assertEquals(2, calls)
    }

    @Test
    fun `호출자 한 명이 취소돼도 다른 호출자는 결과를 받는다`() = runTest {
        val coalescer = RequestCoalescer(prodLikeScope())
        val gate = CompletableDeferred<String>()
        var calls = 0
        val first = async { coalescer.share("k") { calls++; gate.await() } }
        val second = async { coalescer.share("k") { calls++; gate.await() } }
        runCurrent()
        first.cancel()
        runCurrent()
        gate.complete("done")
        advanceUntilIdle()
        assertEquals("done", second.await())
        assertEquals(1, calls)
    }
}
