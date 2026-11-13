package com.dmonster.smap.data.service

import com.dmonster.smap.data.model.SubscriptionLimits
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class SubscriptionPolicyTest {

    @Test
    fun `shouldReprocessPurchase returns true only when logged in, purchased, unacknowledged, and matching product`() {
        assertTrue(
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = true,
                isPurchasedState = true,
                isAcknowledged = false,
                matchesProduct = true
            )
        )
    }

    @Test
    fun `shouldReprocessPurchase returns false when not logged in`() {
        assertFalse(
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = false,
                isPurchasedState = true,
                isAcknowledged = false,
                matchesProduct = true
            )
        )
    }

    @Test
    fun `shouldReprocessPurchase returns false when purchase is pending`() {
        assertFalse(
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = true,
                isPurchasedState = false,
                isAcknowledged = false,
                matchesProduct = true
            )
        )
    }

    @Test
    fun `shouldReprocessPurchase returns false when already acknowledged`() {
        assertFalse(
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = true,
                isPurchasedState = true,
                isAcknowledged = true,
                matchesProduct = true
            )
        )
    }

    @Test
    fun `shouldReprocessPurchase returns false for unrelated product`() {
        assertFalse(
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = true,
                isPurchasedState = true,
                isAcknowledged = false,
                matchesProduct = false
            )
        )
    }

    @Test
    fun `isActivityDateLocked returns false when enforcement is disabled`() {
        val today = LocalDate.of(2026, 11, 13)
        val freeStatusNoEnforcement = SubscriptionStatusResponse(
            isPremium = false,
            limits = SubscriptionLimits(maxPlaces = 2, logRetentionDays = 2),
            enforcementEnabled = false
        )
        assertFalse(SubscriptionPolicy.isActivityDateLocked(today.minusDays(10), today, freeStatusNoEnforcement))
    }

    @Test
    fun `isActivityDateLocked locks dates older than retention window for free user when enforcement enabled`() {
        val today = LocalDate.of(2026, 11, 13)
        val freeStatus = SubscriptionStatusResponse(
            isPremium = false,
            limits = SubscriptionLimits(maxPlaces = 2, logRetentionDays = 2),
            enforcementEnabled = true
        )
        // 최근 2일 = 오늘(11/13), 어제(11/12) 허용. 11/11 부터 잠금.
        assertFalse(SubscriptionPolicy.isActivityDateLocked(today, today, freeStatus))
        assertFalse(SubscriptionPolicy.isActivityDateLocked(today.minusDays(1), today, freeStatus))
        assertTrue(SubscriptionPolicy.isActivityDateLocked(today.minusDays(2), today, freeStatus))
        assertTrue(SubscriptionPolicy.isActivityDateLocked(today.minusDays(10), today, freeStatus))
    }

    @Test
    fun `isActivityDateLocked returns false for premium user even when enforcement enabled`() {
        val today = LocalDate.of(2026, 11, 13)
        val premiumStatus = SubscriptionStatusResponse(
            isPremium = true,
            plan = "year",
            platform = "android",
            limits = SubscriptionLimits(maxPlaces = null, logRetentionDays = 14),
            enforcementEnabled = true
        )
        assertFalse(SubscriptionPolicy.isActivityDateLocked(today.minusDays(13), today, premiumStatus))
    }
}
