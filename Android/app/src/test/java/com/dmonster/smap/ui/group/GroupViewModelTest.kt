package com.dmonster.smap.ui.group

import android.content.SharedPreferences
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.service.HomeService
import com.dmonster.smap.data.service.RequestCoalescer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.lang.reflect.Proxy
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.COROUTINE_SUSPENDED
import kotlin.coroutines.resume

/**
 * 35단계 결함 1·3 재현 테스트.
 *
 * 결함 1: 다른 화면(홈)에서 그룹을 만들어도 그룹 탭의 목록이 갱신되지 않았다.
 *         GroupViewModel이 GroupsChanged를 발행만 하고 구독하지 않았기 때문이다.
 * 결함 3: 탭마다 같은 조회를 각자 불러 `groups/current-user`가 동시에 4건 나갔다.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GroupViewModelTest {
    private var serverGroups = emptyList<SmapGroup>()
    private val groupCalls = AtomicInteger()
    private val memberCalls = AtomicInteger()
    private val pendingGroupCalls = ArrayList<Continuation<Any?>>()
    private var holdGroupResponses = false

    private val stored = HashMap<String, Any?>()

    private fun group(id: Int) = SmapGroup(sgtIdx = id, sgtTitle = "g$id", memberCount = 1)

    private fun fakeApi(): SmapApi =
        Proxy.newProxyInstance(SmapApi::class.java.classLoader, arrayOf(SmapApi::class.java)) { _, method, args ->
            when (method.name) {
                "getCurrentUserGroups" -> {
                    groupCalls.incrementAndGet()
                    if (holdGroupResponses) {
                        @Suppress("UNCHECKED_CAST")
                        pendingGroupCalls.add(args.last() as Continuation<Any?>)
                        COROUTINE_SUSPENDED
                    } else serverGroups
                }
                "getGroupMembers" -> { memberCalls.incrementAndGet(); emptyList<SmapGroupMember>() }
                else -> error("unexpected API call: ${method.name}")
            }
        } as SmapApi

    private fun authService(api: SmapApi): AuthService {
        val editor = Proxy.newProxyInstance(SharedPreferences.Editor::class.java.classLoader, arrayOf(SharedPreferences.Editor::class.java)) { proxy, _, _ -> proxy } as SharedPreferences.Editor
        val prefs = Proxy.newProxyInstance(SharedPreferences::class.java.classLoader, arrayOf(SharedPreferences::class.java)) { _, method, args ->
            when (method.name) {
                "getString" -> stored[args[0] as String] ?: args[1]
                "getInt" -> stored[args[0] as String] ?: args[1]
                "edit" -> editor
                else -> null
            }
        } as SharedPreferences
        val tokens = object : TokenStore {
            override fun getRefreshToken(): String? = null
            override fun saveRefreshToken(token: String) = Unit
            override fun clearRefreshToken() = Unit
        }
        return AuthService(api, prefs, tokens)
    }

    private fun coalescer() = RequestCoalescer(CoroutineScope(SupervisorJob() + Dispatchers.Unconfined))
    private fun unconfined() = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @Before fun setup() { Dispatchers.setMain(UnconfinedTestDispatcher()) }
    @After fun teardown() { Dispatchers.resetMain() }

    @Test
    fun `다른 화면이 그룹을 만들면 그룹 탭 목록이 갱신된다`() = runTest {
        val api = fakeApi()
        val vm = GroupViewModel(GroupService(api, authService(api), coalescer()), authService(api))
        assertTrue("처음엔 그룹이 없다", vm.groups.value.isEmpty())

        // 홈 화면에서 그룹 생성 성공 → 서버에는 그룹이 생기고 이벤트가 발행된다
        serverGroups = listOf(group(1))
        GlobalEventBus.emit(GlobalEvent.GroupsChanged)

        assertEquals("그룹 탭에도 새 그룹이 보여야 한다", listOf(1), vm.groups.value.map { it.sgtIdx })
    }

    @Test
    fun `그룹 탭 자체의 변경에서도 같은 요청은 한 번만 나간다`() = runTest {
        val api = fakeApi()
        val vm = GroupViewModel(GroupService(api, authService(api), coalescer()), authService(api))
        val before = groupCalls.get()
        // 이벤트 수신 + 직접 loadGroups() 가 동시에 일어나는 상황(생성/삭제/탈퇴 처리와 같다)
        holdGroupResponses = true
        vm.loadGroups()
        GlobalEventBus.emit(GlobalEvent.GroupsChanged)
        assertEquals("두 갱신이 겹치면 요청 1건을 공유", before + 1, groupCalls.get())
        holdGroupResponses = false
        pendingGroupCalls.forEach { it.resume(emptyList<SmapGroup>()) }
    }

    @Test
    fun `홈 서비스와 그룹 서비스가 동시에 불러도 그룹 조회는 1건이다`() = runTest {
        val api = fakeApi()
        val shared = coalescer()
        val auth = authService(api)
        val groupService = GroupService(api, auth, shared)
        val homeService = HomeService(api, auth, shared)

        holdGroupResponses = true
        val results = ArrayList<List<SmapGroup>>()
        val callers = listOf<suspend () -> List<SmapGroup>>(
            { groupService.getGroups() }, { homeService.getGroups() },
            { groupService.getGroups() }, { homeService.getGroups() }
        )
        val jobs = callers.map { c -> unconfined().launchCollect(c, results) }
        assertEquals("4개 화면이 동시에 불러도 서버 요청은 1건", 1, groupCalls.get())

        pendingGroupCalls.single().resume(listOf(group(7)))
        jobs.forEach { it.join() }
        assertEquals(4, results.size)
        assertTrue(results.all { r -> r.map { it.sgtIdx } == listOf(7) })
    }

    @Test
    fun `그룹 생성 직후 조회는 생성 전 요청에 합류하지 않는다`() = runTest {
        val api = Proxy.newProxyInstance(SmapApi::class.java.classLoader, arrayOf(SmapApi::class.java)) { _, method, args ->
            when (method.name) {
                "getCurrentUserGroups" -> {
                    groupCalls.incrementAndGet()
                    @Suppress("UNCHECKED_CAST")
                    pendingGroupCalls.add(args.last() as Continuation<Any?>)
                    COROUTINE_SUSPENDED
                }
                "createGroup" -> group(9)
                else -> error("unexpected API call: ${method.name}")
            }
        } as SmapApi
        val home = HomeService(api, authService(api), coalescer())

        val stale = ArrayList<List<SmapGroup>>()
        val staleJob = unconfined().launchCollect({ home.getGroups() }, stale)
        assertEquals(1, groupCalls.get())

        home.createGroup("새 그룹", "")           // 성공 → invalidate
        val fresh = ArrayList<List<SmapGroup>>()
        val freshJob = unconfined().launchCollect({ home.getGroups() }, fresh)
        assertEquals("생성 이후 조회는 새 요청", 2, groupCalls.get())

        pendingGroupCalls[0].resume(emptyList<SmapGroup>())          // 생성 전 응답
        pendingGroupCalls[1].resume(listOf(group(9)))                // 생성 후 응답
        staleJob.join(); freshJob.join()
        assertEquals(listOf(9), fresh.single().map { it.sgtIdx })
    }
}

private fun CoroutineScope.launchCollect(
    call: suspend () -> List<SmapGroup>,
    into: MutableList<List<SmapGroup>>
) = launch { into.add(call()) }
