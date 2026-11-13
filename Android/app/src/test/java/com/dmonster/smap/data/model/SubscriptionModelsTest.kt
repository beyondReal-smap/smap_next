package com.dmonster.smap.data.model

import com.dmonster.smap.data.api.parseFastApiErrorDetail
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    @Test
    fun `SubscriptionStatusResponse parses premium payload with null max_places`() {
        val raw = """
            {
              "is_premium": true,
              "plan": "year",
              "platform": "ios",
              "expires_at": "2027-11-13T03:00:00Z",
              "auto_renew": true,
              "in_grace_period": false,
              "limits": { "max_places": null, "log_retention_days": 14 },
              "enforcement_enabled": true
            }
        """.trimIndent()

        val parsed = json.decodeFromString<SubscriptionStatusResponse>(raw)
        assertTrue(parsed.isPremium)
        assertEquals("year", parsed.plan)
        assertEquals("ios", parsed.platform)
        assertEquals("2027-11-13T03:00:00Z", parsed.expiresAt)
        assertEquals(true, parsed.autoRenew)
        assertFalse(parsed.inGracePeriod)
        assertNull(parsed.limits.maxPlaces)
        assertEquals(14, parsed.limits.logRetentionDays)
        assertTrue(parsed.enforcementEnabled)
    }

    @Test
    fun `SubscriptionStatusResponse parses free payload with nullable fields`() {
        val raw = """
            {
              "is_premium": false,
              "plan": null,
              "platform": null,
              "expires_at": null,
              "auto_renew": null,
              "in_grace_period": false,
              "limits": { "max_places": 2, "log_retention_days": 2 },
              "enforcement_enabled": false
            }
        """.trimIndent()

        val parsed = json.decodeFromString<SubscriptionStatusResponse>(raw)
        assertFalse(parsed.isPremium)
        assertNull(parsed.plan)
        assertNull(parsed.platform)
        assertNull(parsed.expiresAt)
        assertNull(parsed.autoRenew)
        assertEquals(2, parsed.limits.maxPlaces)
        assertEquals(2, parsed.limits.logRetentionDays)
        assertFalse(parsed.enforcementEnabled)
    }

    @Test
    fun `parseFastApiErrorDetail extracts PLACE_LIMIT_EXCEEDED object detail`() {
        val body = """
            {"detail":{"code":"PLACE_LIMIT_EXCEEDED","message":"무료 회원은 내 장소를 2개까지 등록할 수 있어요.","limit":2}}
        """.trimIndent()

        val parsed = parseFastApiErrorDetail(body)
        assertEquals("PLACE_LIMIT_EXCEEDED", parsed?.code)
        assertEquals("무료 회원은 내 장소를 2개까지 등록할 수 있어요.", parsed?.message)
    }

    @Test
    fun `parseFastApiErrorDetail extracts LOG_RETENTION_EXCEEDED object detail`() {
        val body = """
            {"detail":{"code":"LOG_RETENTION_EXCEEDED","message":"무료 회원은 최근 2일의 활동 기록만 볼 수 있어요.","retention_days":2}}
        """.trimIndent()

        val parsed = parseFastApiErrorDetail(body)
        assertEquals("LOG_RETENTION_EXCEEDED", parsed?.code)
        assertEquals("무료 회원은 최근 2일의 활동 기록만 볼 수 있어요.", parsed?.message)
    }

    @Test
    fun `parseFastApiErrorDetail extracts string detail for 409 conflict`() {
        val body = """{"detail":"이 구매는 다른 계정에 연결되어 있어요."}"""

        val parsed = parseFastApiErrorDetail(body)
        assertNull(parsed?.code)
        assertEquals("이 구매는 다른 계정에 연결되어 있어요.", parsed?.message)
    }

    @Test
    fun `parseFastApiErrorDetail returns null for invalid or blank body`() {
        assertNull(parseFastApiErrorDetail(null))
        assertNull(parseFastApiErrorDetail(""))
        assertNull(parseFastApiErrorDetail("not json"))
    }

    @Test
    fun `SubscriptionStatusResponse parses optional account_token and defaults to null`() {
        val with = json.decodeFromString<SubscriptionStatusResponse>(
            """{"is_premium": false, "account_token": "11111111-1111-4111-8111-111111111111"}"""
        )
        assertEquals("11111111-1111-4111-8111-111111111111", with.accountToken)
        val without = json.decodeFromString<SubscriptionStatusResponse>("""{"is_premium": false}""")
        assertNull(without.accountToken)
    }
}
