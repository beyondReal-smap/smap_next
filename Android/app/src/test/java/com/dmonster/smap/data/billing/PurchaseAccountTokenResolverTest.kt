package com.dmonster.smap.data.billing

import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PurchaseAccountTokenResolverTest {

    private val tokenA = "11111111-1111-4111-8111-111111111111"
    private val tokenB = "22222222-2222-4222-8222-222222222222"

    private class Harness(
        var member: Int,
        var response: () -> ApiResult<SubscriptionStatusResponse>?
    ) {
        var calls = 0
        val resolver = PurchaseAccountTokenResolver(
            currentMemberId = { member },
            fetchStatus = { calls++; response() }
        )
    }

    private fun ok(token: String?) =
        ApiResult.Success(SubscriptionStatusResponse(accountToken = token))

    @Test
    fun `same member reuses cached token without refetch`() = runBlocking {
        val h = Harness(1) { ok(tokenA) }
        assertEquals(AccountTokenResult.Token(tokenA), h.resolver.resolve())
        assertEquals(AccountTokenResult.Token(tokenA), h.resolver.resolve())
        assertEquals(1, h.calls)
    }

    @Test
    fun `different member refetches and never reuses previous token`() = runBlocking {
        val h = Harness(1) { ok(tokenA) }
        h.resolver.resolve()
        h.member = 2
        h.response = { ok(tokenB) }
        assertEquals(AccountTokenResult.Token(tokenB), h.resolver.resolve())
        assertEquals(2, h.calls)
    }

    @Test
    fun `different member with fetch failure does not fall back to previous token`() = runBlocking {
        val h = Harness(1) { ok(tokenA) }
        h.resolver.resolve()
        h.member = 2
        h.response = { ApiResult.NetworkError(RuntimeException("x")) }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
    }

    @Test
    fun `missing token proceeds without token and is not cached`() = runBlocking {
        val h = Harness(1) { ok(null) }
        assertEquals(AccountTokenResult.None, h.resolver.resolve())
        h.response = { ok("  ") }
        assertEquals(AccountTokenResult.None, h.resolver.resolve())
        assertEquals(2, h.calls)
    }

    @Test
    fun `malformed or oversized token is a failure`() = runBlocking {
        val h = Harness(1) { ok("not-a-uuid") }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
        h.response = { ok(tokenA + "0".repeat(60)) }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
    }

    @Test
    fun `fetch failure or null result blocks purchase`() = runBlocking {
        val h = Harness(1) { ApiResult.Error(500, "server error") }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
        h.response = { null }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
    }

    @Test
    fun `invalidate on logout forces refetch`() = runBlocking {
        val h = Harness(1) { ok(tokenA) }
        h.resolver.resolve()
        h.resolver.invalidate()
        h.resolver.resolve()
        assertEquals(2, h.calls)
    }

    @Test
    fun `not logged in member id is a failure without fetching`() = runBlocking {
        val h = Harness(0) { ok(tokenA) }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
        assertEquals(0, h.calls)
    }

    @Test
    fun `member changed during fetch is a failure`() = runBlocking {
        val h = Harness(1) { ok(tokenA) }
        h.response = { h.member = 2; ok(tokenA) }
        assertTrue(h.resolver.resolve() is AccountTokenResult.Failure)
    }
}
