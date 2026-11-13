package com.dmonster.smap.data.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async

/**
 * 같은 조회가 동시에 여러 번 나가는 것을 한 번으로 합친다(진행 중인 요청 공유).
 *
 * 탭마다 ViewModel이 각자 `GET /groups/current-user`, `GET /group-members/member/{id}`를 호출해
 * 첫 진입에 같은 요청이 4건씩 나가던 문제(서버 부하·배터리)를 해결한다. 결과를 저장해 두는 캐시가 아니라
 * "지금 날아가는 요청에 합류"만 하므로, 요청이 끝난 뒤의 호출은 항상 새로 가져온다(오래된 데이터 위험 없음).
 *
 * - 합류한 호출자 한 명이 취소돼도 요청은 계속되어 나머지가 결과를 받는다(요청은 [scope]에서 실행).
 * - 실패는 합류한 모든 호출자에게 같은 예외로 전달된다. 다음 호출은 새로 시도한다.
 * - [invalidate]: 그룹 생성·참여·탈퇴처럼 서버 데이터를 바꾼 직후에 부른다. 이미 날아가던 요청은
 *   (변경 전 데이터일 수 있으므로) 이후 호출자가 합류하지 못하게 하고, 이후 호출은 새 요청을 만든다.
 */
class RequestCoalescer(
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) {
    private val lock = Any()
    private val inFlight = HashMap<String, Deferred<*>>()

    suspend fun <T> share(key: String, block: suspend () -> T): T {
        val deferred: Deferred<T>
        synchronized(lock) {
            @Suppress("UNCHECKED_CAST")
            val existing = inFlight[key] as Deferred<T>?
            if (existing != null) {
                deferred = existing
            } else {
                val created = scope.async(start = CoroutineStart.LAZY) { block() }
                inFlight[key] = created
                // 끝나면 자기 자신일 때만 제거한다(invalidate 뒤 새로 등록된 요청을 지우지 않기 위해).
                created.invokeOnCompletion {
                    synchronized(lock) { if (inFlight[key] === created) inFlight.remove(key) }
                }
                deferred = created
            }
        }
        deferred.start()
        return deferred.await()
    }

    /** 서버 데이터를 바꾼 직후 호출한다. 이후 호출자는 진행 중이던 옛 요청에 합류하지 않는다. */
    fun invalidate() {
        synchronized(lock) { inFlight.clear() }
    }
}
